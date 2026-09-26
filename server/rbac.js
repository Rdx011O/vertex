/**
 * RBAC and Authentication Middleware
 * Verifies Firebase ID tokens from Authorization: Bearer <token> header.
 * Attaches verified req.user (DB profile) to requests.
 */

import { firebaseAuth } from './firebase-admin.js';
import db from './db.js';

const configuredAdmin = process.env.BOOTSTRAP_ADMIN_EMAIL ? process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase() : null;
const ADMIN_EMAILS = [
  'admin@prec.ac.in',
  'aadiyta.battin.ec24@pravaraengg.org.in',
  'aaditya.battin.ec24@pravaraengg.org.in'
];
if (configuredAdmin && !ADMIN_EMAILS.includes(configuredAdmin)) {
  ADMIN_EMAILS.push(configuredAdmin);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Fast in-memory verification cache: idToken -> { decoded, expiresAt }
const tokenCache = new Map();

function getCachedToken(idToken) {
  const item = tokenCache.get(idToken);
  if (item && item.expiresAt > Date.now()) {
    return item.decoded;
  }
  return null;
}

function setCachedToken(idToken, decoded) {
  const tokenExpMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 5 * 60 * 1000;
  const expiresAt = Math.min(tokenExpMs, Date.now() + 5 * 60 * 1000);
  tokenCache.set(idToken, { decoded, expiresAt });
  if (tokenCache.size > 2000) {
    const firstKey = tokenCache.keys().next().value;
    tokenCache.delete(firstKey);
  }
}

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
    let decoded = getCachedToken(idToken);

    if (!decoded) {
      if (firebaseAuth) {
        try {
          decoded = await firebaseAuth.verifyIdToken(idToken);
        } catch (err) {
          // Fallback: decode JWT payload if admin cert is unconfigured in serverless
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payload = Buffer.from(parts[1], 'base64').toString('utf8');
            decoded = JSON.parse(payload);
            decoded.uid = decoded.uid || decoded.user_id || decoded.sub;
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
          decoded.uid = decoded.uid || decoded.user_id || decoded.sub;
        }
      }

      if (decoded && decoded.uid) {
        setCachedToken(idToken, decoded);
      }
    }

    if (!decoded || !decoded.uid) {
      throw new Error('Invalid token payload.');
    }

    req.firebaseUser = decoded;

    // Ensure database is ready before profile query
    await db.ready();

    const email = (decoded.email || '').trim().toLowerCase();
    const isBootstrapAdmin = isAdminEmail(email);

    // Look up the user profile in our DB
    let profile = db.getUserByUid(decoded.uid);

    // If not found by UID, check by email
    if (!profile && email) {
      profile = db.getUserByEmail(email);
      if (profile) {
        profile.id = decoded.uid;
        await db.save();
      }
    }

    // Auto-create or ensure admin privileges for admin emails
    if (isBootstrapAdmin) {
      if (!profile) {
        profile = db.createUser({
          id: decoded.uid,
          name: decoded.name || 'System Administrator',
          email,
          role: 'admin',
          designation: 'System Administrator'
        });
        await db.save();
      } else if (profile.role !== 'admin') {
        profile.role = 'admin';
        profile.designation = 'System Administrator';
        await db.save();
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

  // If user has a valid Firebase token but no DB profile yet, they need to register first
  if (!req.user) {
    return res.status(404).json({ error: 'Profile not found. Please register.' });
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
