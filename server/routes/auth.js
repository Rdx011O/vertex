import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { generateInviteCode } from '../db.js';
import { requireAuth, requireAdminMiddleware, isAdminEmail } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

/**
 * POST /api/auth/register-profile
 * Called by the frontend immediately after Firebase signup.
 * Creates a user profile in the DB, linked to their Firebase UID.
 * Supports instant role assignment: Admin, Coordinator (with new stall), or Member.
 */
router.post('/register-profile', async (req, res) => {
  try {
    // Wait for Firestore to finish loading (important on Vercel cold starts)
    await db.ready();

    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
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
    const isBootstrapAdmin = isAdminEmail(userEmail);

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
      if (!Array.isArray(db.data.stalls)) db.data.stalls = [];
      db.data.stalls.push(newStall);
      assignedStallId = stallId;

      db.logAudit(
        uid, name.trim(),
        'STALL_CREATED', 'STALL', stallId,
        `Stall "${newStall.name}" created by coordinator ${name.trim()} (Invite Code: ${inviteCode}).`
      );

      realtime.broadcast('STALL_CREATED', { stall: newStall });
    } else if (desired_role === 'member') {
      role = 'member';
      const rawInviteCode = (req.body.invite_code || req.body.stall_code || '').trim();
      const directStallId = (req.body.stall_id || '').trim();
      
      let targetStall = null;
      if (directStallId) {
        targetStall = (db.data.stalls || []).find(s => s.id === directStallId);
      }
      if (!targetStall && rawInviteCode) {
        targetStall = (db.data.stalls || []).find(
          s => s.invite_code && s.invite_code.trim().toLowerCase() === rawInviteCode.toLowerCase()
        );
      }
      if (targetStall) {
        assignedStallId = targetStall.id;
      }
    }

    // Create or update profile
    let user = db.getUserByUid(uid) || (email ? db.getUserByEmail(email) : null);
    if (user) {
      const updates = {
        id: uid,
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
      await db.save();
      const stall = user.stall_id ? (db.data.stalls || []).find(s => s.id === user.stall_id) : null;
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

    await db.save();

    db.logAudit(uid, name, 'USER_REGISTERED', 'USER', uid, `New user registered: ${email} (${role})${college_name ? ` from ${college_name}` : ''}${stall_alloted_number ? `, stall #${stall_alloted_number}` : ''}`);

    const stall = user.stall_id ? (db.data.stalls || []).find(s => s.id === user.stall_id) : null;
    res.status(201).json({
      user: { ...user, stall_name: stall?.name || null }
    });
  } catch (err) {
    console.error('[Auth Error] /register-profile:', err);
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

/**
 * GET/POST /api/auth/verify-stall-code
 * Validates a 12-char coordinator stall invite code and returns stall details
 */
router.all('/verify-stall-code', async (req, res) => {
  try {
    await db.ready();
    const code = ((req.query.code || req.body.code || req.body.invite_code || '')).trim();
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Please enter a stall invite code.' });
    }

    const stalls = Array.isArray(db.data?.stalls) ? db.data.stalls : [];
    const users = Array.isArray(db.data?.users) ? db.data.users : [];

    const stall = stalls.find(
      s => s.invite_code && s.invite_code.trim().toLowerCase() === code.toLowerCase()
    );

    if (!stall) {
      return res.status(404).json({
        valid: false,
        error: 'No stall found matching this invite code. Please check the 12-character code with your Stall Coordinator.'
      });
    }

    const coordinator = users.find(u => u.id === stall.coordinator_user_id);

    return res.json({
      valid: true,
      stall: {
        id: stall.id,
        name: stall.name,
        category: stall.category || 'General',
        allotted_number: stall.allotted_number || null,
        location: stall.location || 'Festival Courtyard',
        coordinator_name: coordinator ? coordinator.name : 'Stall Coordinator'
      }
    });
  } catch (err) {
    console.error('[Verify Stall Code Error]:', err);
    return res.status(500).json({ valid: false, error: 'Failed to verify stall code.' });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile + stall info.
 */
router.get('/me', async (req, res) => {
  try {
    // Must have a valid Firebase token
    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    // Wait for Firestore to finish loading (critical on Vercel cold starts)
    await db.ready();

    const uid = req.firebaseUser?.uid;
    const email = (req.firebaseUser?.email || '').trim().toLowerCase();
    if (!uid) return res.status(401).json({ error: 'Authentication required.' });

    let user = db.getUserByUid(uid);

    // If not found by UID, check by email
    if (!user && email) {
      user = db.getUserByEmail(email);
      if (user) {
        user.id = uid;
        await db.save();
      }
    }

    // Auto-provision admin if email matches admin list
    const isBootstrapAdmin = isAdminEmail(email);
    if (!user && isBootstrapAdmin) {
      user = db.createUser({
        id: uid,
        name: req.firebaseUser.name || 'System Administrator',
        email,
        role: 'admin',
        designation: 'System Administrator',
        badge_code: `BP-ADM-${uid.slice(0, 4).toUpperCase()}`
      });
      await db.save();
    } else if (user && isBootstrapAdmin && user.role !== 'admin') {
      user = db.updateUser(user.id, { role: 'admin', designation: 'System Administrator' });
      await db.save();
    }

    // Auto-provision fallback user profile if missing from database (defaulting safely to member)
    if (!user) {
      const fallbackName = req.firebaseUser.name || (email ? email.split('@')[0] : 'Participant');
      user = db.createUser({
        id: uid,
        name: fallbackName,
        email: email || '',
        role: 'member',
        designation: 'Team Member',
        college_name: 'Pravara Rural Engineering College, Loni',
        badge_code: `BP-MBR-${uid.slice(0, 4).toUpperCase()}`
      });
      await db.save();
    }

    // Ensure coordinator is linked to their stall or has a stall created
    if (user.role === 'coordinator') {
      let stall = user.stall_id ? (db.data.stalls || []).find(s => s.id === user.stall_id) : null;
      if (!stall) {
        stall = (db.data.stalls || []).find(s => s.coordinator_user_id === user.id);
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
          if (!Array.isArray(db.data.stalls)) db.data.stalls = [];
          db.data.stalls.push(stall);
        }
        user = db.updateUser(user.id, { stall_id: stall.id, role: 'coordinator', designation: 'Stall Coordinator' });
        await db.save();
      }
    }

    const stall = user.stall_id ? (db.data.stalls || []).find(s => s.id === user.stall_id) : null;
    res.json({
      user: {
        ...user,
        stall_name: stall?.name || null,
        stall_category: stall?.category || null
      }
    });
  } catch (err) {
    console.error('[Auth Error] /me:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve profile.' });
  }
});

/**
 * POST /api/auth/claim-role
 * Allows an authenticated Firebase user to directly claim Admin or create their Coordinator stall
 */
router.post('/claim-role', async (req, res) => {
  try {
    await db.ready();
    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const { role, stall_name, stall_category, booth_number } = req.body;
    const uid = req.firebaseUser.uid;
    const email = (req.firebaseUser.email || '').trim().toLowerCase();
    const displayName = req.firebaseUser.name || req.body.name || email.split('@')[0] || 'User';

    let user = db.getUserByUid(uid) || (email ? db.getUserByEmail(email) : null);

    if (role === 'admin') {
      if (!user) {
        user = db.createUser({
          id: uid,
          name: displayName,
          email,
          role: 'admin',
          designation: 'System Administrator'
        });
      } else {
        user = db.updateUser(user.id, { role: 'admin', designation: 'System Administrator' });
      }
      await db.save();
      return res.json({ user });
    }

    if (role === 'coordinator') {
      if (!user) {
        user = db.createUser({
          id: uid,
          name: displayName,
          email,
          role: 'coordinator',
          designation: 'Stall Coordinator'
        });
      }

      let stall = user.stall_id ? (db.data.stalls || []).find(s => s.id === user.stall_id) : null;
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
        if (!Array.isArray(db.data.stalls)) db.data.stalls = [];
        db.data.stalls.push(stall);
      }

      user = db.updateUser(user.id, { role: 'coordinator', stall_id: stall.id, designation: 'Stall Coordinator' });
      await db.save();
      return res.json({ user: { ...user, stall_name: stall.name, invite_code: stall.invite_code } });
    }

    res.status(400).json({ error: 'Invalid role requested.' });
  } catch (err) {
    console.error('[Auth Error] /claim-role:', err);
    res.status(500).json({ error: err.message || 'Failed to claim role.' });
  }
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
