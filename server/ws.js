import { WebSocketServer, WebSocket } from 'ws';

class RealtimeHub {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      
      // Send initial welcome & heartbeat
      ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG' }));
          }
        } catch (err) {
          // ignore malformed ping
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WS client error:', err);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket] Realtime Hub initialized on /ws');
  }

  broadcast(type, payload) {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const realtime = new RealtimeHub();
export default realtime;
