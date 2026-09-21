import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'vertex_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data based on Project Context & Financial Logic docs
function getInitialSeedData() {
  const eventId = 'ev-bp-2026';
  
  // Users: Admin, Coordinators, Members
  const adminId = 'usr-admin-01';
  const coordAId = 'usr-coord-01';
  const coordBId = 'usr-coord-02';
  const coordCId = 'usr-coord-03';
  const coordDId = 'usr-coord-04';
  const coordEId = 'usr-coord-05';
  
  const memberA1Id = 'usr-mem-01';
  const memberA2Id = 'usr-mem-02';
  const memberB1Id = 'usr-mem-03';
  const memberB2Id = 'usr-mem-04';
  const memberC1Id = 'usr-mem-05';
  const memberD1Id = 'usr-mem-06';
  const memberE1Id = 'usr-mem-07';

  // Stalls
  const stallAId = 'stl-ai-playground';
  const stallBId = 'stl-bytebazaar';
  const stallCId = 'stl-robocombat';
  const stallDId = 'stl-agritech';
  const stallEId = 'stl-foodfiesta';

  const events = [
    {
      id: eventId,
      name: 'Building Pravara 2026',
      venue: 'Pravara Rural Engineering College, Loni',
      start_date: '2026-10-01',
      end_date: '2026-10-04',
      status: 'active',
      description: 'The flagship annual technology, entrepreneurship & innovation festival.'
    }
  ];

  const stalls = [
    {
      id: stallAId,
      name: 'AI Playground',
      category: 'Tech & Gaming',
      event_id: eventId,
      coordinator_user_id: coordAId,
      status: 'active',
      banner_color: '#4F46E5',
      location: 'Hall A - Booth 12',
      created_at: new Date('2026-09-21T08:00:00Z').toISOString()
    },
    {
      id: stallBId,
      name: 'ByteBazaar',
      category: 'Electronics & DIY',
      event_id: eventId,
      coordinator_user_id: coordBId,
      status: 'active',
      banner_color: '#0284C7',
      location: 'Hall A - Booth 14',
      created_at: new Date('2026-09-21T08:00:00Z').toISOString()
    },
    {
      id: stallCId,
      name: 'RoboCombat Arena',
      category: 'Robotics',
      event_id: eventId,
      coordinator_user_id: coordCId,
      status: 'active',
      banner_color: '#DC2626',
      location: 'Central Courtyard',
      created_at: new Date('2026-09-21T08:00:00Z').toISOString()
    },
    {
      id: stallDId,
      name: 'AgriTech Innovations',
      category: 'Rural Tech',
      event_id: eventId,
      coordinator_user_id: coordDId,
      status: 'active',
      banner_color: '#059669',
      location: 'Innovation Pavilion - B04',
      created_at: new Date('2026-09-21T08:00:00Z').toISOString()
    },
    {
      id: stallEId,
      name: 'Food Fiesta & Refreshments',
      category: 'Food & Beverage',
      event_id: eventId,
      coordinator_user_id: coordEId,
      status: 'active',
      banner_color: '#D97706',
      location: 'Food Court - Stall 01',
      created_at: new Date('2026-09-21T08:00:00Z').toISOString()
    }
  ];

  const users = [
    {
      id: adminId,
      name: 'Prof. Rajesh Sharma',
      role: 'admin',
      stall_id: null,
      email: 'admin.pravara@prec.ac.in',
      phone: '+91 98220 11223',
      designation: 'Event Operations Director',
      badge_code: 'BP-ADM-001'
    },
    {
      id: coordAId,
      name: 'Aarav Deshmukh',
      role: 'coordinator',
      stall_id: stallAId,
      email: 'aarav.deshmukh@prec.ac.in',
      phone: '+91 94231 44556',
      designation: 'AI Playground Coordinator',
      badge_code: 'BP-CRD-101'
    },
    {
      id: coordBId,
      name: 'Pooja Kulkarni',
      role: 'coordinator',
      stall_id: stallBId,
      email: 'pooja.kulkarni@prec.ac.in',
      phone: '+91 98501 77889',
      designation: 'ByteBazaar Coordinator',
      badge_code: 'BP-CRD-102'
    },
    {
      id: coordCId,
      name: 'Rohan Patil',
      role: 'coordinator',
      stall_id: stallCId,
      email: 'rohan.patil@prec.ac.in',
      phone: '+91 91580 33445',
      designation: 'RoboCombat Coordinator',
      badge_code: 'BP-CRD-103'
    },
    {
      id: coordDId,
      name: 'Sneha Vikhe',
      role: 'coordinator',
      stall_id: stallDId,
      email: 'sneha.vikhe@prec.ac.in',
      phone: '+91 97632 66778',
      designation: 'AgriTech Coordinator',
      badge_code: 'BP-CRD-104'
    },
    {
      id: coordEId,
      name: 'Nikhil Pawar',
      role: 'coordinator',
      stall_id: stallEId,
      email: 'nikhil.pawar@prec.ac.in',
      phone: '+91 99214 88990',
      designation: 'Food Fiesta Coordinator',
      badge_code: 'BP-CRD-105'
    },
    // Members
    {
      id: memberA1Id,
      name: 'Tanvi Shinde',
      role: 'member',
      stall_id: stallAId,
      email: 'tanvi.shinde@prec.ac.in',
      phone: '+91 88881 12345',
      designation: 'Team Member - AI Model Ops',
      badge_code: 'BP-MEM-201'
    },
    {
      id: memberA2Id,
      name: 'Siddharth Jadhav',
      role: 'member',
      stall_id: stallAId,
      email: 'siddharth.j@prec.ac.in',
      phone: '+91 88882 23456',
      designation: 'Team Member - VR Setup',
      badge_code: 'BP-MEM-202'
    },
    {
      id: memberB1Id,
      name: 'Ananya More',
      role: 'member',
      stall_id: stallBId,
      email: 'ananya.more@prec.ac.in',
      phone: '+91 88883 34567',
      designation: 'Team Member - Inventory',
      badge_code: 'BP-MEM-203'
    },
    {
      id: memberB2Id,
      name: 'Vikram Joshi',
      role: 'member',
      stall_id: stallBId,
      email: 'vikram.j@prec.ac.in',
      phone: '+91 88884 45678',
      designation: 'Team Member - Sales Support',
      badge_code: 'BP-MEM-204'
    },
    {
      id: memberC1Id,
      name: 'Omkar Gite',
      role: 'member',
      stall_id: stallCId,
      email: 'omkar.gite@prec.ac.in',
      phone: '+91 88885 56789',
      designation: 'Team Member - Arena Marshall',
      badge_code: 'BP-MEM-205'
    },
    {
      id: memberD1Id,
      name: 'Kavita Tambe',
      role: 'member',
      stall_id: stallDId,
      email: 'kavita.tambe@prec.ac.in',
      phone: '+91 88886 67890',
      designation: 'Team Member - IoT Demos',
      badge_code: 'BP-MEM-206'
    },
    {
      id: memberE1Id,
      name: 'Aditya Kale',
      role: 'member',
      stall_id: stallEId,
      email: 'aditya.kale@prec.ac.in',
      phone: '+91 88887 78901',
      designation: 'Team Member - Kitchen Ops',
      badge_code: 'BP-MEM-207'
    }
  ];

  // Expenses matching 04-FINANCIAL_LOGIC.md worked examples
  const stall_expenses = [
    // AI Playground: Total = ₹22,500
    { id: 'exp-01', stall_id: stallAId, category: 'Stall Rent', name: 'Premium Tech Hall Booth Rent (4 Days)', amount: 12000, logged_by: coordAId, timestamp: '2026-09-28T10:00:00Z' },
    { id: 'exp-02', stall_id: stallAId, category: 'Banners & Marketing', name: 'Standees, Glow Signs & Flyers', amount: 4500, logged_by: coordAId, timestamp: '2026-09-29T14:30:00Z' },
    { id: 'exp-03', stall_id: stallAId, category: 'Hardware & Kits', name: 'VR Headset Disposables & Sensor Kits', amount: 6000, logged_by: coordAId, timestamp: '2026-09-30T11:00:00Z' },

    // ByteBazaar: Total = ₹21,700
    { id: 'exp-04', stall_id: stallBId, category: 'Stall Rent', name: 'Standard Hall Booth Rent', amount: 9000, logged_by: coordBId, timestamp: '2026-09-28T10:30:00Z' },
    { id: 'exp-05', stall_id: stallBId, category: 'Inventory Purchase', name: 'Arduino / ESP32 DIY Modules', amount: 9500, logged_by: coordBId, timestamp: '2026-09-29T12:00:00Z' },
    { id: 'exp-06', stall_id: stallBId, category: 'Packaging', name: 'Anti-static Pouches & Labels', amount: 3200, logged_by: coordBId, timestamp: '2026-09-30T15:00:00Z' },

    // RoboCombat: Total = ₹30,000
    { id: 'exp-07', stall_id: stallCId, category: 'Arena Construction', name: 'Polycarbonate Safety Barriers & Metal Deck', amount: 18000, logged_by: coordCId, timestamp: '2026-09-27T09:00:00Z' },
    { id: 'exp-08', stall_id: stallCId, category: 'Prizes & Trophies', name: 'Championship Trophies & Medals', amount: 8000, logged_by: coordCId, timestamp: '2026-09-29T16:00:00Z' },
    { id: 'exp-09', stall_id: stallCId, category: 'Maintenance', name: 'LiPo Battery Charging Station & Tools', amount: 4000, logged_by: coordCId, timestamp: '2026-09-30T16:30:00Z' },

    // AgriTech Innovations: Total = ₹14,000
    { id: 'exp-10', stall_id: stallDId, category: 'Stall Rent', name: 'Innovation Pavilion Space', amount: 8000, logged_by: coordDId, timestamp: '2026-09-28T11:00:00Z' },
    { id: 'exp-11', stall_id: stallDId, category: 'Prototypes', name: 'Soil Moisture & Drip Automation Display Units', amount: 6000, logged_by: coordDId, timestamp: '2026-09-29T10:00:00Z' },

    // Food Fiesta: Total = ₹35,000
    { id: 'exp-12', stall_id: stallEId, category: 'Stall Rent', name: 'Food Court Prime Slot', amount: 15000, logged_by: coordEId, timestamp: '2026-09-28T14:00:00Z' },
    { id: 'exp-13', stall_id: stallEId, category: 'Raw Materials', name: 'Beverage Concentrates, Bakery & Snacks Supply', amount: 16000, logged_by: coordEId, timestamp: '2026-09-30T18:00:00Z' },
    { id: 'exp-14', stall_id: stallEId, category: 'Hygiene & Packaging', name: 'Biodegradable Cups, Plates & Gloves', amount: 4000, logged_by: coordEId, timestamp: '2026-09-30T19:00:00Z' }
  ];

  const sub1Id = 'sub-ai-day1-verified';
  const sub2Id = 'sub-byte-day1-verified';
  const sub3Id = 'sub-robo-day1-verified';
  const sub4Id = 'sub-agri-day1-verified';
  const sub5Id = 'sub-food-day1-pending';
  const sub6Id = 'sub-byte-day2-pending';

  const sales_submissions = [
    {
      id: sub1Id,
      stall_id: stallAId,
      submitted_by_user_id: coordAId,
      online_total: 28000,
      offline_total: 17600,
      total_amount: 45600,
      status: 'verified',
      verified_by_user_id: adminId,
      verified_at: '2026-10-01T20:30:00Z',
      idempotency_key: 'idem-sub-ai-day1-001',
      notes: 'Day 1 Full Operations - Massive VR footfall',
      submitted_at: '2026-10-01T19:45:00Z'
    },
    {
      id: sub2Id,
      stall_id: stallBId,
      submitted_by_user_id: coordBId,
      online_total: 11400,
      offline_total: 8000,
      total_amount: 19400,
      status: 'verified',
      verified_by_user_id: adminId,
      verified_at: '2026-10-01T20:45:00Z',
      idempotency_key: 'idem-sub-byte-day1-002',
      notes: 'Day 1 DIY kit sales tally',
      submitted_at: '2026-10-01T20:00:00Z'
    },
    {
      id: sub3Id,
      stall_id: stallCId,
      submitted_by_user_id: coordCId,
      online_total: 22500,
      offline_total: 12500,
      total_amount: 35000,
      status: 'verified',
      verified_by_user_id: adminId,
      verified_at: '2026-10-01T21:00:00Z',
      idempotency_key: 'idem-sub-robo-day1-003',
      notes: 'Day 1 Tournament Arena entries & match tickets',
      submitted_at: '2026-10-01T20:15:00Z'
    },
    {
      id: sub4Id,
      stall_id: stallDId,
      submitted_by_user_id: coordDId,
      online_total: 7500,
      offline_total: 5000,
      total_amount: 12500,
      status: 'verified',
      verified_by_user_id: adminId,
      verified_at: '2026-10-01T21:15:00Z',
      idempotency_key: 'idem-sub-agri-day1-004',
      notes: 'Day 1 Smart irrigation starter packs',
      submitted_at: '2026-10-01T20:30:00Z'
    },
    {
      id: sub5Id,
      stall_id: stallEId,
      submitted_by_user_id: coordEId,
      online_total: 26400,
      offline_total: 14800,
      total_amount: 41200,
      status: 'pending',
      verified_by_user_id: null,
      verified_at: null,
      idempotency_key: 'idem-sub-food-day1-005',
      notes: 'Day 1 Lunch & Evening snack counters',
      submitted_at: '2026-10-01T21:40:00Z'
    },
    {
      id: sub6Id,
      stall_id: stallBId,
      submitted_by_user_id: coordBId,
      online_total: 4500,
      offline_total: 3200,
      total_amount: 7700,
      status: 'pending',
      verified_by_user_id: null,
      verified_at: null,
      idempotency_key: 'idem-sub-byte-day2-006',
      notes: 'Day 2 Morning: Sensors & Soldering kits',
      submitted_at: new Date().toISOString()
    }
  ];

  const sale_line_items = [
    { id: 'item-01', submission_id: sub1Id, item_name: 'AI Experience Pass (VR + Neural Mesh)', unit_price: 200, qty: 140, payment_mode: 'online' },
    { id: 'item-02', submission_id: sub1Id, item_name: 'Custom AI Generated Poster Print', unit_price: 150, qty: 80, payment_mode: 'offline' },
    { id: 'item-03', submission_id: sub1Id, item_name: 'AI Workshop Quick Enrollment', unit_price: 400, qty: 14, payment_mode: 'offline' },

    { id: 'item-04', submission_id: sub2Id, item_name: 'ESP32 Wi-Fi + BLE Dev Board', unit_price: 380, qty: 30, payment_mode: 'online' },
    { id: 'item-05', submission_id: sub2Id, item_name: 'Sensor Starter Pack (10 in 1)', unit_price: 400, qty: 20, payment_mode: 'offline' },

    { id: 'item-06', submission_id: sub3Id, item_name: 'Bot Battle Entry Ticket', unit_price: 150, qty: 150, payment_mode: 'online' },
    { id: 'item-07', submission_id: sub3Id, item_name: 'VIP Arena Ringside Pass', unit_price: 250, qty: 50, payment_mode: 'offline' },

    { id: 'item-08', submission_id: sub4Id, item_name: 'Soil NPK Digital Meter Kit', unit_price: 750, qty: 10, payment_mode: 'online' },
    { id: 'item-09', submission_id: sub4Id, item_name: 'Mini Automated Drip Valve', unit_price: 500, qty: 10, payment_mode: 'offline' },

    { id: 'item-10', submission_id: sub5Id, item_name: 'Pravara Signature Cold Coffee', unit_price: 80, qty: 180, payment_mode: 'online' },
    { id: 'item-11', submission_id: sub5Id, item_name: 'Crispy Paneer Roll / Kathi Roll', unit_price: 120, qty: 100, payment_mode: 'online' },
    { id: 'item-12', submission_id: sub5Id, item_name: 'Snack Combo & Lemonade', unit_price: 100, qty: 148, payment_mode: 'offline' },

    { id: 'item-13', submission_id: sub6Id, item_name: 'Soldering Wire & Flux Tube', unit_price: 150, qty: 30, payment_mode: 'online' },
    { id: 'item-14', submission_id: sub6Id, item_name: 'OLED Display 0.96 inch I2C', unit_price: 160, qty: 20, payment_mode: 'offline' }
  ];

  const attendance_records = [
    {
      id: 'att-01',
      member_user_id: memberA1Id,
      stall_id: stallAId,
      status: 'confirmed',
      confirmed_by_user_id: coordAId,
      timestamp: '2026-10-01T08:30:00Z',
      date: '2026-10-01',
      verified_method: 'QR_SCAN'
    },
    {
      id: 'att-02',
      member_user_id: memberA2Id,
      stall_id: stallAId,
      status: 'confirmed',
      confirmed_by_user_id: coordAId,
      timestamp: '2026-10-01T08:45:00Z',
      date: '2026-10-01',
      verified_method: 'QR_SCAN'
    },
    {
      id: 'att-03',
      member_user_id: memberB1Id,
      stall_id: stallBId,
      status: 'confirmed',
      confirmed_by_user_id: coordBId,
      timestamp: '2026-10-01T08:50:00Z',
      date: '2026-10-01',
      verified_method: 'LOCATION_REQUEST'
    },
    {
      id: 'att-04',
      member_user_id: memberB2Id,
      stall_id: stallBId,
      status: 'pending_coordinator',
      confirmed_by_user_id: null,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      verified_method: 'LOCATION_REQUEST'
    },
    {
      id: 'att-05',
      member_user_id: memberC1Id,
      stall_id: stallCId,
      status: 'confirmed',
      confirmed_by_user_id: coordCId,
      timestamp: '2026-10-01T08:40:00Z',
      date: '2026-10-01',
      verified_method: 'QR_SCAN'
    },
    {
      id: 'att-06',
      member_user_id: memberD1Id,
      stall_id: stallDId,
      status: 'confirmed',
      confirmed_by_user_id: coordDId,
      timestamp: '2026-10-01T09:00:00Z',
      date: '2026-10-01',
      verified_method: 'QR_SCAN'
    }
  ];

  const notifications = [
    {
      id: 'notif-01',
      target_role: 'all',
      target_scope_id: null,
      title: 'Welcome to Building Pravara 2026',
      message: 'All stall operations are now live. Remember: Every sale submission must be logged via POS before end of day.',
      type: 'announcement',
      created_by: adminId,
      created_at: '2026-10-01T07:30:00Z'
    },
    {
      id: 'notif-02',
      target_role: 'admin',
      target_scope_id: null,
      title: 'Pending Sales Submissions for Verification',
      message: 'Food Fiesta and ByteBazaar have submitted sales logs for verification.',
      type: 'verification_pending',
      created_by: 'system',
      created_at: new Date().toISOString()
    },
    {
      id: 'notif-03',
      target_role: 'coordinator',
      target_scope_id: stallBId,
      title: 'Member Arrival Check-in Request',
      message: 'Vikram Joshi has tapped "I\'m at my stall" and is waiting for your confirmation.',
      type: 'attendance_request',
      created_by: memberB2Id,
      created_at: new Date().toISOString()
    }
  ];

  const audit_logs = [
    {
      id: 'aud-01',
      actor_user_id: adminId,
      actor_name: 'Prof. Rajesh Sharma (Admin)',
      action: 'SYSTEM_INITIALIZED',
      target_type: 'EVENT',
      target_id: eventId,
      details: 'Building Pravara 2026 Event Ledger created with 5 initial registered stalls.',
      timestamp: '2026-09-21T08:00:00Z'
    },
    {
      id: 'aud-02',
      actor_user_id: adminId,
      actor_name: 'Prof. Rajesh Sharma (Admin)',
      action: 'SALES_VERIFIED',
      target_type: 'SALES_SUBMISSION',
      target_id: sub1Id,
      details: 'Verified Day 1 sales log for AI Playground: ₹45,600 (Online: ₹28,000, Offline: ₹17,600).',
      timestamp: '2026-10-01T20:30:00Z'
    },
    {
      id: 'aud-03',
      actor_user_id: adminId,
      actor_name: 'Prof. Rajesh Sharma (Admin)',
      action: 'SALES_VERIFIED',
      target_type: 'SALES_SUBMISSION',
      target_id: sub2Id,
      details: 'Verified Day 1 sales log for ByteBazaar: ₹19,400 (Online: ₹11,400, Offline: ₹8,000).',
      timestamp: '2026-10-01T20:45:00Z'
    },
    {
      id: 'aud-04',
      actor_user_id: coordAId,
      actor_name: 'Aarav Deshmukh (Coordinator)',
      action: 'ATTENDANCE_CONFIRMED',
      target_type: 'ATTENDANCE',
      target_id: 'att-01',
      details: 'Confirmed attendance for Tanvi Shinde at AI Playground via QR Scan.',
      timestamp: '2026-10-01T08:30:00Z'
    }
  ];

  const pos_catalog = [
    { id: 'cat-01', stall_id: stallAId, name: 'AI Experience Pass', price: 200, category: 'Pass' },
    { id: 'cat-02', stall_id: stallAId, name: 'AI Poster Print', price: 150, category: 'Merch' },
    { id: 'cat-03', stall_id: stallAId, name: 'AI Workshop Reg', price: 400, category: 'Workshop' },
    { id: 'cat-04', stall_id: stallAId, name: 'Neural Sticker Pack', price: 50, category: 'Merch' },
    
    { id: 'cat-05', stall_id: stallBId, name: 'ESP32 Wi-Fi Board', price: 380, category: 'Boards' },
    { id: 'cat-06', stall_id: stallBId, name: 'Sensor Starter Pack', price: 400, category: 'Sensors' },
    { id: 'cat-07', stall_id: stallBId, name: 'OLED Display 0.96"', price: 160, category: 'Displays' },
    { id: 'cat-08', stall_id: stallBId, name: 'Jumper Wire Bundle', price: 80, category: 'Cables' },
    { id: 'cat-09', stall_id: stallBId, name: 'Soldering Kit Tube', price: 150, category: 'Tools' },

    { id: 'cat-10', stall_id: stallCId, name: 'Combat Arena Pass', price: 150, category: 'Pass' },
    { id: 'cat-11', stall_id: stallCId, name: 'VIP Ringside Pass', price: 250, category: 'Pass' },
    { id: 'cat-12', stall_id: stallCId, name: 'Team Registration', price: 1000, category: 'Entry' },
    { id: 'cat-13', stall_id: stallCId, name: 'Robo Mech Badge', price: 100, category: 'Merch' },

    { id: 'cat-14', stall_id: stallDId, name: 'Soil NPK Digital Meter', price: 750, category: 'Kits' },
    { id: 'cat-15', stall_id: stallDId, name: 'Drip Automation Valve', price: 500, category: 'Kits' },
    { id: 'cat-16', stall_id: stallDId, name: 'Solar Ag-Pump Controller', price: 1200, category: 'Kits' },

    { id: 'cat-17', stall_id: stallEId, name: 'Pravara Cold Coffee', price: 80, category: 'Beverage' },
    { id: 'cat-18', stall_id: stallEId, name: 'Crispy Paneer Roll', price: 120, category: 'Food' },
    { id: 'cat-19', stall_id: stallEId, name: 'Combo Meal Box', price: 160, category: 'Food' },
    { id: 'cat-20', stall_id: stallEId, name: 'Fresh Lemonade', price: 40, category: 'Beverage' }
  ];

  return {
    events,
    stalls,
    users,
    stall_expenses,
    sales_submissions,
    sale_line_items,
    attendance_records,
    notifications,
    audit_logs,
    pos_catalog
  };
}

class Database {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = getInitialSeedData();
        this.save();
      }
    } catch (err) {
      console.error('Failed to load db file, initializing with fresh seed data:', err);
      this.data = getInitialSeedData();
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to DB file:', err);
    }
  }

  reset() {
    this.data = getInitialSeedData();
    this.save();
    return this.data;
  }

  logAudit(actorUserId, actorName, action, targetType, targetId, details) {
    const entry = {
      id: 'aud-' + uuidv4().slice(0, 8),
      actor_user_id: actorUserId,
      actor_name: actorName,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      timestamp: new Date().toISOString()
    };
    this.data.audit_logs.unshift(entry);
    this.save();
    return entry;
  }
}

export const db = new Database();
export default db;
