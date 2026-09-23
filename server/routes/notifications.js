import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

// Get notifications filtered for the current user's role and stall
router.get('/', (req, res) => {
  const user = req.user;
  let notifications = db.data.notifications;

  if (user) {
    notifications = notifications.filter(n => {
      // 1. Event-wide broadcast
      if (n.target_role === 'all') return true;
      // 2. Direct role match without scope
      if (n.target_role === user.role && !n.target_scope_id) return true;
      // 3. Role + Stall Scope
      if (n.target_role === user.role && n.target_scope_id === user.stall_id) return true;
      // 4. Direct user ID match
      if (n.target_scope_id === user.id) return true;
      // Admin sees everything
      if (user.role === 'admin') return true;
      return false;
    });
  }

  res.json({ notifications });
});

// Admin: Post an event-wide broadcast announcement
router.post('/broadcast', requireAdminMiddleware, (req, res) => {
  const { title, message, target_role } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message required' });
  }

  const newNotif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: target_role || 'all',
    target_scope_id: null,
    title: title.trim(),
    message: message.trim(),
    type: 'announcement',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };

  db.data.notifications.unshift(newNotif);
  
  db.logAudit(
    req.user.id,
    req.user.name,
    'ANNOUNCEMENT_BROADCAST',
    'NOTIFICATION',
    newNotif.id,
    `Admin broadcasted: "${title}" to target audience: ${target_role || 'all'}.`
  );

  db.save();

  realtime.broadcast('ANNOUNCEMENT_CREATED', { notification: newNotif });

  res.status(201).json({ notification: newNotif });
});

export default router;
