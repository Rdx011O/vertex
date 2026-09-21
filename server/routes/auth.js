import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get list of all available user profiles to allow quick role switching / logins
router.get('/users', (req, res) => {
  const usersWithStallInfo = db.data.users.map(u => {
    const stall = u.stall_id ? db.data.stalls.find(s => s.id === u.stall_id) : null;
    return {
      ...u,
      stall_name: stall ? stall.name : null,
      stall_category: stall ? stall.category : null
    };
  });
  res.json({ users: usersWithStallInfo });
});

// Get currently authenticated user details
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const stall = req.user.stall_id ? db.data.stalls.find(s => s.id === req.user.stall_id) : null;
  res.json({
    user: {
      ...req.user,
      stall_name: stall ? stall.name : null,
      stall_category: stall ? stall.category : null
    }
  });
});

export default router;
