import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { generateInviteCode } from '../db.js';
import { requireAuth, requireAdminMiddleware, requireCoordinatorOrAdmin, requireStallCoordinator } from '../rbac.js';
import { calculateStallFinancials, calculateEventSummary } from '../financials.js';
import realtime from '../ws.js';

const router = express.Router();

// ── In-Memory High-Performance Caching Layer ──────────────────────────────
let cachedStallsResponse = null;
let cachedSummaryResponse = null;
let stallsCacheTime = 0;
let summaryCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10s TTL fallback if no write occurs

// Instantly invalidate caches whenever any write occurs in the database
if (typeof db.onChange === 'function') {
  db.onChange(() => {
    cachedStallsResponse = null;
    cachedSummaryResponse = null;
    stallsCacheTime = 0;
    summaryCacheTime = 0;
  });
}

// ── List all stalls with live financial metrics ───────────────────────────
router.get('/', (req, res) => {
  try {
    const now = Date.now();
    if (cachedStallsResponse && (now - stallsCacheTime < CACHE_TTL_MS)) {
      return res.json(cachedStallsResponse);
    }

    const stalls = Array.isArray(db.data?.stalls) ? db.data.stalls : [];
    const users = Array.isArray(db.data?.users) ? db.data.users : [];
    const attendanceRecords = Array.isArray(db.data?.attendance_records) ? db.data.attendance_records : [];

    const stallsWithMetrics = stalls.map(s => {
      const fin = calculateStallFinancials(s.id, db.data);
      const coordinator = users.find(u => u.id === s.coordinator_user_id);
      const members = users.filter(u => u.stall_id === s.id && u.role === 'member');

      const stallAttendance = attendanceRecords.filter(
        a => a.stall_id === s.id && a.status === 'confirmed'
      );
      const attendancePercent = members.length > 0
        ? Math.round((stallAttendance.length / members.length) * 100)
        : 100;

      return {
        ...s,
        financials: fin,
        coordinator: coordinator ? { id: coordinator.id, name: coordinator.name, phone: coordinator.phone } : null,
        members_count: members.length,
        attendance_confirmed_count: stallAttendance.length,
        attendance_rate: attendancePercent
      };
    });

    cachedStallsResponse = { stalls: stallsWithMetrics };
    stallsCacheTime = now;
    res.json(cachedStallsResponse);
  } catch (err) {
    console.error('[Stalls Error] GET /:', err);
    res.status(500).json({ error: err.message || 'Failed to list stalls.' });
  }
});

// ── Event summary (command center metrics) ──────────────────────────────────
router.get('/summary/event', (req, res) => {
  try {
    const now = Date.now();
    if (cachedSummaryResponse && (now - summaryCacheTime < CACHE_TTL_MS)) {
      return res.json(cachedSummaryResponse);
    }

    const summary = calculateEventSummary(db.data);
    cachedSummaryResponse = { summary };
    summaryCacheTime = now;
    res.json(cachedSummaryResponse);
  } catch (err) {
    console.error('[Stalls Error] GET /summary/event:', err);
    res.status(500).json({ error: err.message || 'Failed to calculate event summary.' });
  }
});

// â”€â”€ Member: Direct Join Stall using 12-char invite code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/join-request', requireAuth, (req, res) => {
  const { invite_code, stall_code } = req.body;
  const rawCode = invite_code || stall_code;
  if (!rawCode || !rawCode.trim()) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit stall invite code.' });
  }

  const cleanCode = rawCode.trim();
  const stall = db.data.stalls.find(s => s.invite_code === cleanCode);
  if (!stall) {
    return res.status(404).json({ error: 'Invalid Stall Invite Code. Please verify the 12-character code with your Stall Coordinator.' });
  }

  if (stall.status === 'discontinued') {
    return res.status(400).json({ error: 'This stall is currently inactive/discontinued.' });
  }

  // Instantly activate member into this stall â€” direct access, no manual waiting!
  const updatedUser = db.updateUser(req.user.id, {
    role: 'member',
    stall_id: stall.id,
    stall_name_desired: stall.name,
    designation: req.user.designation || 'Team Member'
  });

  // Ensure member has a badge code
  if (!updatedUser.badge_code) {
    updatedUser.badge_code = 'M-' + Math.floor(1000 + Math.random() * 9000);
    db.save();
  }

  // Notify coordinator in real-time
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: stall.id,
    title: 'New Member Joined Stall ðŸŽ‰',
    message: `${req.user.name} entered your Stall Invite Code and joined "${stall.name}".`,
    type: 'member_joined',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.logAudit(
    req.user.id, req.user.name,
    'MEMBER_JOINED_STALL', 'STALL', stall.id,
    `${req.user.name} joined stall "${stall.name}" using invite code.`
  );

  db.save();

  // Real-time broadcast to coordinator and member
  realtime.broadcast('STALL_UPDATED', { stall_id: stall.id });
  realtime.broadcast('MEMBER_JOIN_APPROVED', {
    user_id: req.user.id,
    stall_id: stall.id,
    stall_name: stall.name
  });

  res.json({
    success: true,
    message: `ðŸŽ‰ Successfully joined "${stall.name}"! Access granted.`,
    user: {
      ...updatedUser,
      stall_name: stall.name,
      stall_category: stall.category
    },
    stall: { id: stall.id, name: stall.name, category: stall.category }
  });
});

// â”€â”€ Single stall details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/:stallId', (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  // Make sure stall has invite code
  if (!stall.invite_code) {
    stall.invite_code = generateInviteCode();
    db.save();
  }

  const financials = calculateStallFinancials(stall.id, db.data);
  const coordinator = db.data.users.find(u => u.id === stall.coordinator_user_id);
  const members = db.data.users.filter(u => u.stall_id === stall.id && u.role === 'member');
  const expenses = (db.data.stall_expenses || []).filter(e => e.stall_id === stall.id);

  const verifiedSubmissions = (db.data.sales_submissions || []).filter(
    s => s.stall_id === stall.id && s.status === 'verified'
  );
  const pendingSubmissions = (db.data.sales_submissions || []).filter(
    s => s.stall_id === stall.id && s.status === 'pending'
  );
  const rejectedSubmissions = (db.data.sales_submissions || []).filter(
    s => s.stall_id === stall.id && s.status === 'rejected'
  );

  const catalog = (db.data.pos_catalog || []).filter(c => c.stall_id === stall.id);
  const attendance = (db.data.attendance_records || []).filter(a => a.stall_id === stall.id);
  const joinRequests = (db.data.stall_join_requests || []).filter(
    r => r.stall_id === stall.id && r.status === 'pending'
  );

  res.json({
    stall: {
      ...stall,
      coordinator,
      members,
      financials,
      expenses,
      submissions: { verified: verifiedSubmissions, pending: pendingSubmissions, rejected: rejectedSubmissions },
      catalog,
      attendance,
      join_requests: joinRequests
    }
  });
});

// â”€â”€ Admin: Create new stall â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/', requireAdminMiddleware, (req, res) => {
  const { name, category, coordinator_uid, coordinator_name, coordinator_phone, location, banner_color, allotted_number } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Stall name and category are required' });
  }

  // Find coordinator by UID if provided, or create/assign if coordinator_name provided
  let coordinatorUser = null;
  if (coordinator_uid) {
    coordinatorUser = db.getUserByUid(coordinator_uid);
  } else if (coordinator_name && coordinator_name.trim()) {
    const cName = coordinator_name.trim();
    const cPhone = coordinator_phone ? coordinator_phone.trim() : null;
    // Create new coordinator user profile
    const coordId = 'usr-coord-' + uuidv4().slice(0, 8);
    coordinatorUser = db.createUser({
      id: coordId,
      name: cName,
      email: `${cName.toLowerCase().replace(/\s+/g, '.')}.${Math.floor(100 + Math.random() * 900)}@stall.vertex`,
      role: 'coordinator',
      phone: cPhone,
      designation: 'Stall Coordinator'
    });
  }

  const stallId = 'stl-' + uuidv4().slice(0, 8);
  const inviteCode = generateInviteCode();

  const newStall = {
    id: stallId,
    name: name.trim(),
    category: category.trim(),
    event_id: 'ev-bp-2026',
    coordinator_user_id: coordinatorUser?.id || null,
    status: 'active',
    banner_color: banner_color || '#4F46E5',
    location: location || 'Main Courtyard',
    allotted_number: allotted_number || null,
    invite_code: inviteCode,
    created_at: new Date().toISOString()
  };

  db.data.stalls.push(newStall);

  // Assign coordinator to this stall
  if (coordinatorUser) {
    db.updateUser(coordinatorUser.id, { role: 'coordinator', stall_id: stallId });
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_CREATED', 'STALL', stallId,
    `Admin created stall "${name}" (${category}) (Invite Code: ${inviteCode})${coordinatorUser ? ` with coordinator ${coordinatorUser.name}` : ''}.`
  );

  db.save();
  realtime.broadcast('STALL_CREATED', { stall: newStall });

  res.status(201).json({ stall: newStall });
});

// â”€â”€ Admin: Update stall details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/:stallId', requireAdminMiddleware, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const { name, category, location, banner_color, coordinator_uid, allotted_number, status } = req.body;

  if (name) stall.name = name.trim();
  if (category) stall.category = category.trim();
  if (location !== undefined) stall.location = location ? location.trim() : stall.location;
  if (banner_color !== undefined) stall.banner_color = banner_color;
  if (allotted_number !== undefined) stall.allotted_number = allotted_number;
  if (status && ['active', 'discontinued', 'warning'].includes(status)) stall.status = status;

  // Handle coordinator change if provided
  if (coordinator_uid !== undefined && coordinator_uid !== stall.coordinator_user_id) {
    // If old coordinator existed, we keep them as coordinator or unbind stall
    const oldCoord = stall.coordinator_user_id ? db.getUserByUid(stall.coordinator_user_id) : null;
    
    if (coordinator_uid) {
      const newCoord = db.getUserByUid(coordinator_uid);
      if (newCoord) {
        stall.coordinator_user_id = newCoord.id;
        db.updateUser(newCoord.id, { role: 'coordinator', stall_id: stall.id });
      }
    } else {
      stall.coordinator_user_id = null;
    }
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_UPDATED', 'STALL', stall.id,
    `Admin updated stall details for "${stall.name}" (${stall.category}).`
  );

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });

  res.json({ stall, message: 'Stall updated successfully.' });
});

// â”€â”€ Admin: Delete stall â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/:stallId', requireAdminMiddleware, (req, res) => {
  const stallIndex = db.data.stalls.findIndex(s => s.id === req.params.stallId);
  if (stallIndex === -1) return res.status(404).json({ error: 'Stall not found' });

  const stall = db.data.stalls[stallIndex];

  // Unlink all members and coordinator associated with this stall
  (db.data.users || []).forEach(u => {
    if (u.stall_id === stall.id) {
      u.stall_id = null;
      if (u.role === 'member') u.role = 'pending_member';
      if (u.role === 'coordinator') u.role = 'pending_coordinator';
    }
  });

  // Remove the stall
  db.data.stalls.splice(stallIndex, 1);

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_DELETED', 'STALL', stall.id,
    `Admin permanently deleted stall "${stall.name}".`
  );

  db.save();
  realtime.broadcast('STALL_DELETED', { stall_id: stall.id });

  res.json({ success: true, message: `Stall "${stall.name}" has been deleted.` });
});


// â”€â”€ Coordinator / Admin: Get pending join requests for a stall â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/:stallId/join-requests', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only stall coordinator or admin can view join requests' });
  }

  const requests = (db.data.stall_join_requests || []).filter(
    r => r.stall_id === stall.id && r.status === 'pending'
  );
  res.json({ requests });
});

// â”€â”€ Coordinator / Admin: Approve join request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/join-requests/:requestId/approve', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only stall coordinator or admin can approve join requests' });
  }

  const joinReq = (db.data.stall_join_requests || []).find(r => r.id === req.params.requestId);
  if (!joinReq) return res.status(404).json({ error: 'Join request not found' });

  joinReq.status = 'approved';
  joinReq.approved_by = req.user.id;
  joinReq.approved_at = new Date().toISOString();

  // Assign user to this stall as full active member
  const memberUser = db.getUserByUid(joinReq.user_id);
  if (memberUser) {
    db.updateUser(memberUser.id, {
      role: 'member',
      stall_id: stall.id,
      designation: memberUser.designation || 'Team Member'
    });
  }

  db.logAudit(
    req.user.id, req.user.name,
    'MEMBER_JOIN_APPROVED', 'STALL', stall.id,
    `${req.user.name} approved join request for ${joinReq.user_name} to join stall "${stall.name}".`
  );

  // Send notification to member
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'member',
    target_scope_id: joinReq.user_id,
    title: 'Join Request Approved ðŸŽ‰',
    message: `You are now an active member of ${stall.name}!`,
    type: 'join_approved',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);
  db.save();

  realtime.broadcast('MEMBER_JOIN_APPROVED', {
    request_id: joinReq.id,
    user_id: joinReq.user_id,
    stall_id: stall.id,
    stall_name: stall.name
  });

  res.json({ message: `Approved ${joinReq.user_name} as member of ${stall.name}.`, request: joinReq });
});

// â”€â”€ Coordinator / Admin: Reject join request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/join-requests/:requestId/reject', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only stall coordinator or admin can reject join requests' });
  }

  const joinReq = (db.data.stall_join_requests || []).find(r => r.id === req.params.requestId);
  if (!joinReq) return res.status(404).json({ error: 'Join request not found' });

  joinReq.status = 'rejected';
  joinReq.rejected_by = req.user.id;
  joinReq.rejected_at = new Date().toISOString();

  db.save();

  realtime.broadcast('MEMBER_JOIN_REJECTED', {
    request_id: joinReq.id,
    user_id: joinReq.user_id,
    stall_id: stall.id
  });

  res.json({ message: `Rejected join request for ${joinReq.user_name}.`, request: joinReq });
});

// â”€â”€ Admin: Change stall status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/:stallId/status', requireAdminMiddleware, (req, res) => {
  const { status, warning_reason } = req.body;
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const oldStatus = stall.status;
  stall.status = status;
  if (warning_reason) {
    stall.last_warning = warning_reason;
    stall.last_warning_time = new Date().toISOString();
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_STATUS_CHANGED', 'STALL', stall.id,
    `Changed status of "${stall.name}" from ${oldStatus} to ${status}.${warning_reason ? ` Warning: ${warning_reason}` : ''}`
  );

  if (status === 'discontinued' || warning_reason) {
    const notif = {
      id: 'notif-' + uuidv4().slice(0, 8),
      target_role: 'coordinator',
      target_scope_id: stall.id,
      title: status === 'discontinued' ? 'âš ï¸ Stall Discontinued by Admin' : 'âš ï¸ Admin Warning Notice',
      message: warning_reason || `Stall status updated to ${status}. Please contact Admin.`,
      type: 'warning',
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };
    db.data.notifications.unshift(notif);
  }

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });

  res.json({ stall });
});

// â”€â”€ Admin Manage Action 1: Issue Warning [with context] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/manage/warning', requireAdminMiddleware, (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Warning context/reason is required' });
  }

  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const cleanReason = reason.trim();
  stall.last_warning = cleanReason;
  stall.last_warning_time = new Date().toISOString();

  // Send notification to stall coordinator & members
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: stall.id,
    title: `âš ï¸ Official Warning: ${stall.name}`,
    message: cleanReason,
    type: 'warning',
    created_by: req.user.id,
    read_by: [],
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_WARNING_ISSUED', 'STALL', stall.id,
    `Issued warning to "${stall.name}": ${cleanReason}`
  );

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });
  realtime.broadcast('NOTIFICATION_CREATED', { notification: notif });

  res.json({ success: true, message: `Warning issued to ${stall.name}.`, stall });
});

// â”€â”€ Admin Manage Action 2: Discontinue Them (Coordinator or Member) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/manage/discontinue-user', requireAdminMiddleware, (req, res) => {
  const { user_id, reason } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required to discontinue member' });
  }

  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const targetUser = db.getUserByUid(user_id);
  if (!targetUser) return res.status(404).json({ error: 'User profile not found' });

  const prevRole = targetUser.role;
  targetUser.stall_id = null;
  targetUser.role = prevRole === 'coordinator' ? 'pending_coordinator' : 'pending_member';
  targetUser.discontinued = true;
  targetUser.discontinue_reason = (reason || 'Discontinued by Administrator').trim();

  // If coordinator was discontinued, unbind coordinator from stall
  if (stall.coordinator_user_id === targetUser.id) {
    stall.coordinator_user_id = null;
  }

  // Send direct notice
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: prevRole,
    target_scope_id: targetUser.id,
    title: 'âš ï¸ Role Discontinued Notice',
    message: `You have been discontinued from "${stall.name}". Reason: ${targetUser.discontinue_reason}`,
    type: 'warning',
    created_by: req.user.id,
    read_by: [],
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.logAudit(
    req.user.id, req.user.name,
    'USER_DISCONTINUED_FROM_STALL', 'USER', targetUser.id,
    `Admin discontinued ${targetUser.name} (${prevRole}) from stall "${stall.name}". Reason: ${targetUser.discontinue_reason}`
  );

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });
  realtime.broadcast('USER_UPDATED', { user: targetUser });

  res.json({ success: true, message: `Discontinued ${targetUser.name} from ${stall.name}.`, user: targetUser });
});

// â”€â”€ Admin Manage Action 3: Flag Them [with context] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/manage/flag', requireAdminMiddleware, (req, res) => {
  const { target_type, user_id, reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Flagging context/reason is required' });
  }

  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const cleanReason = reason.trim();

  if (target_type === 'user' && user_id) {
    const targetUser = db.getUserByUid(user_id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    targetUser.is_flagged = true;
    targetUser.flag_reason = cleanReason;
    targetUser.flagged_at = new Date().toISOString();

    db.logAudit(
      req.user.id, req.user.name,
      'FLAG_ISSUED', 'USER', targetUser.id,
      `Flagged user ${targetUser.name} (${stall.name}): ${cleanReason}`
    );
  } else {
    // Flag the stall
    stall.is_flagged = true;
    stall.flag_reason = cleanReason;
    stall.flagged_at = new Date().toISOString();

    db.logAudit(
      req.user.id, req.user.name,
      'FLAG_ISSUED', 'STALL', stall.id,
      `Flagged stall "${stall.name}": ${cleanReason}`
    );
  }

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });

  res.json({ success: true, message: `Flagged successfully with context.`, stall });
});

// â”€â”€ Admin Manage Action 4: Stall Discontinue [with context] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/manage/discontinue', requireAdminMiddleware, (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Context/reason for stall discontinuation is required' });
  }

  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const cleanReason = reason.trim();
  stall.status = 'discontinued';
  stall.discontinue_reason = cleanReason;
  stall.discontinued_at = new Date().toISOString();

  // Send high priority notification to coordinator and members
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: stall.id,
    title: `ðŸ›‘ STALL DISCONTINUED: ${stall.name}`,
    message: `This stall has been formally discontinued by Administrator. Context: ${cleanReason}`,
    type: 'warning',
    created_by: req.user.id,
    read_by: [],
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_DISCONTINUED', 'STALL', stall.id,
    `Admin discontinued stall "${stall.name}". Context: ${cleanReason}`
  );

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });
  realtime.broadcast('NOTIFICATION_CREATED', { notification: notif });

  res.json({ success: true, message: `Stall "${stall.name}" has been discontinued.`, stall });
});


// â”€â”€ Expense logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/:stallId/expenses', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can log expenses' });
  }

  const { category, name, amount } = req.body;
  if (!name || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid expense name and positive amount are required' });
  }

  const newExpense = {
    id: 'exp-' + uuidv4().slice(0, 8),
    stall_id: stall.id,
    category: category || 'General Expense',
    name: name.trim(),
    amount: Math.round(Number(amount)),
    logged_by: req.user.id,
    timestamp: new Date().toISOString()
  };

  (db.data.stall_expenses = db.data.stall_expenses || []).push(newExpense);
  db.logAudit(
    req.user.id, req.user.name,
    'EXPENSE_LOGGED', 'STALL_EXPENSE', newExpense.id,
    `Logged â‚¹${newExpense.amount} under "${newExpense.category}" for "${stall.name}": ${newExpense.name}`
  );

  db.save();

  const updatedFinancials = calculateStallFinancials(stall.id, db.data);
  realtime.broadcast('EXPENSE_ADDED', { expense: newExpense, stall_id: stall.id, financials: updatedFinancials });

  res.status(201).json({ expense: newExpense, financials: updatedFinancials });
});

// â”€â”€ POS Catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/:stallId/catalog', (req, res) => {
  const catalog = (db.data.pos_catalog || []).filter(c => c.stall_id === req.params.stallId);
  res.json({ catalog });
});

// Add item to catalog
router.post('/:stallId/catalog', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can manage catalog items' });
  }

  const { name, price, category } = req.body;
  if (!name || !price || isNaN(price) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Item name and a positive price are required' });
  }

  const newItem = {
    id: 'cat-' + uuidv4().slice(0, 8),
    stall_id: stall.id,
    name: name.trim(),
    price: Math.round(Number(price)),
    category: category || 'Standard'
  };

  (db.data.pos_catalog = db.data.pos_catalog || []).push(newItem);
  db.save();

  res.status(201).json({ item: newItem });
});

// Delete catalog item
router.delete('/:stallId/catalog/:itemId', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can manage catalog items' });
  }

  const idx = (db.data.pos_catalog || []).findIndex(
    c => c.id === req.params.itemId && c.stall_id === stall.id
  );
  if (idx === -1) return res.status(404).json({ error: 'Catalog item not found' });

  db.data.pos_catalog.splice(idx, 1);
  db.save();

  res.json({ message: 'Item removed from catalog.' });
});

// â”€â”€ Stall Team Members Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Add a team member to the stall (by Coordinator or Admin)
router.post('/:stallId/members', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can add team members to this stall' });
  }

  const { name, phone, designation, badge_code, email } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Member full name is required' });
  }

  // Generate unique badge code and member ID
  const memberId = 'usr-mbr-' + uuidv4().slice(0, 8);
  const badge = badge_code && badge_code.trim()
    ? badge_code.trim().toUpperCase()
    : `M-${Math.floor(1000 + Math.random() * 9000)}`;

  const newMember = {
    id: memberId,
    name: name.trim(),
    email: email ? email.trim() : `${name.trim().toLowerCase().replace(/\s+/g, '.')}.${Math.floor(100 + Math.random() * 900)}@stall.vertex`,
    role: 'member',
    stall_id: stall.id,
    phone: phone ? phone.trim() : null,
    designation: designation ? designation.trim() : 'Team Member',
    badge_code: badge,
    created_at: new Date().toISOString()
  };

  db.data.users.push(newMember);
  db.logAudit(
    req.user.id, req.user.name,
    'MEMBER_ADDED_TO_STALL', 'STALL', stall.id,
    `${req.user.name} added member "${newMember.name}" (${newMember.designation}) with badge ${newMember.badge_code} to stall "${stall.name}".`
  );

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall_id: stall.id });

  res.status(201).json({ member: newMember, message: 'Member added to stall team successfully.' });
});

// Remove a team member from the stall (by Coordinator or Admin)
router.delete('/:stallId/members/:memberId', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can remove team members from this stall' });
  }

  const member = db.data.users.find(u => u.id === req.params.memberId && u.stall_id === stall.id);
  if (!member) return res.status(404).json({ error: 'Member not found in this stall' });

  // Unlink member from stall
  member.stall_id = null;
  member.role = 'pending_member';
  db.save();

  db.logAudit(
    req.user.id, req.user.name,
    'MEMBER_REMOVED_FROM_STALL', 'STALL', stall.id,
    `${req.user.name} removed member "${member.name}" from stall "${stall.name}".`
  );

  realtime.broadcast('STALL_UPDATED', { stall_id: stall.id });

  res.json({ message: 'Member removed from stall.' });
});

export default router;

