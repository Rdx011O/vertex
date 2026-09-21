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

// Attach user authentication from headers
app.use(authenticateUser);

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

// Serve Static Web Frontend
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
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
  console.log(`🌐 Web URL: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
