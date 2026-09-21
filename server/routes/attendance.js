import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import realtime from '../ws.js';

const router = express.Router();

// Get attendance stats and list for a stall
router.get('/stall/:stallId', (req, res) => {
  const stall = db.data.stalls.find(s => s.id === req.params.stallId);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  const members = db.data.users.filter(u => u.stall_id === stall.id && u.role === 'member');
  const records = db.data.attendance_records.filter(a => a.stall_id === stall.id);

  // Group by member for latest status
  const memberStatuses = members.map(m => {
    const record = records.find(r => r.member_user_id === m.id);
    const confirmedBy = record && record.confirmed_by_user_id
      ? db.data.users.find(u => u.id === record.confirmed_by_user_id)
      : null;

    return {
      member_id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      designation: m.designation,
      badge_code: m.badge_code,
      attendance_id: record ? record.id : null,
      status: record ? record.status : 'not_checked_in',
      confirmed_by: confirmedBy ? confirmedBy.name : null,
      timestamp: record ? record.timestamp : null,
      verified_method: record ? record.verified_method : null
    };
  });

  const confirmedCount = memberStatuses.filter(m => m.status === 'confirmed').length;
  const pendingCount = memberStatuses.filter(m => m.status === 'pending_coordinator').length;
  const attendanceRate = members.length > 0 ? Math.round((confirmedCount / members.length) * 100) : 0;

  res.json({
    stall_id: stall.id,
    stall_name: stall.name,
    total_members: members.length,
    confirmed_count: confirmedCount,
    pending_count: pendingCount,
    attendance_rate: attendanceRate,
    members: memberStatuses
  });
});

// Member: Tap "I'm at my stall"
router.post('/checkin-request', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'member') {
    return res.status(400).json({ error: 'Only stall members can raise check-in requests' });
  }

  if (!req.user.stall_id) {
    return res.status(400).json({ error: 'User is not assigned to any stall' });
  }

  const stall = db.data.stalls.find(s => s.id === req.user.stall_id);
  if (!stall) {
    return res.status(404).json({ error: 'Assigned stall not found' });
  }

  // Check if member already has confirmed or pending attendance for today
  const existingRecord = db.data.attendance_records.find(
    a => a.member_user_id === req.user.id && a.stall_id === stall.id
  );

  if (existingRecord) {
    if (existingRecord.status === 'confirmed') {
      return res.status(200).json({
        attendance: existingRecord,
        status: 'confirmed',
        message: 'Your attendance is already confirmed for this session.'
      });
    } else if (existingRecord.status === 'pending_coordinator') {
      return res.status(200).json({
        attendance: existingRecord,
        status: 'pending_coordinator',
        message: 'Your check-in request is already pending your Coordinator\'s approval.'
      });
    }
  }

  const newRecord = {
    id: 'att-' + uuidv4().slice(0, 8),
    member_user_id: req.user.id,
    stall_id: stall.id,
    status: 'pending_coordinator',
    confirmed_by_user_id: null,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    verified_method: 'LOCATION_REQUEST'
  };

  db.data.attendance_records.push(newRecord);

  // Notify the Stall Coordinator
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'coordinator',
    target_scope_id: stall.id,
    title: 'Arrival Check-in Alert',
    message: `${req.user.name} reported arrival at ${stall.name} and is waiting for your confirmation.`,
    type: 'attendance_request',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);

  db.save();

  // Real-time broadcast to coordinator view
  realtime.broadcast('ATTENDANCE_REQUESTED', {
    attendance: newRecord,
    member: {
      id: req.user.id,
      name: req.user.name,
      badge_code: req.user.badge_code
    },
    stall_id: stall.id,
    stall_name: stall.name
  });

  res.status(201).json({
    attendance: newRecord,
    status: 'pending_coordinator',
    message: 'Check-in request sent! Your Stall Coordinator will confirm your presence.'
  });
});

// Stall Coordinator: Confirm attendance for a member
router.post('/:attendanceId/confirm', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const record = db.data.attendance_records.find(a => a.id === req.params.attendanceId);
  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
  }

  const stall = db.data.stalls.find(s => s.id === record.stall_id);
  if (!stall) {
    return res.status(404).json({ error: 'Stall not found' });
  }

  // Strict accountability enforcement:
  // ONLY the stall's assigned coordinator can confirm attendance (or Admin as emergency override, but NO SELF APPROVAL)
  if (req.user.id === record.member_user_id) {
    return res.status(403).json({ error: 'Accountability violation: No role can self-approve their own attendance.' });
  }

  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || stall.coordinator_user_id !== req.user.id)) {
    return res.status(403).json({
      error: 'Accountability violation: Only this stall\'s own Coordinator can confirm member attendance.'
    });
  }

  record.status = 'confirmed';
  record.confirmed_by_user_id = req.user.id;
  record.timestamp = new Date().toISOString();
  record.verified_method = req.body.method || 'COORDINATOR_CONFIRMED';

  const member = db.data.users.find(u => u.id === record.member_user_id);

  // Log immutable audit entry
  db.logAudit(
    req.user.id,
    req.user.name,
    'ATTENDANCE_CONFIRMED',
    'ATTENDANCE',
    record.id,
    `Coordinator confirmed attendance for ${member ? member.name : record.member_user_id} at "${stall.name}".`
  );

  // Send confirmation notification to member
  const notif = {
    id: 'notif-' + uuidv4().slice(0, 8),
    target_role: 'member',
    target_scope_id: record.member_user_id,
    title: 'Attendance Confirmed ✅',
    message: `Your check-in at ${stall.name} was confirmed by ${req.user.name}.`,
    type: 'attendance_confirmed',
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.data.notifications.unshift(notif);

  db.save();

  // Broadcast realtime update
  realtime.broadcast('ATTENDANCE_CONFIRMED', {
    attendance: record,
    member_id: record.member_user_id,
    member_name: member ? member.name : 'Team Member',
    stall_id: stall.id,
    confirmed_by_name: req.user.name
  });

  res.json({
    attendance: record,
    member_name: member ? member.name : null,
    message: `Attendance confirmed for ${member ? member.name : 'member'}.`
  });
});

// Coordinator: Direct QR Scan Check-In
router.post('/scan-confirm', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { badge_code, member_id } = req.body;
  
  let member = null;
  if (badge_code) {
    member = db.data.users.find(u => u.badge_code === badge_code);
  } else if (member_id) {
    member = db.data.users.find(u => u.id === member_id);
  }

  if (!member) {
    return res.status(404).json({ error: 'No member found matching this badge QR.' });
  }

  const stall = db.data.stalls.find(s => s.id === member.stall_id);
  if (!stall) {
    return res.status(400).json({ error: 'Member is not assigned to any stall.' });
  }

  // Enforce coordinator check
  if (req.user.role !== 'admin' && (req.user.role !== 'coordinator' || stall.coordinator_user_id !== req.user.id)) {
    return res.status(403).json({
      error: `Accountability violation: Only the coordinator for ${stall.name} can confirm ${member.name}'s badge.`
    });
  }

  let record = db.data.attendance_records.find(
    a => a.member_user_id === member.id && a.stall_id === stall.id
  );

  if (!record) {
    record = {
      id: 'att-' + uuidv4().slice(0, 8),
      member_user_id: member.id,
      stall_id: stall.id,
      date: new Date().toISOString().split('T')[0]
    };
    db.data.attendance_records.push(record);
  }

  record.status = 'confirmed';
  record.confirmed_by_user_id = req.user.id;
  record.timestamp = new Date().toISOString();
  record.verified_method = 'QR_SCAN';

  db.logAudit(
    req.user.id,
    req.user.name,
    'ATTENDANCE_CONFIRMED',
    'ATTENDANCE',
    record.id,
    `Coordinator scanned badge QR and verified attendance for ${member.name} (${member.badge_code}) at "${stall.name}".`
  );

  db.save();

  realtime.broadcast('ATTENDANCE_CONFIRMED', {
    attendance: record,
    member_id: member.id,
    member_name: member.name,
    stall_id: stall.id,
    confirmed_by_name: req.user.name
  });

  res.json({
    attendance: record,
    member,
    message: `Badge verified! Attendance confirmed for ${member.name}.`
  });
});

export default router;
