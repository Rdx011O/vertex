/**
 * Auth Routes
 * Handles profile creation, self-profile fetch, and admin role assignment.
 */

import express from 'express';
import db from '../db.js';
import { requireAuth, requireAdminMiddleware } from '../rbac.js';

const router = express.Router();

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || '';

/**
 * POST /api/auth/register-profile
 * Called by the frontend immediately after Firebase signup.
 * Creates a user profile in the DB, linked to their Firebase UID.
 * If the email matches BOOTSTRAP_ADMIN_EMAIL, they get 'admin' role instantly.
 */
router.post('/register-profile', async (req, res) => {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { name, phone, desired_role } = req.body;
  const { uid, email } = req.firebaseUser;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  // Determine initial role
  let role = 'pending';
  const hasExistingAdmin = db.data.users.some(u => u.role === 'admin');
  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAIL && email && email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

  if (isBootstrapAdmin || (!hasExistingAdmin && desired_role === 'admin')) {
    role = 'admin';
  } else if (desired_role === 'coordinator') {
    role = 'pending_coordinator'; // needs admin to confirm + assign stall
  } else if (desired_role === 'member') {
    role = 'pending_member'; // needs admin to assign to a stall
  }

  // Create or return existing profile
  let user = db.getUserByUid(uid);
  if (user) {
    // If user exists and matches bootstrap email or needs admin role and no admin exists, upgrade them
    if (user.role !== 'admin' && (isBootstrapAdmin || (!hasExistingAdmin && desired_role === 'admin'))) {
      user = db.updateUser(uid, { role: 'admin' });
      db.logAudit(uid, user.name, 'USER_ROLE_ASSIGNED', 'USER', uid, `Auto-promoted ${email} to admin.`);
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
    designation: role === 'admin' ? 'System Administrator' : null
  });

  db.logAudit(uid, name, 'USER_REGISTERED', 'USER', uid, `New user registered: ${email} (${role})`);

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
  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAIL && user.email && user.email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

  if (user.role !== 'admin' && (isBootstrapAdmin || !hasExistingAdmin)) {
    user = db.updateUser(user.id, { role: 'admin', designation: user.designation || 'System Administrator' });
    db.logAudit(user.id, user.name, 'USER_ROLE_ASSIGNED', 'USER', user.id, `Auto-promoted ${user.email} to admin.`);
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
