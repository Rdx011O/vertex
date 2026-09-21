import db from './db.js';

/**
 * RBAC and Permission Enforcement Middleware (adhering to 01-ROLES_AND_PERMISSIONS.md)
 */

export function authenticateUser(req, res, next) {
  // In our full-stack app, the active user is passed via X-User-Id header or query param
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    // Default to admin if unauthenticated header for dev, but let routes check
    req.user = null;
    return next();
  }

  const user = db.data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found or invalid session' });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Role '${req.user.role}' is not authorized for this action.`
      });
    }

    next();
  };
}

export function requireAdmin(req, res, next) {
  return requireRole(['admin'])(req, res, next);
}

export function requireCoordinator(req, res, next) {
  return requireRole(['coordinator'])(req, res, next);
}

export function requireStallCoordinator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only Stall Coordinators can perform this operation' });
  }

  const stallId = req.params.stallId || req.body.stall_id;
  if (stallId && req.user.stall_id !== stallId) {
    return res.status(403).json({
      error: 'Forbidden: You can only manage your own assigned stall.'
    });
  }

  next();
}
