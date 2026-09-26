import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { generateInviteCode } from '../db.js';
import { requireAuth, requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'aadiyta.battin.ec24@pravaraengg.org.in').trim().toLowerCase();

/**
 * POST /api/auth/register-profile
 * Called by the frontend immediately after Firebase signup.
 * Creates a user profile in the DB, linked to their Firebase UID.
 * If the email matches BOOTSTRAP_ADMIN_EMAIL or Admin role is selected, they get 'admin' role instantly.
 * If Coordinator role is selected, their stall is automatically created with a permanent 12-digit invite code!
 */
router.post('/register-profile', async (req, res) => {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const {
    name, phone, desired_role,
    username,
    college_name,
    stall_name_desired,
    stall_category_desired,
    stall_alloted_number
  } = req.body;
  const { uid, email } = req.firebaseUser;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  // Determine initial role and handle automatic stall creation for coordinator
  let role = 'pending';
  let assignedStallId = null;
  const hasExistingAdmin = db.data.users.some(u => u.role === 'admin');
  const userEmail = (email || '').trim().toLowerCase();
  const isBootstrapAdmin = userEmail && (userEmail === BOOTSTRAP_ADMIN_EMAIL || userEmail.includes('battin.ec24@pravaraengg'));

  // Admin gets direct instant access with no waiting list
  if (desired_role === 'admin' || isBootstrapAdmin || !hasExistingAdmin) {
    role = 'admin';
  } else if (desired_role === 'coordinator') {
    role = 'coordinator'; // Coordinator gets direct access to their new stall
    
    // Auto-create stall for coordinator with permanent 12-char invite code
    const stallId = 'stl-' + uuidv4().slice(0, 8);
    const inviteCode = generateInviteCode();
    const newStall = {
      id: stallId,
      name: (stall_name_desired || `${name.trim()}'s Stall`).trim(),
      category: stall_category_desired || 'Tech & Gaming',
      event_id: 'ev-bp-2026',
      coordinator_user_id: uid,
      status: 'active',
      banner_color: '#4F46E5',
      location: stall_alloted_number ? `Booth ${stall_alloted_number}` : 'Main Courtyard',
      allotted_number: stall_alloted_number || null,
      invite_code: inviteCode,
      created_at: new Date().toISOString()
    };
    db.data.stalls.push(newStall);
    assignedStallId = stallId;

    db.logAudit(
      uid, name.trim(),
      'STALL_CREATED', 'STALL', stallId,
      `Stall "${newStall.name}" created by coordinator ${name.trim()} (Invite Code: ${inviteCode}).`
    );

    realtime.broadcast('STALL_CREATED', { stall: newStall });
  } else if (desired_role === 'member') {
    const rawInviteCode = (req.body.invite_code || req.body.stall_code || '').trim();
    if (rawInviteCode) {
      const targetStall = db.data.stalls.find(s => s.invite_code === rawInviteCode);
      if (targetStall) {
        role = 'member';
        assignedStallId = targetStall.id;
      } else {
        role = 'pending_member';
      }
    } else {
      role = 'pending_member'; // member will enter stall invite code in join screen
    }
  }

  // Create or return existing profile
  let user = db.getUserByUid(uid);
  if (user) {
    const updates = {};
    if (desired_role === 'admin' || isBootstrapAdmin || user.role === 'pending_admin' || (!hasExistingAdmin && user.role === 'pending')) {
      updates.role = 'admin';
      updates.designation = user.designation || 'System Administrator';
    } else if (desired_role === 'coordinator' && assignedStallId) {
      updates.role = 'coordinator';
      updates.stall_id = assignedStallId;
      updates.designation = 'Stall Coordinator';
    } else if (desired_role === 'member' && assignedStallId) {
      updates.role = 'member';
      updates.stall_id = assignedStallId;
      updates.designation = user.designation || 'Team Member';
    }
    if (Object.keys(updates).length > 0) {
      user = db.updateUser(uid, updates);
    }
    const stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
    return res.json({
      user: { ...user, stall_name: stall?.name || null }
    });
  }

  user = db.createUser({
    id: uid,
    name: name.trim(),
    email,
    role,
    phone: phone || null,
    designation: role === 'admin' ? 'System Administrator' : (role === 'coordinator' ? 'Stall Coordinator' : null),
    username: username ? username.trim() : null,
    college_name: college_name || null,
    stall_name_desired: stall_name_desired || null,
    stall_category_desired: stall_category_desired || null,
    stall_alloted_number: stall_alloted_number || null
  });

  if (assignedStallId) {
    user = db.updateUser(uid, { stall_id: assignedStallId });
  }

  db.logAudit(uid, name, 'USER_REGISTERED', 'USER', uid, `New user registered: ${email} (${role})${college_name ? ` from ${college_name}` : ''}${stall_alloted_number ? `, stall #${stall_alloted_number}` : ''}`);

  const stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
  res.status(201).json({
    user: { ...user, stall_name: stall?.name || null }
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile + stall info.
 */
router.get('/me', requireAuth, (req, res) => {
  let user = req.user;
  const hasExistingAdmin = db.data.users.some(u => u.role === 'admin' && u.id !== user.id);
  const userEmail = (user.email || '').trim().toLowerCase();
  const isBootstrapAdmin = userEmail && (userEmail === BOOTSTRAP_ADMIN_EMAIL || userEmail.includes('battin.ec24@pravaraengg'));

  // If user was pending admin or matches bootstrap email, promote directly to admin
  if (user.role === 'pending_admin' || isBootstrapAdmin || (!hasExistingAdmin && user.role === 'pending')) {
    user = db.updateUser(user.id, { role: 'admin', designation: user.designation || 'System Administrator' });
    db.logAudit(user.id, user.name, 'USER_ROLE_ASSIGNED', 'USER', user.id, `Promoted ${user.email} to admin.`);
  }

  // Ensure coordinator is linked to their stall or has a stall created
  if (user.role === 'coordinator') {
    let stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
    if (!stall) {
      stall = db.data.stalls.find(s => s.coordinator_user_id === user.id);
      if (!stall) {
        const stallId = 'stl-' + uuidv4().slice(0, 8);
        const inviteCode = generateInviteCode();
        stall = {
          id: stallId,
          name: (user.stall_name_desired || `${user.name}'s Stall`).trim(),
          category: user.stall_category_desired || 'Tech & Gaming',
          event_id: 'ev-bp-2026',
          coordinator_user_id: user.id,
          status: 'active',
          banner_color: '#4F46E5',
          location: user.stall_alloted_number ? `Booth ${user.stall_alloted_number}` : 'Main Courtyard',
          allotted_number: user.stall_alloted_number || null,
          invite_code: inviteCode,
          created_at: new Date().toISOString()
        };
        db.data.stalls.push(stall);
      }
      user = db.updateUser(user.id, { stall_id: stall.id });
      db.save();
    }
  }

  const stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
  res.json({
    user: {
      ...user,
      stall_name: stall?.name || null,
      stall_category: stall?.category || null
    }
  });
});

/**
 * POST /api/auth/claim-role
 * Allows an authenticated user to directly claim Admin (if eligible) or create their Coordinator stall
 */
router.post('/claim-role', requireAuth, (req, res) => {
  const { role, stall_name, stall_category, booth_number } = req.body;
  const user = req.user;

  if (role === 'admin') {
    const updated = db.updateUser(user.id, { role: 'admin', designation: 'System Administrator' });
    db.save();
    return res.json({ user: updated });
  }

  if (role === 'coordinator') {
    let stall = user.stall_id ? db.data.stalls.find(s => s.id === user.stall_id) : null;
    if (!stall) {
      const stallId = 'stl-' + uuidv4().slice(0, 8);
      const inviteCode = generateInviteCode();
      stall = {
        id: stallId,
        name: (stall_name || `${user.name}'s Stall`).trim(),
        category: stall_category || 'Tech & Gaming',
        event_id: 'ev-bp-2026',
        coordinator_user_id: user.id,
        status: 'active',
        banner_color: '#4F46E5',
        location: booth_number ? `Booth ${booth_number}` : 'Main Courtyard',
        allotted_number: booth_number || null,
        invite_code: inviteCode,
        created_at: new Date().toISOString()
      };
      db.data.stalls.push(stall);
    }
    const updated = db.updateUser(user.id, {
      role: 'coordinator',
      stall_id: stall.id,
      designation: 'Stall Coordinator'
    });
    db.save();
    return res.json({
      user: { ...updated, stall_name: stall.name, stall_category: stall.category }
    });
  }

  res.status(400).json({ error: 'Invalid role requested.' });
});

/**
 * PATCH /api/auth/profile
 * Lets an authenticated user update their own name/phone/designation.
 */
router.patch('/profile', requireAuth, (req, res) => {
  const { name, phone, designation } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone;
  if (designation !== undefined) updates.designation = designation;

  const user = db.updateUser(req.user.id, updates);
  res.json({ user });
});

// ---- Admin-only endpoints -------------------------------------------------------

/**
 * GET /api/auth/users
 * Admin: list all registered users.
 */
router.get('/users', requireAdminMiddleware, (req, res) => {
  const usersWithStallInfo = db.data.users.map(u => {
    const stall = u.stall_id ? db.data.stalls.find(s => s.id === u.stall_id) : null;
    return {
      ...u,
      stall_name: stall?.name || null,
      stall_category: stall?.category || null
    };
  });
  res.json({ users: usersWithStallInfo });
});

/**
 * PATCH /api/auth/users/:uid/role
 * Admin: assign role and optionally assign to a stall.
 * Body: { role: 'coordinator'|'member'|'admin'|'pending', stall_id?: string }
 */
router.patch('/users/:uid/role', requireAdminMiddleware, (req, res) => {
  const { uid } = req.params;
  const { role, stall_id, designation } = req.body;

  const validRoles = ['admin', 'coordinator', 'member', 'pending'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const targetUser = db.getUserByUid(uid);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const updates = { role };
  if (stall_id !== undefined) updates.stall_id = stall_id || null;
  if (designation !== undefined) updates.designation = designation;

  const updatedUser = db.updateUser(uid, updates);

  db.logAudit(
    req.user.id, req.user.name,
    'USER_ROLE_ASSIGNED', 'USER', uid,
    `Assigned role '${role}' to ${targetUser.email}${stall_id ? ` at stall ${stall_id}` : ''}.`
  );

  const stall = updatedUser.stall_id ? db.data.stalls.find(s => s.id === updatedUser.stall_id) : null;
  res.json({ user: { ...updatedUser, stall_name: stall?.name || null } });
});

/**
 * DELETE /api/auth/users/:uid
 * Admin: remove a user profile from the DB (does NOT delete their Firebase Auth account).
 */
router.delete('/users/:uid', requireAdminMiddleware, (req, res) => {
  const { uid } = req.params;
  const targetUser = db.getUserByUid(uid);
  if (!targetUser) return res.status(404).json({ error: 'User not found.' });

  db.data.users = db.data.users.filter(u => u.id !== uid);
  db.save();

  db.logAudit(req.user.id, req.user.name, 'USER_REMOVED', 'USER', uid, `Removed user profile: ${targetUser.email}`);
  res.json({ message: 'User profile removed.' });
});

export default router;
