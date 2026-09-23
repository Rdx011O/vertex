/**
 * RBAC and Authentication Middleware
 * Verifies Firebase ID tokens from Authorization: Bearer <token> header.
 */

import { firebaseAuth } from './firebase-admin.js';
import db from './db.js';

/**
 * Middleware: verifies Firebase ID token and attaches req.user (DB profile).
 * Routes that need auth must call requireAuth() or requireRole() afterwards.
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
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    req.firebaseUser = decoded; // { uid, email, name, ... }

    // Look up the user profile in our DB
    const profile = db.getUserByUid(decoded.uid);
    req.user = profile; // may be null if user hasn't registered a profile yet
    next();
  } catch (err) {
    console.warn('[Auth] Invalid or expired token:', err.code || err.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token. Please sign in again.' });
  }
}

/**
 * Middleware: requires a valid authenticated user (profile must exist in DB).
 */
export function requireAuth(req, res, next) {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  if (!req.user) {
    return res.status(403).json({
      error: 'Profile not found. Your account may be pending setup.',
      code: 'PROFILE_NOT_FOUND'
    });
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
        error: `Permission denied. Role '${req.user.role}' is not authorized for this action.`
      });
    }
    next();
  }];
}

export function requireAdmin(req, res, next) {
  return requireRole(['admin'])(req, res, next);
}

export function requireAdminMiddleware(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

export function requireCoordinatorOrAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || !['coordinator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Coordinator or Admin access required.' });
    }
    next();
  });
}

/**
 * Middleware: ensures coordinator can only touch their own stall.
 */
export function requireStallCoordinator(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user) return;
    if (req.user.role !== 'coordinator' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only Stall Coordinators can perform this operation' });
    }
    const stallId = req.params.stallId || req.body.stall_id;
    if (req.user.role === 'coordinator' && stallId && req.user.stall_id !== stallId) {
      return res.status(403).json({ error: 'Forbidden: You can only manage your own assigned stall.' });
    }
    next();
  });
}
