import express from 'express';
import db from '../db.js';
import { requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

// Get audit logs (admin-only for full log; others get empty)
router.get('/', (req, res) => {
  const { action, limit = 100 } = req.query;

  // Only admins can read audit logs
  if (!req.user || req.user.role !== 'admin') {
    return res.json({ total: 0, logs: [] });
  }

  let logs = db.data.audit_logs;
  if (action) {
    logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
  }

  res.json({
    total: logs.length,
    logs: logs.slice(0, Number(limit))
  });
});

// Admin: clear all notifications (housekeeping)
router.delete('/notifications', requireAdminMiddleware, (req, res) => {
  db.data.notifications = [];
  db.save();
  res.json({ message: 'Notifications cleared.' });
});

export default router;
