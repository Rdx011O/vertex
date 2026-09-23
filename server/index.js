import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { authenticateUser } from './rbac.js';
import { realtime } from './ws.js';

// Route handlers
import authRoutes from './routes/auth.js';
import stallsRoutes from './routes/stalls.js';
import salesRoutes from './routes/sales.js';
import attendanceRoutes from './routes/attendance.js';
import notificationsRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Async Firebase token verification middleware
app.use(authenticateUser);

// Inject Firebase Web Config as a script tag for the client
// This keeps the config server-side and out of the git repo
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stalls', stallsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Vertex Event Operations System',
    event: 'Building Pravara 2026',
    time: new Date().toISOString()
  });
});

// Admin portal route — serve admin.html for /admin/*
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Serve Static Web Frontend
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for main portal SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  next();
});

// Initialize WebSocket Hub
realtime.init(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚡ VERTEX Event Operations System is live`);
  console.log(`📍 Event: Building Pravara 2026 (Oct 1–4, 2026)`);
  console.log(`🌐 Student Portal: http://localhost:${PORT}`);
  console.log(`🔐 Admin Portal:   http://localhost:${PORT}/admin`);
  console.log(`📡 WebSocket:      ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
