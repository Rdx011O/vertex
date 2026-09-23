import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth, requireAdminMiddleware } from '../rbac.js';
import { calculateStallFinancials, calculateEventSummary, formatINR } from '../financials.js';
import realtime from '../ws.js';

const router = express.Router();

// Get list of pending submissions for Admin verification queue
router.get('/pending', (req, res) => {
  const pendingSubmissions = db.data.sales_submissions
    .filter(s => s.status === 'pending')
    .map(sub => {
      const stall = db.data.stalls.find(s => s.id === sub.stall_id);
      const submitter = db.data.users.find(u => u.id === sub.submitted_by_user_id);
      const items = db.data.sale_line_items.filter(i => i.submission_id === sub.id);
      return {
        ...sub,
        stall_name: stall ? stall.name : 'Unknown Stall',
        stall_category: stall ? stall.category : 'General',
        submitted_by_name: submitter ? submitter.name : 'Unknown',
        items
      };
    });

  res.json({ pending_submissions: pendingSubmissions });
});

// Get full history of submissions (filterable by stall or status)
router.get('/history', (req, res) => {
  const { stallId, status } = req.query;
  
  let list = db.data.sales_submissions;
  if (stallId) {
    list = list.filter(s => s.stall_id === stallId);
  }
  if (status) {
    list = list.filter(s => s.status === status);
  }

  const submissionsWithDetails = list.map(sub => {
    const stall = db.data.stalls.find(s => s.id === sub.stall_id);
    const submitter = db.data.users.find(u => u.id === sub.submitted_by_user_id);
    const verifier = sub.verified_by_user_id ? db.data.users.find(u => u.id === sub.verified_by_user_id) : null;
    const items = db.data.sale_line_items.filter(i => i.submission_id === sub.id);
    return {
      ...sub,
      stall_name: stall ? stall.name : 'Unknown Stall',
      submitted_by_name: submitter ? submitter.name : 'Unknown',
      verified_by_name: verifier ? verifier.name : null,
      items
    };
  });

  res.json({ submissions: submissionsWithDetails });
});

// Coordinator: POS "Finish My Day" / Submit Sales Log
// Features Idempotency Key to guarantee zero duplicate sales on offline retry
router.post('/submit', requireAuth, (req, res) => {
  const {
    stall_id,
    online_total = 0,
    offline_total = 0,
    items = [],
    idempotency_key,
    notes = ''
  } = req.body;

  if (!stall_id) {
    return res.status(400).json({ error: 'stall_id is required' });
  }

  // Permission check: Coordinator of this stall, or Admin
  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || req.user.stall_id !== stall_id)) {
    return res.status(403).json({ error: 'Permission denied: Only the stall coordinator can submit sales.' });
  }

  // Check Idempotency Key to avoid duplicate transactions during offline reconnect
  if (idempotency_key) {
    const existing = db.data.sales_submissions.find(s => s.idempotency_key === idempotency_key);
    if (existing) {
      console.log(`[Idempotency] Duplicate submission blocked for key: ${idempotency_key}`);
      const existingItems = db.data.sale_line_items.filter(i => i.submission_id === existing.id);
      return res.status(200).json({
        submission: existing,
        items: existingItems,
        idempotent_replay: true,
        message: 'Submission already recorded.'
      });
    }
  }

  const submissionId = 'sub-' + uuidv4().slice(0, 8);
  const totalAmount = Number(online_total) + Number(offline_total);

  const newSubmission = {
    id: submissionId,
    stall_id,
    submitted_by_user_id: req.user.id,
    online_total: Number(online_total),
    offline_total: Number(offline_total),
    total_amount: totalAmount,
    status: 'pending', // Starts in pending; gross earnings do NOT change until admin verification
    verified_by_user_id: null,
    verified_at: null,
    idempotency_key: idempotency_key || ('idem-' + uuidv4().slice(0, 8)),
    notes: notes || 'POS Daily Batch Submission',
    submitted_at: new Date().toISOString()
  };

  // Create line items
  const createdLineItems = [];
  if (Array.isArray(items) && items.length > 0) {
    items.forEach(it => {
      const lineItem = {
        id: 'item-' + uuidv4().slice(0, 8),
        submission_id: submissionId,
        item_name: it.item_name || it.name || 'Custom Item',
        unit_price: Number(it.unit_price || it.price || 0),
        qty: Number(it.qty || it.quantity || 1),
        payment_mode: it.payment_mode === 'offline' ? 'offline' : 'online'
      };
      createdLineItems.push(lineItem);
      db.data.sale_line_items.push(lineItem);
    });
  }

  db.data.sales_submissions.push(newSubmission);

  const stall = db.data.stalls.find(s => s.id === stall_id);
  const stallName = stall ? stall.name : stall_id;

  // Log audit
  db.logAudit(
    req.user.id,
    req.user.name,
    'SALES_SUBMITTED',
    'SALES_SUBMISSION',
    submissionId,
    `Submitted sales log for "${stallName}": ₹${totalAmount} (Online: ₹${online_total}, Offline: ₹${offline_total}) with ${createdLineItems.length} line items. Status: PENDING Admin verification.`
  );

  // Notify Admin
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'admin',
    target_scope_id: null,
    title: `New Sales Log: ${stallName}`,
    message: `${req.user.name} submitted ₹${totalAmount} (${createdLineItems.length} items) for verification.`,
    type: 'verification_pending',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);

  db.save();

  // Broadcast realtime update
  realtime.broadcast('SALE_SUBMITTED', {
    submission: newSubmission,
    items: createdLineItems,
    stall_name: stallName
  });

  res.status(201).json({
    submission: newSubmission,
    items: createdLineItems,
    idempotent_replay: false,
    message: 'Sales log submitted. Awaiting Admin verification before adding to official totals.'
  });
});

// Admin: Verify Sales Submission
router.post('/:submissionId/verify', requireAdminMiddleware, (req, res) => {
  const submission = db.data.sales_submissions.find(s => s.id === req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Sales submission not found' });
  }

  if (submission.status === 'verified') {
    return res.status(400).json({ error: 'This submission has already been verified.' });
  }

  submission.status = 'verified';
  submission.verified_by_user_id = req.user.id;
  submission.verified_at = new Date().toISOString();

  const stall = db.data.stalls.find(s => s.id === submission.stall_id);
  const stallName = stall ? stall.name : submission.stall_id;

  // Audit log
  db.logAudit(
    req.user.id,
    req.user.name,
    'SALES_VERIFIED',
    'SALES_SUBMISSION',
    submission.id,
    `Admin ${req.user.name} verified sales submission for "${stallName}": Total ${formatINR(submission.total_amount)} (Online: ${formatINR(submission.online_total)}, Offline: ${formatINR(submission.offline_total)}).`
  );

  // Notify Coordinator & Members of the stall
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'all',
    target_scope_id: submission.stall_id,
    title: `Sales Log Verified: ${stallName}`,
    message: `Admin verified ₹${submission.total_amount}. Gross sales & leaderboard updated live!`,
    type: 'sale_verified',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);

  db.save();

  // Recompute financials & summary
  const updatedFinancials = calculateStallFinancials(submission.stall_id, db.data);
  const eventSummary = calculateEventSummary(db.data);

  // Broadcast realtime event
  realtime.broadcast('SALE_VERIFIED', {
    submission,
    stall_id: submission.stall_id,
    stall_name: stallName,
    updated_financials: updatedFinancials,
    event_summary: eventSummary
  });

  res.json({
    submission,
    updated_financials: updatedFinancials,
    event_summary: eventSummary,
    message: 'Sales log verified and added to official ledger.'
  });
});

// Admin: Reject Sales Submission
router.post('/:submissionId/reject', requireAdminMiddleware, (req, res) => {
  const { reason } = req.body;
  const submission = db.data.sales_submissions.find(s => s.id === req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Sales submission not found' });
  }

  submission.status = 'rejected';
  submission.rejection_reason = reason || 'Discrepancy found in cash count or line items.';
  submission.rejected_by_user_id = req.user.id;
  submission.rejected_at = new Date().toISOString();

  const stall = db.data.stalls.find(s => s.id === submission.stall_id);
  const stallName = stall ? stall.name : submission.stall_id;

  // Audit log
  db.logAudit(
    req.user.id,
    req.user.name,
    'SALES_REJECTED',
    'SALES_SUBMISSION',
    submission.id,
    `Admin rejected sales submission for "${stallName}" (₹${submission.total_amount}). Reason: ${submission.rejection_reason}`
  );

  // Notify Stall Coordinator
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: submission.stall_id,
    title: `Sales Log Rejected: ${stallName}`,
    message: `Submission for ₹${submission.total_amount} was rejected. Note: ${submission.rejection_reason}`,
    type: 'sale_rejected',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);

  db.save();

  realtime.broadcast('SALE_REJECTED', {
    submission,
    stall_id: submission.stall_id,
    stall_name: stallName
  });

  res.json({
    submission,
    message: 'Submission marked as rejected. Record kept in audit history.'
  });
});

export default router;
