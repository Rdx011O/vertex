import express from 'express';
import db from '../db.js';
import realtime from '../ws.js';

const router = express.Router();

// Get audit logs
router.get('/', (req, res) => {
  const { action, limit = 100 } = req.query;
  let logs = db.data.audit_logs;
  
  if (action) {
    logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
  }

  res.json({
    total: logs.length,
    logs: logs.slice(0, Number(limit))
  });
});

// Reset database to initial seed state (useful for demonstrations)
router.post('/reset-demo', (req, res) => {
  const freshData = db.reset();
  db.logAudit(
    'usr-admin-01',
    'System Admin',
    'DATABASE_RESET',
    'SYSTEM',
    'ev-bp-2026',
    'Demonstration database reset to standard Building Pravara initial seed ledger.'
  );
  
  realtime.broadcast('DATABASE_RESET', { message: 'Database reset to demo seed.' });
  res.json({ success: true, message: 'Database reset successfully.' });
});

export default router;
