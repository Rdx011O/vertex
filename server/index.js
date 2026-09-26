import http from 'http';
import app from './app.js';
import { realtime } from './ws.js';

const server = http.createServer(app);

// Initialize WebSocket Hub
realtime.init(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚡ VERTEX Event Operations System is live`);
  console.log(`📍 Event: Building Pravara 2026 (Oct 1–4, 2026)`);
  console.log(`🌐 Unified Portal:  http://localhost:${PORT}`);
  console.log(`   (Admin, Coordinator & Member — all sign in here)`);
  console.log(`📡 WebSocket:       ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
