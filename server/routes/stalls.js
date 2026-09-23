/**
 * Stalls Routes
 * Handles stall listing, creation, management, expenses, and catalog.
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth, requireAdminMiddleware, requireCoordinatorOrAdmin, requireStallCoordinator } from '../rbac.js';
import { calculateStallFinancials, calculateEventSummary } from '../financials.js';
import realtime from '../ws.js';

const router = express.Router();

// ── List all stalls with live financial metrics ───────────────────────────────
router.get('/', (req, res) => {
  const stallsWithMetrics = db.data.stalls.map(s => {
    const fin = calculateStallFinancials(s.id, db.data);
    const coordinator = db.data.users.find(u => u.id === s.coordinator_user_id);
    const members = db.data.users.filter(u => u.stall_id === s.id && u.role === 'member');

    const stallAttendance = db.data.attendance_records.filter(
      a => a.stall_id === s.id && a.status === 'confirmed'
    );
    const attendancePercent = members.length > 0
      ? Math.round((stallAttendance.length / members.length) * 100)
      : 100;

    return {
      ...s,
      financials: fin,
      coordinator: coordinator ? { id: coordinator.id, name: coordinator.name, phone: coordinator.phone } : null,
      members_count: members.length,
      attendance_confirmed_count: stallAttendance.length,
      attendance_rate: attendancePercent
    };
  });

  res.json({ stalls: stallsWithMetrics });
});

// ── Event summary (command center metrics) ────────────────────────────────────
router.get('/summary/event', (req, res) => {
  const summary = calculateEventSummary(db.data);
  res.json({ summary });
});

// ── Single stall details ──────────────────────────────────────────────────────
router.get('/:stallId', (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const financials = calculateStallFinancials(stall.id, db.data);
  const coordinator = db.data.users.find(u => u.id === stall.coordinator_user_id);
  const members = db.data.users.filter(u => u.stall_id === stall.id && u.role === 'member');
  const expenses = db.data.stall_expenses.filter(e => e.stall_id === stall.id);

  const verifiedSubmissions = db.data.sales_submissions.filter(
    s => s.stall_id === stall.id && s.status === 'verified'
  );
  const pendingSubmissions = db.data.sales_submissions.filter(
    s => s.stall_id === stall.id && s.status === 'pending'
  );
  const rejectedSubmissions = db.data.sales_submissions.filter(
    s => s.stall_id === stall.id && s.status === 'rejected'
  );

  const catalog = db.data.pos_catalog.filter(c => c.stall_id === stall.id);
  const attendance = db.data.attendance_records.filter(a => a.stall_id === stall.id);

  res.json({
    stall: {
      ...stall,
      coordinator,
      members,
      financials,
      expenses,
      submissions: { verified: verifiedSubmissions, pending: pendingSubmissions, rejected: rejectedSubmissions },
      catalog,
      attendance
    }
  });
});

// ── Admin: Create new stall ───────────────────────────────────────────────────
router.post('/', requireAdminMiddleware, (req, res) => {
  const { name, category, coordinator_uid, location, banner_color } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Stall name and category are required' });
  }

  // Find coordinator by UID if provided
  let coordinatorUser = null;
  if (coordinator_uid) {
    coordinatorUser = db.getUserByUid(coordinator_uid);
    if (!coordinatorUser) {
      return res.status(404).json({ error: 'Coordinator user not found' });
    }
  }

  const stallId = 'stl-' + uuidv4().slice(0, 8);

  const newStall = {
    id: stallId,
    name,
    category,
    event_id: 'ev-bp-2026',
    coordinator_user_id: coordinatorUser?.id || null,
    status: 'active',
    banner_color: banner_color || '#4F46E5',
    location: location || 'Main Courtyard',
    created_at: new Date().toISOString()
  };

  db.data.stalls.push(newStall);

  // Assign coordinator to this stall
  if (coordinatorUser) {
    db.updateUser(coordinatorUser.id, { role: 'coordinator', stall_id: stallId });
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_CREATED', 'STALL', stallId,
    `Admin created stall "${name}" (${category})${coordinatorUser ? ` with coordinator ${coordinatorUser.name}` : ''}.`
  );

  db.save();
  realtime.broadcast('STALL_CREATED', { stall: newStall });

  res.status(201).json({ stall: newStall });
});

// ── Coordinator: Create/setup own stall (self-service after role assignment) ──
router.post('/setup', requireAuth, (req, res) => {
  if (!req.user || req.user.role !== 'coordinator') {
    return res.status(403).json({ error: 'Only coordinators can set up a stall.' });
  }
  if (req.user.stall_id) {
    // Already has a stall — return it
    const existingStall = db.data.stalls.find(s => s.id === req.user.stall_id);
    return res.json({ stall: existingStall, message: 'Stall already configured.' });
  }

  const { name, category, location, banner_color, items } = req.body;
  if (!name) return res.status(400).json({ error: 'Stall name is required.' });

  const stallId = 'stl-' + uuidv4().slice(0, 8);
  const newStall = {
    id: stallId,
    name: name.trim(),
    category: category || 'General',
    event_id: 'ev-bp-2026',
    coordinator_user_id: req.user.id,
    status: 'active',
    banner_color: banner_color || '#4F46E5',
    location: location || 'Main Courtyard',
    created_at: new Date().toISOString()
  };

  db.data.stalls.push(newStall);
  db.updateUser(req.user.id, { stall_id: stallId });

  // Add initial catalog items if provided
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.name && item.price && Number(item.price) > 0) {
        db.data.pos_catalog.push({
          id: 'cat-' + uuidv4().slice(0, 8),
          stall_id: stallId,
          name: item.name.trim(),
          price: Math.round(Number(item.price)),
          category: item.category || 'Standard'
        });
      }
    }
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_SETUP', 'STALL', stallId,
    `Coordinator "${req.user.name}" set up stall "${name}" with ${Array.isArray(items) ? items.length : 0} catalog items.`
  );

  db.save();
  realtime.broadcast('STALL_CREATED', { stall: newStall });

  const catalogItems = db.data.pos_catalog.filter(c => c.stall_id === stallId);
  res.status(201).json({ stall: newStall, catalog: catalogItems });
});

// ── Admin: Change stall status ────────────────────────────────────────────────
router.patch('/:stallId/status', requireAdminMiddleware, (req, res) => {
  const { status, warning_reason } = req.body;
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const oldStatus = stall.status;
  stall.status = status;
  if (warning_reason) {
    stall.last_warning = warning_reason;
    stall.last_warning_time = new Date().toISOString();
  }

  db.logAudit(
    req.user.id, req.user.name,
    'STALL_STATUS_CHANGED', 'STALL', stall.id,
    `Changed status of "${stall.name}" from ${oldStatus} to ${status}.${warning_reason ? ` Warning: ${warning_reason}` : ''}`
  );

  if (status === 'discontinued' || warning_reason) {
    const notif = {
      id: 'notif-' + uuidv4().slice(0, 8),
      target_role: 'coordinator',
      target_scope_id: stall.id,
      title: status === 'discontinued' ? '⚠️ Stall Discontinued by Admin' : '⚠️ Admin Warning Notice',
      message: warning_reason || `Stall status updated to ${status}. Please contact Admin.`,
      type: 'warning',
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };
    db.data.notifications.unshift(notif);
  }

  db.save();
  realtime.broadcast('STALL_UPDATED', { stall });

  res.json({ stall });
});

// ── Expense logging ───────────────────────────────────────────────────────────
router.post('/:stallId/expenses', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can log expenses' });
  }

  const { category, name, amount } = req.body;
  if (!name || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid expense name and positive amount are required' });
  }

  const newExpense = {
    id: 'exp-' + uuidv4().slice(0, 8),
    stall_id: stall.id,
    category: category || 'General Expense',
    name: name.trim(),
    amount: Math.round(Number(amount)),
    logged_by: req.user.id,
    timestamp: new Date().toISOString()
  };

  db.data.stall_expenses.push(newExpense);
  db.logAudit(
    req.user.id, req.user.name,
    'EXPENSE_LOGGED', 'STALL_EXPENSE', newExpense.id,
    `Logged ₹${newExpense.amount} under "${newExpense.category}" for "${stall.name}": ${newExpense.name}`
  );

  db.save();

  const updatedFinancials = calculateStallFinancials(stall.id, db.data);
  realtime.broadcast('EXPENSE_ADDED', { expense: newExpense, stall_id: stall.id, financials: updatedFinancials });

  res.status(201).json({ expense: newExpense, financials: updatedFinancials });
});

// ── POS Catalog ───────────────────────────────────────────────────────────────
router.get('/:stallId/catalog', (req, res) => {
  const catalog = db.data.pos_catalog.filter(c => c.stall_id === req.params.stallId);
  res.json({ catalog });
});

// Add item to catalog
router.post('/:stallId/catalog', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can manage catalog items' });
  }

  const { name, price, category } = req.body;
  if (!name || !price || isNaN(price) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Item name and a positive price are required' });
  }

  const newItem = {
    id: 'cat-' + uuidv4().slice(0, 8),
    stall_id: stall.id,
    name: name.trim(),
    price: Math.round(Number(price)),
    category: category || 'Standard'
  };

  db.data.pos_catalog.push(newItem);
  db.save();

  res.status(201).json({ item: newItem });
});

// Delete catalog item
router.delete('/:stallId/catalog/:itemId', requireAuth, (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall.id)) {
    return res.status(403).json({ error: 'Only the stall coordinator or admin can manage catalog items' });
  }

  const idx = db.data.pos_catalog.findIndex(
    c => c.id === req.params.itemId && c.stall_id === stall.id
  );
  if (idx === -1) return res.status(404).json({ error: 'Catalog item not found' });

  db.data.pos_catalog.splice(idx, 1);
  db.save();

  res.json({ message: 'Item removed from catalog.' });
});

export default router;
