/**
 * Vertex API Client & Real-time Offline-First Sync Engine
 */

class ApiService {
  constructor() {
    this.baseUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    this.ws = null;
    this.activeUserId = null;
    this.listeners = new Set();
    this.isSimulatedOffline = false;
    this.offlineQueue = this.loadOfflineQueue();
    this.isSyncing = false;

    this.initWebSocket();
  }

  setUserId(userId) {
    this.activeUserId = userId;
  }

  // Offline Queue Storage
  loadOfflineQueue() {
    try {
      const data = localStorage.getItem('vertex_offline_queue');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveOfflineQueue() {
    try {
      localStorage.setItem('vertex_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) {
      console.error('Failed to save offline queue', e);
    }
  }

  setSimulatedOffline(isOffline) {
    this.isSimulatedOffline = isOffline;
    console.log(`[Network] Simulated Offline Mode: ${isOffline ? 'ACTIVE (Disconnected)' : 'INACTIVE (Connected)'}`);
    this.notifyListeners({ type: 'NETWORK_STATUS_CHANGED', isOffline: this.isSimulatedOffline });

    if (!isOffline) {
      this.syncOfflineQueue();
    }
  }

  // WebSocket Connection
  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected to Vertex server');
        this.notifyListeners({ type: 'WS_STATUS', status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners(data);
        } catch (err) {
          console.error('[WebSocket] Message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this.notifyListeners({ type: 'WS_STATUS', status: 'disconnected' });
        // Auto-reconnect after 3s
        setTimeout(() => this.initWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error');
      };
    } catch (err) {
      console.error('[WebSocket] Init failed:', err);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in API listener:', err);
      }
    }
  }

  // HTTP Request Helper
  async request(endpoint, options = {}) {
    // If simulated offline mode is on, reject write/fetch unless queued
    if (this.isSimulatedOffline && options.method && options.method !== 'GET') {
      if (endpoint === '/api/sales/submit') {
        // Queue offline sales submission
        const payload = JSON.parse(options.body || '{}');
        const queueItem = {
          id: 'q-' + Date.now(),
          endpoint,
          payload,
          timestamp: new Date().toISOString()
        };
        this.offlineQueue.push(queueItem);
        this.saveOfflineQueue();
        this.notifyListeners({ type: 'OFFLINE_QUEUE_UPDATED', queue: this.offlineQueue });

        return {
          submission: {
            id: 'offline-' + Date.now(),
            stall_id: payload.stall_id,
            total_amount: Number(payload.online_total || 0) + Number(payload.offline_total || 0),
            status: 'queued_offline',
            idempotency_key: payload.idempotency_key,
            submitted_at: queueItem.timestamp
          },
          items: payload.items || [],
          offline_queued: true,
          message: 'Saved locally in offline POS queue. Will automatically submit when online.'
        };
      }
      throw new Error('Network is offline (Simulated dead spot)');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(this.activeUserId ? { 'X-User-Id': this.activeUserId } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }

    return data;
  }

  // Synchronize Offline Queue
  async syncOfflineQueue() {
    if (this.isSyncing || this.offlineQueue.length === 0 || this.isSimulatedOffline) return;

    this.isSyncing = true;
    console.log(`[Sync] Attempting to sync ${this.offlineQueue.length} offline transactions...`);

    const remainingQueue = [];
    for (const item of this.offlineQueue) {
      try {
        await this.request(item.endpoint, {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        console.log(`[Sync] Successfully synced offline submission (Idempotency Key: ${item.payload.idempotency_key})`);
      } catch (err) {
        console.error('[Sync] Failed to sync item, retaining in queue:', err);
        remainingQueue.push(item);
      }
    }

    this.offlineQueue = remainingQueue;
    this.saveOfflineQueue();
    this.isSyncing = false;
    this.notifyListeners({ type: 'OFFLINE_QUEUE_UPDATED', queue: this.offlineQueue });
  }

  // API Methods
  async getUsers() { return (await this.request('/api/auth/users')).users; }
  async getMe() { return (await this.request('/api/auth/me')).user; }
  
  async getStalls() { return (await this.request('/api/stalls')).stalls; }
  async getEventSummary() { return (await this.request('/api/stalls/summary/event')).summary; }
  async getStallDetails(stallId) { return (await this.request(`/api/stalls/${stallId}`)).stall; }
  
  async createStall(stallData) {
    return await this.request('/api/stalls', { method: 'POST', body: JSON.stringify(stallData) });
  }

  async updateStallStatus(stallId, statusData) {
    return await this.request(`/api/stalls/${stallId}/status`, { method: 'PATCH', body: JSON.stringify(statusData) });
  }

  async logExpense(stallId, expenseData) {
    return await this.request(`/api/stalls/${stallId}/expenses`, { method: 'POST', body: JSON.stringify(expenseData) });
  }

  async submitSales(salesData) {
    return await this.request('/api/sales/submit', { method: 'POST', body: JSON.stringify(salesData) });
  }

  async getPendingSales() {
    return (await this.request('/api/sales/pending')).pending_submissions;
  }

  async verifySale(submissionId) {
    return await this.request(`/api/sales/${submissionId}/verify`, { method: 'POST' });
  }

  async rejectSale(submissionId, reason) {
    return await this.request(`/api/sales/${submissionId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async getStallAttendance(stallId) {
    return await this.request(`/api/attendance/stall/${stallId}`);
  }

  async requestCheckin() {
    return await this.request('/api/attendance/checkin-request', { method: 'POST' });
  }

  async confirmAttendance(attendanceId, method = 'COORDINATOR_CONFIRMED') {
    return await this.request(`/api/attendance/${attendanceId}/confirm`, { method: 'POST', body: JSON.stringify({ method }) });
  }

  async scanConfirmAttendance(badgeCode) {
    return await this.request('/api/attendance/scan-confirm', { method: 'POST', body: JSON.stringify({ badge_code: badgeCode }) });
  }

  async getNotifications() {
    return (await this.request('/api/notifications')).notifications;
  }

  async broadcastAnnouncement(title, message, targetRole = 'all') {
    return await this.request('/api/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, message, target_role: targetRole })
    });
  }

  async getAuditLogs(limit = 100) {
    return (await this.request(`/api/audit?limit=${limit}`)).logs;
  }

  async resetDemo() {
    return await this.request('/api/audit/reset-demo', { method: 'POST' });
  }
}

export const api = new ApiService();
export default api;
