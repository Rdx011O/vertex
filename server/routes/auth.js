import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { generateInviteCode } from '../db.js';
import { requireAuth, requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ? process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase() : null;

/**
 * POST /api/auth/register-profile
 * Called by the frontend immediately after Firebase signup.
 * Creates a user profile in the DB, linked to their Firebase UID.
 * Supports instant role assignment: Admin, Coordinator (with new stall), or Member.
 */
router.post('/register-profile', async (req, res) => {
  // Wait for Firestore to finish loading (important on Vercel cold starts)
  await db.ready();

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
  let role = 'pending_member';
  let assignedStallId = null;
  const userEmail = (email || '').trim().toLowerCase();
  const isBootstrapAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL && userEmail === BOOTSTRAP_ADMIN_EMAIL);

  if (desired_role === 'admin' || isBootstrapAdmin) {
    role = 'admin';
  } else if (desired_role === 'coordinator') {
    role = 'coordinator';
    
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
      role = 'pending_member';
    }
  }

  // Create or update profile
  let user = db.getUserByUid(uid);
  if (user) {
    const updates = {
      name: name.trim(),
      role,
      phone: phone || user.phone,
      college_name: college_name || user.college_name,
      username: username ? username.trim() : user.username
    };
    if (role === 'admin') {
      updates.designation = 'System Administrator';
    } else if (role === 'coordinator') {
      updates.designation = 'Stall Coordinator';
      if (assignedStallId) updates.stall_id = assignedStallId;
    } else if (role === 'member' && assignedStallId) {
      updates.designation = 'Team Member';
      updates.stall_id = assignedStallId;
    }
    user = db.updateUser(uid, updates);
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
    designation: role === 'admin' ? 'System Administrator' : (role === 'coordinator' ? 'Stall Coordinator' : 'Participant'),
    username: username ? username.trim() : null,
    college_name: college_name || 'Pravara Rural Engineering College, Loni',
    stall_name_desired: stall_name_desired || null,
    stall_category_desired: stall_category_desired || null,
    stall_alloted_number: stall_alloted_number || null,
    badge_code: `BP-${role === 'admin' ? 'ADM' : (role === 'coordinator' ? 'CRD' : 'MBR')}-${uid.slice(0, 4).toUpperCase()}`
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
router.get('/me', requireAuth, async (req, res) => {
  // Wait for Firestore to finish loading (important on Vercel cold starts)
  await db.ready();

  // Re-fetch user from DB after Firestore is loaded (middleware ran before Firestore init)
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required.' });

  let user = db.getUserByUid(uid);
  if (!user) {
    return res.status(404).json({ error: 'Profile not found. Please register.' });
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  const isBootstrapAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL && userEmail === BOOTSTRAP_ADMIN_EMAIL);

  if (isBootstrapAdmin && user.role !== 'admin') {
    user = db.updateUser(user.id, { role: 'admin', designation: 'System Administrator' });
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
 * Allows an authenticated user to directly claim Admin or create their Coordinator stall
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
