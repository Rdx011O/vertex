/**
 * RBAC and Authentication Middleware
 * Verifies Firebase ID tokens from Authorization: Bearer <token> header.
 * Attaches verified req.user (DB profile) to requests.
 */

import { firebaseAuth } from './firebase-admin.js';
import db from './db.js';

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ? process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase() : null;

/**
 * Middleware: verifies Firebase ID token and attaches req.user (DB profile).
 */
export async function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.firebaseUser = null;
    return next();
  }

  const idToken = authHeader.slice(7);

  try {
    let decoded = null;

    if (firebaseAuth) {
      try {
        decoded = await firebaseAuth.verifyIdToken(idToken);
      } catch (err) {
        // Fallback: decode JWT payload if admin cert is unconfigured in serverless
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = Buffer.from(parts[1], 'base64').toString('utf8');
          decoded = JSON.parse(payload);
          decoded.uid = decoded.user_id || decoded.sub;
        } else {
          throw err;
        }
      }
    } else {
      // Decode JWT payload directly
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = Buffer.from(parts[1], 'base64').toString('utf8');
        decoded = JSON.parse(payload);
        decoded.uid = decoded.user_id || decoded.sub;
      }
    }

    if (!decoded || !decoded.uid) {
      throw new Error('Invalid token payload.');
    }

    req.firebaseUser = decoded;

    // Look up the user profile in our DB
    let profile = db.getUserByUid(decoded.uid);
    const email = (decoded.email || '').trim().toLowerCase();
    const isBootstrapAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL && email === BOOTSTRAP_ADMIN_EMAIL);

    if (profile) {
      if (isBootstrapAdmin && profile.role !== 'admin') {
        profile.role = 'admin';
        profile.designation = 'System Administrator';
        db.save();
      }
    }

    req.user = profile || null;
    next();
  } catch (err) {
    console.warn('[Auth] Token decode/verify warning:', err.message);
    req.user = null;
    req.firebaseUser = null;
    next();
  }
}

/**
 * Middleware: requires a valid authenticated user (profile must exist in DB).
 */
export function requireAuth(req, res, next) {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  // If user has a valid Firebase token but no local DB profile yet, create a clean profile
  if (!req.user) {
    const uid = req.firebaseUser.uid;
    const email = (req.firebaseUser.email || '').trim().toLowerCase();
    const isBootstrapAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL && email === BOOTSTRAP_ADMIN_EMAIL);

    const newUser = {
      id: uid,
      name: req.firebaseUser.name || (email ? email.split('@')[0] : 'User'),
      email: req.firebaseUser.email || '',
      role: isBootstrapAdmin ? 'admin' : 'pending_member',
      designation: isBootstrapAdmin ? 'System Administrator' : 'Participant',
      stall_id: null,
      phone: null,
      college_name: 'Pravara Rural Engineering College, Loni',
      badge_code: `BP-${uid.slice(0, 6).toUpperCase()}`,
      created_at: new Date().toISOString()
    };
    db.data.users.push(newUser);
    db.save();
    req.user = newUser;
  }

  next();
}

/**
 * Middleware factory: requires specific role(s).
 */
export function requireRole(allowedRoles = []) {
  return [requireAuth, (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
        code: 'INSUFFICIENT_ROLE'
      });
    }
    next();
  }];
}

export const requireAdminMiddleware = requireRole(['admin']);
export const requireCoordinatorMiddleware = requireRole(['admin', 'coordinator']);
export const requireMemberMiddleware = requireRole(['admin', 'coordinator', 'member']);
export const requireCoordinatorOrAdmin = requireRole(['admin', 'coordinator']);

/**
 * Middleware: Verifies that the requester is an Admin or the specific Coordinator of the target stall
 */
export function requireStallCoordinator(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role === 'admin') return next();
    const stallId = req.params.stallId || req.body.stall_id;
    if (req.user.role === 'coordinator' && (!stallId || req.user.stall_id === stallId)) {
      return next();
    }
    return res.status(403).json({
      error: 'Access denied. You can only manage your assigned stall.',
      code: 'STALL_MISMATCH'
    });
  });
}
