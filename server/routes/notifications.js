import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

// Get notifications filtered for the current user's role and stall
router.get('/', (req, res) => {
  const user = req.user;
  if (!user) {
    return res.json({ notifications: [] });
  }

  let notifications = db.data.notifications || [];

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

  // Map read status for the requesting user
  notifications = notifications.map(n => ({
    ...n,
    is_read: Array.isArray(n.read_by) ? n.read_by.includes(user.id) : false
  }));

  res.json({ notifications });
});

// Mark single notification as read (for announcement button or user action)
router.post('/:id/read', (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Auth required' });

  const notif = (db.data.notifications || []).find(n => n.id === req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  if (!Array.isArray(notif.read_by)) {
    notif.read_by = [];
  }
  if (!notif.read_by.includes(user.id)) {
    notif.read_by.push(user.id);
    db.save();
    realtime.broadcast('NOTIFICATION_READ', { user_id: user.id, notification_id: notif.id });
  }

  res.json({ success: true, notification_id: notif.id, is_read: true });
});

// Mark all non-announcements as seen when opening the drawer / viewing
router.post('/mark-seen', (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Auth required' });

  let updated = false;
  (db.data.notifications || []).forEach(n => {
    // Only auto-mark non-announcement notifications as seen
    if (n.type !== 'announcement') {
      if (!Array.isArray(n.read_by)) n.read_by = [];
      if (!n.read_by.includes(user.id)) {
        n.read_by.push(user.id);
        updated = true;
      }
    }
  });

  if (updated) db.save();
  res.json({ success: true });
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
    read_by: [],
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
