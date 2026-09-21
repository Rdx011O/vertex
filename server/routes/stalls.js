import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAdmin, requireStallCoordinator } from '../rbac.js';
import { calculateStallFinancials, calculateEventSummary, formatINR } from '../financials.js';
import realtime from '../ws.js';

const router = express.Router();

// List all stalls with live financial metrics
router.get('/', (req, res) => {
  const stallsWithMetrics = db.data.stalls.map(s => {
    const fin = calculateStallFinancials(s.id, db.data);
    const coordinator = db.data.users.find(u => u.id === s.coordinator_user_id);
    const members = db.data.users.filter(u => u.stall_id === s.id && u.role === 'member');
    
    // Today's attendance for this stall
    const today = new Date().toISOString().split('T')[0];
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

// Overall Event Summary / Command Center metrics
router.get('/summary/event', (req, res) => {
  const summary = calculateEventSummary(db.data);
  res.json({ summary });
});

// Single stall details
router.get('/:stallId', (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

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

  // Attendance details for this stall
  const attendance = db.data.attendance_records.filter(a => a.stall_id === stall.id);

  res.json({
    stall: {
      ...stall,
      coordinator,
      members,
      financials,
      expenses,
      submissions: {
        verified: verifiedSubmissions,
        pending: pendingSubmissions,
        rejected: rejectedSubmissions
      },
      catalog,
      attendance
    }
  });
});

// Admin: Create new stall
router.post('/', requireAdmin, (req, res) => {
  const { name, category, coordinator_name, coordinator_email, coordinator_phone, location, banner_color } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Stall name and category are required' });
  }

  const stallId = 'stl-' + uuidv4().slice(0, 8);
  const coordId = 'usr-coord-' + uuidv4().slice(0, 6);

  const newCoordinator = {
    id: coordId,
    name: coordinator_name || `${name} Coordinator`,
    role: 'coordinator',
    stall_id: stallId,
    email: coordinator_email || `coord.${stallId}@prec.ac.in`,
    phone: coordinator_phone || '+91 98000 00000',
    designation: `${name} Coordinator`,
    badge_code: 'BP-CRD-' + Math.floor(100 + Math.random() * 900)
  };

  const newStall = {
    id: stallId,
    name,
    category,
    event_id: 'ev-bp-2026',
    coordinator_user_id: coordId,
    status: 'active',
    banner_color: banner_color || '#4F46E5',
    location: location || 'Main Courtyard',
    created_at: new Date().toISOString()
  };

  db.data.users.push(newCoordinator);
  db.data.stalls.push(newStall);
  
  db.logAudit(
    req.user.id,
    req.user.name,
    'STALL_CREATED',
    'STALL',
    stallId,
    `Admin created new stall "${name}" (${category}) with coordinator ${newCoordinator.name}.`
  );

  db.save();
  realtime.broadcast('STALL_CREATED', { stall: newStall, coordinator: newCoordinator });

  res.status(201).json({ stall: newStall, coordinator: newCoordinator });
});

// Admin: Change stall status (active / warning / discontinued)
router.patch('/:stallId/status', requireAdmin, (req, res) => {
  const { status, warning_reason } = req.body;
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  const oldStatus = stall.status;
  stall.status = status;
  if (warning_reason) {
    stall.last_warning = warning_reason;
    stall.last_warning_time = new Date().toISOString();
  }

  db.logAudit(
    req.user.id,
    req.user.name,
    'STALL_STATUS_CHANGED',
    'STALL',
    stall.id,
    `Changed status of "${stall.name}" from ${oldStatus} to ${status}. ${warning_reason ? `Warning note: ${warning_reason}` : ''}`
  );

  // Send notification to stall coordinator
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

// Stall Coordinator: Log an expense
router.post('/:stallId/expenses', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  // Check role: Coordinator of this stall, or Admin
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
    req.user.id,
    req.user.name,
    'EXPENSE_LOGGED',
    'STALL_EXPENSE',
    newExpense.id,
    `Logged ₹${newExpense.amount} under "${newExpense.category}" for "${stall.name}": ${newExpense.name}`
  );

  db.save();
  
  const updatedFinancials = calculateStallFinancials(stall.id, db.data);
  realtime.broadcast('EXPENSE_ADDED', {
    expense: newExpense,
    stall_id: stall.id,
    financials: updatedFinancials
  });

  res.status(201).json({ expense: newExpense, financials: updatedFinancials });
});

// Get/Add POS item catalog
router.get('/:stallId/catalog', (req, res) => {
  const catalog = db.data.pos_catalog.filter(c => c.stall_id === req.params.stallId);
  res.json({ catalog });
});

router.post('/:stallId/catalog', (req, res) => {
  if (!req.user || (req.user.role !== 'coordinator' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only coordinator can add catalog items' });
  }

  const { name, price, category } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Item name and price required' });
  }

  const newItem = {
    id: 'cat-' + uuidv4().slice(0, 8),
    stall_id: req.params.stallId,
    name: name.trim(),
    price: Number(price),
    category: category || 'Standard'
  };

  db.data.pos_catalog.push(newItem);
  db.save();

  res.status(201).json({ item: newItem });
});

export default router;
