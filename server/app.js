import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { authenticateUser } from './rbac.js';

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Async Firebase token verification middleware
app.use(authenticateUser);

// Inject Firebase Web Config for the client (with fallbacks)
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDwRnL6LDmnl81OwYmhbPpTaWJOv3UQzWU',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'aadix001.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'aadix001',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '653439560758',
    appId: process.env.FIREBASE_APP_ID || '1:653439560758:web:03754bd2a88912cc85fc97'
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

// Unified portal redirects
app.get('/admin', (req, res) => res.redirect('/'));
app.get('/admin/*', (req, res) => res.redirect('/'));

// Serve Static Web Frontend
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for SPA routing (all non-API GET requests)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  next();
});

export default app;
