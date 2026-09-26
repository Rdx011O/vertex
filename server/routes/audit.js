import express from 'express';
import db from '../db.js';
import { requireAuth, requireAdminMiddleware } from '../rbac.js';
import realtime from '../ws.js';

const router = express.Router();

function categorizeAction(action = '') {
  const act = action.toUpperCase();
  if (act.includes('SALE') || act.includes('EXPENSE')) return 'Financials';
  if (act.includes('ATTENDANCE') || act.includes('MEMBER') || act.includes('JOIN')) return 'Team & Attendance';
  if (act.includes('STALL') || act.includes('WARNING') || act.includes('FLAG') || act.includes('DISCONTINUE')) return 'Stall Operations';
  if (act.includes('ANNOUNCEMENT') || act.includes('BROADCAST')) return 'Broadcasts';
  if (act.includes('USER') || act.includes('ROLE')) return 'Governance';
  return 'General';
}

// Get audit logs with multi-tier role-based filtering
router.get('/', requireAuth, (req, res) => {
  const { action, category, limit = 200 } = req.query;
  const user = req.user;

  let allLogs = (db.data.audit_logs || []).map(l => ({
    ...l,
    category: categorizeAction(l.action)
  }));

  let filteredLogs = [];

  if (user.role === 'admin') {
    // Level 3 (Admin): Complete unhindered event ledger
    filteredLogs = allLogs;
  } else if (user.role === 'coordinator') {
    // Level 2 (Coordinator): Scoped to their stall and team members
    const myStallId = user.stall_id;
    const stallMemberIds = new Set(
      (db.data.users || [])
        .filter(u => u.stall_id === myStallId)
        .map(u => u.id)
    );
    stallMemberIds.add(user.id);

    filteredLogs = allLogs.filter(log => {
      // 1. Direct actor is coordinator or stall member
      if (stallMemberIds.has(log.actor_user_id)) return true;
      // 2. Direct target is this stall or one of its members
      if (log.target_id === myStallId || stallMemberIds.has(log.target_id)) return true;
      // 3. Log details mentions the stall
      if (myStallId && log.details && (log.details.includes(myStallId) || (user.stall_name && log.details.includes(user.stall_name)))) return true;
      return false;
    });
  } else if (user.role === 'member') {
    // Level 1 (Member): Scoped strictly to personal actions & their own role activity
    filteredLogs = allLogs.filter(log => {
      // 1. Member was the actor
      if (log.actor_user_id === user.id) return true;
      // 2. Member was the target
      if (log.target_id === user.id) return true;
      return false;
    });
  } else {
    filteredLogs = [];
  }

  // Filter by action search term if requested
  if (action) {
    filteredLogs = filteredLogs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()) || l.details?.toLowerCase().includes(action.toLowerCase()));
  }

  // Filter by category if requested
  if (category && category !== 'all') {
    filteredLogs = filteredLogs.filter(l => l.category.toLowerCase() === category.toLowerCase());
  }

  res.json({
    role: user.role,
    total: filteredLogs.length,
    logs: filteredLogs.slice(0, Number(limit))
  });
});

// Admin: clear all notifications (housekeeping)
router.delete('/notifications', requireAdminMiddleware, (req, res) => {
  db.data.notifications = [];
  db.save();
  res.json({ message: 'Notifications cleared.' });
});

export default router;

