import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import db from '../db.js';
import { requireAuth } from '../rbac.js';
import realtime from '../ws.js';
import { saveQRBadgeToFirebase, saveAttendanceToFirebase } from '../firebase-admin.js';

const router = express.Router();

/**
 * Generates or retrieves the unique QR badge for a user, saves it to Firebase Firestore, and returns metadata.
 */
export async function getOrCreateUserQRBadge(user) {
  if (!user) return null;

  const stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
  const stallSlice = stall ? stall.id.replace('stl-', '') : 'gen';
  const userSlice = (user.id || '').slice(0, 6).toUpperCase();

  // Distinct badge codes for coordinator vs member:
  // Coordinator: COORD-{stallSlice}-{userSlice}
  // Member: MBR-{stallSlice}-{userSlice}
  let badgeCode = user.badge_code;
  const expectedPrefix = user.role === 'coordinator' ? 'COORD' : (user.role === 'member' ? 'MBR' : 'BP');
  if (!badgeCode || !badgeCode.startsWith(expectedPrefix + '-')) {
    badgeCode = `${expectedPrefix}-${stallSlice}-${userSlice}`;
    user.badge_code = badgeCode;
  }

  const qrPayload = `VERTEX:ATTENDANCE:v1:${user.id}:${badgeCode}:${user.role}:${user.stall_id || 'none'}`;

  // Generate standard scannable QR code image data URL (High error correction H)
  let qrImageUrl = user.qr_image_url;
  if (!qrImageUrl || user.qr_payload !== qrPayload) {
    try {
      qrImageUrl = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: user.role === 'coordinator' ? '#312E81' : '#0F172A',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });
      user.qr_image_url = qrImageUrl;
      user.qr_payload = qrPayload;
      db.save();
    } catch (err) {
      console.error('QR generation error:', err);
    }
  }

  // Sync to Firebase Firestore asynchronously
  const badgeData = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    stall_id: user.stall_id || null,
    stall_name: stall?.name || null,
    badge_code: badgeCode,
    qr_payload: qrPayload,
    qr_image_url: qrImageUrl,
    created_at: user.created_at || new Date().toISOString(),
    last_synced: new Date().toISOString()
  };

  saveQRBadgeToFirebase(badgeData).catch(err => console.warn('Firestore badge write warning:', err.message));

  return {
    badge_code: badgeCode,
    qr_payload: qrPayload,
    qr_image_url: qrImageUrl,
    user,
    stall
  };
}

// ── GET /api/attendance/qr-badge/:userId? ────────────────────────────────────
// Returns the unique QR badge for the requesting user (or target user for coordinator/admin)
router.get('/qr-badge/:userId?', requireAuth, async (req, res) => {
  const targetId = req.params.userId || req.user.id;
  const user = db.getUserByUid(targetId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Permission check: only admin, coordinator of same stall, or the user themselves can view badge
  if (req.user.role !== 'admin' && req.user.id !== user.id) {
    if (req.user.role !== 'coordinator' || req.user.stall_id !== user.stall_id) {
      return res.status(403).json({ error: 'Unauthorized to access this QR badge' });
    }
  }

  const badgeInfo = await getOrCreateUserQRBadge(user);
  res.json({ badge: badgeInfo });
});

// ── GET /api/attendance/stall/:stallId ─────────────────────────────────────────
// Get attendance stats and list for a stall
router.get('/stall/:stallId', (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  const members = db.data.users.filter(u => u.stall_id === stall.id && u.role === 'member');
  const coordinator = stall.coordinator_user_id ? db.data.users.find(u => u.id === stall.coordinator_user_id) : null;
  const records = db.data.attendance_records.filter(a => a.stall_id === stall.id);

  // Coordinator attendance status
  let coordinatorStatus = null;
  if (coordinator) {
    const coordRecord = records.find(r => r.member_user_id === coordinator.id);
    coordinatorStatus = {
      coordinator_id: coordinator.id,
      name: coordinator.name,
      email: coordinator.email,
      phone: coordinator.phone,
      badge_code: coordinator.badge_code,
      status: coordRecord ? coordRecord.status : 'not_checked_in',
      timestamp: coordRecord ? coordRecord.timestamp : null,
      verified_method: coordRecord ? coordRecord.verified_method : null
    };
  }

  // Group by member for latest status
  const memberStatuses = members.map(m => {
    const record = records.find(r => r.member_user_id === m.id);
    const confirmedBy = record && record.confirmed_by_user_id
      ? db.data.users.find(u => u.id === record.confirmed_by_user_id)
      : null;

    return {
      member_id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      designation: m.designation,
      badge_code: m.badge_code,
      attendance_id: record ? record.id : null,
      status: record ? record.status : 'not_checked_in',
      confirmed_by: confirmedBy ? confirmedBy.name : null,
      timestamp: record ? record.timestamp : null,
      verified_method: record ? record.verified_method : null
    };
  });

  const confirmedCount = memberStatuses.filter(m => m.status === 'confirmed').length;
  const pendingCount = memberStatuses.filter(m => m.status === 'pending_coordinator').length;
  const attendanceRate = members.length > 0 ? Math.round((confirmedCount / members.length) * 100) : 0;

  res.json({
    stall_id: stall.id,
    stall_name: stall.name,
    coordinator: coordinatorStatus,
    total_members: members.length,
    confirmed_count: confirmedCount,
    pending_count: pendingCount,
    attendance_rate: attendanceRate,
    members: memberStatuses
  });
});

// ── POST /api/attendance/checkin-request ───────────────────────────────────────
// Member: Tap "I'm at my stall"
router.post('/checkin-request', requireAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'member') {
    return res.status(400).json({ error: 'Only stall members can raise check-in requests' });
  }

  if (!req.user.stall_id) {
    return res.status(400).json({ error: 'User is not assigned to any stall' });
  }

  const stall = db.data.stalls.find(s => s.id === req.user.stall_id);
  if (!stall) {
    return res.status(404).json({ error: 'Assigned stall not found' });
  }

  // Check if member already has confirmed or pending attendance
  const existingRecord = db.data.attendance_records.find(
    a => a.member_user_id === req.user.id && a.stall_id === stall.id
  );

  if (existingRecord) {
    if (existingRecord.status === 'confirmed') {
      return res.status(200).json({
        attendance: existingRecord,
        status: 'confirmed',
        message: 'Your attendance is already confirmed for this session.'
      });
    } else if (existingRecord.status === 'pending_coordinator') {
      return res.status(200).json({
        attendance: existingRecord,
        status: 'pending_coordinator',
        message: 'Your check-in request is already pending your Coordinator\'s approval.'
      });
    }
  }

  const newRecord = {
    id: 'att-' + uuidv4().slice(0, 8),
    member_user_id: req.user.id,
    stall_id: stall.id,
    role: 'member',
    status: 'pending_coordinator',
    confirmed_by_user_id: null,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    verified_method: 'LOCATION_REQUEST'
  };

  db.data.attendance_records.push(newRecord);

  // Notify the Stall Coordinator
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: stall.id,
    title: 'Arrival Check-in Alert',
    message: `${req.user.name} reported arrival at ${stall.name} and is waiting for your confirmation.`,
    type: 'attendance_request',
    created_by: req.user.id,
    read_by: [],
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.save();

  // Save to Firebase
  saveAttendanceToFirebase(newRecord).catch(() => {});

  // Real-time broadcast to coordinator view
  realtime.broadcast('ATTENDANCE_REQUESTED', {
    attendance: newRecord,
    member: {
      id: req.user.id,
      name: req.user.name,
      badge_code: req.user.badge_code
    },
    stall_id: stall.id,
    stall_name: stall.name
  });

  res.status(201).json({
    attendance: newRecord,
    status: 'pending_coordinator',
    message: 'Check-in request sent! Your Stall Coordinator will confirm your presence.'
  });
});

// ── POST /api/attendance/:attendanceId/confirm ────────────────────────────────
// Stall Coordinator: Confirm attendance for a member manually
router.post('/:attendanceId/confirm', requireAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const record = db.data.attendance_records.find(a => a.id === req.params.attendanceId);
  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
  }

  const stall = db.data.stalls.find(s => s.id === record.stall_id);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  // Accountability enforcement: Only this stall's coordinator or admin can confirm member attendance
  if (req.user.id === record.member_user_id && record.role === 'member') {
    return res.status(403).json({ error: 'Accountability violation: Members cannot self-approve their own attendance.' });
  }

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || stall.coordinator_user_id !== req.user.id)) {
    return res.status(403).json({
      error: 'Accountability violation: Only this stall\'s own Coordinator can confirm member attendance.'
    });
  }

  record.status = 'confirmed';
  record.confirmed_by_user_id = req.user.id;
  record.timestamp = new Date().toISOString();
  record.verified_method = req.body.method || 'COORDINATOR_CONFIRMED';

  const member = db.data.users.find(u => u.id === record.member_user_id);

  // Save to Firebase
  saveAttendanceToFirebase(record).catch(() => {});

  // Log immutable audit entry
  db.logAudit(
    req.user.id,
    req.user.name,
    'ATTENDANCE_CONFIRMED',
    'ATTENDANCE',
    record.id,
    `Coordinator confirmed attendance for ${member ? member.name : record.member_user_id} at "${stall.name}".`
  );

  // Send confirmation notification to member
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'member',
    target_scope_id: record.member_user_id,
    title: 'Attendance Confirmed ✅',
    message: `Your check-in at ${stall.name} was confirmed by ${req.user.name}.`,
    type: 'attendance_confirmed',
    created_by: req.user.id,
    read_by: [],
    created_at: new Date().toISOString()
  };
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.unshift(notif);

  db.save();

  // Broadcast realtime update
  realtime.broadcast('ATTENDANCE_CONFIRMED', {
    attendance: record,
    member_id: record.member_user_id,
    member_name: member ? member.name : 'Team Member',
    stall_id: stall.id,
    confirmed_by_name: req.user.name
  });

  res.json({
    attendance: record,
    member_name: member ? member.name : null,
    message: `Attendance confirmed for ${member ? member.name : 'member'}.`
  });
});

// ── POST /api/attendance/scan-confirm ─────────────────────────────────────────
// Direct QR Scan Engine: Marks Member attendance by Coordinator, AND Coordinator attendance by Coordinator/Admin!
router.post('/scan-confirm', requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { qr_payload, badge_code, member_id, raw_scan } = req.body;
  const scanInput = (raw_scan || qr_payload || badge_code || member_id || '').trim();

  if (!scanInput) {
    return res.status(400).json({ error: 'Please scan a valid QR Code or enter a Badge Code.' });
  }

  let targetUser = null;

  // 1. Try parsing structured Vertex QR format: VERTEX:ATTENDANCE:v1:{uid}:{badgeCode}:{role}:{stallId}
  if (scanInput.startsWith('VERTEX:ATTENDANCE:v1:')) {
    const parts = scanInput.split(':');
    const uid = parts[3];
    const badge = parts[4];
    targetUser = db.data.users.find(u => u.id === uid || u.badge_code === badge);
  }

  // 2. Try legacy format or direct badge code lookup
  if (!targetUser) {
    targetUser = db.data.users.find(
      u => u.badge_code === scanInput ||
           u.id === scanInput ||
           (u.badge_code && u.badge_code.toUpperCase() === scanInput.toUpperCase())
    );
  }

  // 3. Fallback partial matching on badge code
  if (!targetUser) {
    targetUser = db.data.users.find(
      u => u.badge_code && scanInput.toUpperCase().includes(u.badge_code.toUpperCase())
    );
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'Invalid QR Code. No registered event participant found matching this badge.' });
  }

  // Determine stall
  let stall = null;
  if (targetUser.stall_id) {
    stall = db.data.stalls.find(s => s.id === targetUser.stall_id);
  }
  if (!stall && targetUser.role === 'coordinator') {
    stall = db.data.stalls.find(s => s.coordinator_user_id === targetUser.id);
  }

  if (!stall && targetUser.role !== 'admin') {
    return res.status(400).json({ error: `${targetUser.name} is not currently assigned to any active stall.` });
  }

  const isCoordinatorScanning = req.user.role === 'coordinator';
  const isAdminScanning = req.user.role === 'admin';
  const isSelfScanning = req.user.id === targetUser.id;

  // ── BRANCH 1: TARGET IS A STALL MEMBER ───────────────────────────────────────
  if (targetUser.role === 'member') {
    // Only the coordinator of this member's stall (or admin) can confirm member attendance
    if (!isAdminScanning && (!isCoordinatorScanning || stall.coordinator_user_id !== req.user.id)) {
      return res.status(403).json({
        error: `Accountability rule: Only the Coordinator for "${stall.name}" can scan and confirm ${targetUser.name}'s attendance.`
      });
    }

    let record = db.data.attendance_records.find(
      a => a.member_user_id === targetUser.id && a.stall_id === stall.id
    );

    if (!record) {
      record = {
        id: 'att-' + uuidv4().slice(0, 8),
        member_user_id: targetUser.id,
        stall_id: stall.id,
        role: 'member',
        date: new Date().toISOString().split('T')[0]
      };
      db.data.attendance_records.push(record);
    }

    record.status = 'confirmed';
    record.confirmed_by_user_id = req.user.id;
    record.timestamp = new Date().toISOString();
    record.verified_method = 'QR_SCAN';

    // Save to Firebase
    saveAttendanceToFirebase(record).catch(() => {});

    db.logAudit(
      req.user.id,
      req.user.name,
      'ATTENDANCE_CONFIRMED',
      'ATTENDANCE',
      record.id,
      `Coordinator scanned badge QR and confirmed attendance for Member ${targetUser.name} (${targetUser.badge_code}) at "${stall.name}".`
    );

    // Send notification to member
    const notif = {
      id: 'notif-' + uuidv4().slice(0, 8),
      target_role: 'member',
      target_scope_id: targetUser.id,
      title: 'Badge Scanned & Confirmed ✅',
      message: `Your badge was scanned by ${req.user.name}. Attendance confirmed!`,
      type: 'attendance_confirmed',
      created_by: req.user.id,
      read_by: [],
      created_at: new Date().toISOString()
    };
    if (!db.data.notifications) db.data.notifications = [];
    db.data.notifications.unshift(notif);

    db.save();

    realtime.broadcast('ATTENDANCE_CONFIRMED', {
      attendance: record,
      member_id: targetUser.id,
      member_name: targetUser.name,
      stall_id: stall.id,
      confirmed_by_name: req.user.name
    });

    return res.json({
      success: true,
      attendance: record,
      user: targetUser,
      stall: { id: stall.id, name: stall.name },
      type: 'MEMBER_ATTENDANCE_CONFIRMED',
      message: `✅ Badge verified! Attendance confirmed for Member ${targetUser.name}.`
    });
  }

  // ── BRANCH 2: TARGET IS A STALL COORDINATOR ─────────────────────────────────
  if (targetUser.role === 'coordinator') {
    // Stall coordinator can mark their own coordinator attendance OR admin can scan coordinator badge
    if (!isAdminScanning && !isSelfScanning && req.user.id !== targetUser.id) {
      return res.status(403).json({
        error: `Only Coordinator ${targetUser.name} or an Admin can mark coordinator attendance.`
      });
    }

    let record = db.data.attendance_records.find(
      a => a.member_user_id === targetUser.id && a.stall_id === stall?.id
    );

    if (!record) {
      record = {
        id: 'att-' + uuidv4().slice(0, 8),
        member_user_id: targetUser.id,
        stall_id: stall ? stall.id : 'gen-stall',
        role: 'coordinator',
        date: new Date().toISOString().split('T')[0]
      };
      db.data.attendance_records.push(record);
    }

    record.status = 'confirmed';
    record.confirmed_by_user_id = req.user.id;
    record.timestamp = new Date().toISOString();
    record.verified_method = isSelfScanning ? 'COORDINATOR_SELF_QR' : 'ADMIN_QR_SCAN';

    // Save to Firebase
    saveAttendanceToFirebase(record).catch(() => {});

    db.logAudit(
      req.user.id,
      req.user.name,
      'ATTENDANCE_CONFIRMED',
      'ATTENDANCE',
      record.id,
      `Stall Coordinator attendance verified via QR badge for ${targetUser.name} (${targetUser.badge_code}) at "${stall ? stall.name : 'Event'}".`
    );

    db.save();

    realtime.broadcast('ATTENDANCE_CONFIRMED', {
      attendance: record,
      member_id: targetUser.id,
      member_name: targetUser.name,
      role: 'coordinator',
      stall_id: stall?.id,
      confirmed_by_name: req.user.name
    });

    return res.json({
      success: true,
      attendance: record,
      user: targetUser,
      stall: stall ? { id: stall.id, name: stall.name } : null,
      type: 'COORDINATOR_ATTENDANCE_CONFIRMED',
      message: `🎉 Coordinator Verified! Attendance confirmed for Stall Coordinator ${targetUser.name}.`
    });
  }

  // ── BRANCH 3: ADMIN ATTENDANCE ──────────────────────────────────────────────
  if (targetUser.role === 'admin') {
    return res.json({
      success: true,
      user: targetUser,
      type: 'ADMIN_CREDENTIAL_VERIFIED',
      message: `👑 Verified Administrator Credential: ${targetUser.name}`
    });
  }

  res.status(400).json({ error: 'Unrecognized participant role for attendance confirmation.' });
});

export default router;
