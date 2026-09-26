/**
 * Vertex API Client — Bearer Token Auth
 * All requests send Authorization: Bearer <firebase_id_token>
 */

class ApiService {
  constructor() {
    this.baseUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    this.ws = null;
    this.idToken = null;           // Firebase ID token
    this.getTokenFn = null;        // Function that returns fresh token
    this.listeners = new Set();
    this.isSimulatedOffline = false;
    this.offlineQueue = this.loadOfflineQueue();
    this.isSyncing = false;

    this.initWebSocket();
  }

  /** Called by app.js after Firebase auth — provides a getter for fresh tokens */
  setTokenProvider(fn) {
    this.getTokenFn = fn;
  }

  async getToken() {
    if (this.getTokenFn) {
      try {
        this.idToken = await this.getTokenFn();
      } catch (e) {
        console.warn('[Auth] Could not refresh token:', e);
      }
    }
    return this.idToken;
  }

  // Offline Queue Storage
  loadOfflineQueue() {
    try {
      const data = localStorage.getItem('vertex_offline_queue');
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  saveOfflineQueue() {
    try {
      localStorage.setItem('vertex_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) { console.error('Failed to save offline queue', e); }
  }

  setSimulatedOffline(isOffline) {
    this.isSimulatedOffline = isOffline;
    this.notifyListeners({ type: 'NETWORK_STATUS_CHANGED', isOffline: this.isSimulatedOffline });
    if (!isOffline) this.syncOfflineQueue();
  }

  // WebSocket Connection
  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => this.notifyListeners({ type: 'WS_STATUS', status: 'connected' });
      this.ws.onmessage = (event) => {
        try { this.notifyListeners(JSON.parse(event.data)); }
        catch (err) { console.error('[WebSocket] Message parse error:', err); }
      };
      this.ws.onclose = () => {
        this.notifyListeners({ type: 'WS_STATUS', status: 'disconnected' });
        setTimeout(() => this.initWebSocket(), 3000);
      };
      this.ws.onerror = () => console.warn('[WebSocket] Connection error');
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
      try { listener(data); }
      catch (err) { console.error('Error in API listener:', err); }
    }
  }

  // HTTP Request Helper
  async request(endpoint, options = {}) {
    // Offline queue for POS sales
    if (this.isSimulatedOffline && options.method && options.method !== 'GET') {
      if (endpoint === '/api/sales/submit') {
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
          message: 'Saved locally. Will auto-submit when back online.'
        };
      }
      throw new Error('Network is offline (Simulated dead spot)');
    }

    const token = await this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      if (!response.ok) {
        throw new Error(text || `Server error (${response.status})`);
      }
      throw new Error(`Unexpected server response: ${text.slice(0, 150)}`);
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP error ${response.status}`);
    }
    return data;
  }

  async syncOfflineQueue() {
    if (this.isSyncing || this.offlineQueue.length === 0 || this.isSimulatedOffline) return;
    this.isSyncing = true;
    const remainingQueue = [];
    for (const item of this.offlineQueue) {
      try {
        await this.request(item.endpoint, { method: 'POST', body: JSON.stringify(item.payload) });
      } catch (err) {
        remainingQueue.push(item);
      }
    }
    this.offlineQueue = remainingQueue;
    this.saveOfflineQueue();
    this.isSyncing = false;
    this.notifyListeners({ type: 'OFFLINE_QUEUE_UPDATED', queue: this.offlineQueue });
  }

  // API Methods
  async registerProfile(name, phone, desiredRole, extra = {}) {
    return await this.request('/api/auth/register-profile', {
      method: 'POST',
      body: JSON.stringify({ name, phone, desired_role: desiredRole, ...extra })
    });
  }

  async claimRole(roleData) {
    return await this.request('/api/auth/claim-role', {
      method: 'POST',
      body: JSON.stringify(roleData)
    });
  }

  async getMe() { return (await this.request('/api/auth/me')).user; }

  async getStalls() { return (await this.request('/api/stalls')).stalls; }
  async getEventSummary() { return (await this.request('/api/stalls/summary/event')).summary; }
  async getStallDetails(stallId) { return (await this.request(`/api/stalls/${stallId}`)).stall; }

  async setupStall(stallData) {
    return await this.request('/api/stalls/setup', { method: 'POST', body: JSON.stringify(stallData) });
  }

  async createStall(stallData) {
    return await this.request('/api/stalls', { method: 'POST', body: JSON.stringify(stallData) });
  }

  async updateStall(stallId, stallData) {
    return await this.request(`/api/stalls/${stallId}`, { method: 'PUT', body: JSON.stringify(stallData) });
  }

  async deleteStall(stallId) {
    return await this.request(`/api/stalls/${stallId}`, { method: 'DELETE' });
  }

  async issueStallWarning(stallId, reason) {
    return await this.request(`/api/stalls/${stallId}/manage/warning`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async discontinueUserFromStall(stallId, { userId, reason }) {
    return await this.request(`/api/stalls/${stallId}/manage/discontinue-user`, { method: 'POST', body: JSON.stringify({ user_id: userId, reason }) });
  }

  async flagStallOrUser(stallId, { targetType, userId, reason }) {
    return await this.request(`/api/stalls/${stallId}/manage/flag`, { method: 'POST', body: JSON.stringify({ target_type: targetType, user_id: userId, reason }) });
  }

  async discontinueStall(stallId, reason) {
    return await this.request(`/api/stalls/${stallId}/manage/discontinue`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async updateStallStatus(stallId, statusData) {
    return await this.request(`/api/stalls/${stallId}/status`, { method: 'PATCH', body: JSON.stringify(statusData) });
  }

  async logExpense(stallId, expenseData) {
    return await this.request(`/api/stalls/${stallId}/expenses`, { method: 'POST', body: JSON.stringify(expenseData) });
  }

  async addCatalogItem(stallId, item) {
    return await this.request(`/api/stalls/${stallId}/catalog`, { method: 'POST', body: JSON.stringify(item) });
  }

  async deleteCatalogItem(stallId, itemId) {
    return await this.request(`/api/stalls/${stallId}/catalog/${itemId}`, { method: 'DELETE' });
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

  async getQRBadge(userId = '') {
    return (await this.request(userId ? `/api/attendance/qr-badge/${userId}` : '/api/attendance/qr-badge')).badge;
  }

  async scanConfirmAttendance(data) {
    const body = typeof data === 'string' ? { raw_scan: data } : data;
    return await this.request('/api/attendance/scan-confirm', { method: 'POST', body: JSON.stringify(body) });
  }

  async getNotifications() {
    return (await this.request('/api/notifications')).notifications;
  }

  async markNotificationRead(notifId) {
    return await this.request(`/api/notifications/${notifId}/read`, { method: 'POST' });
  }

  async markNotificationsSeen() {
    return await this.request('/api/notifications/mark-seen', { method: 'POST' });
  }

  async broadcastAnnouncement(title, message, targetRole = 'all') {
    return await this.request('/api/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, message, target_role: targetRole })
    });
  }

  async getAuditLogs(limit = 100, action = '', category = '') {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (action) params.set('action', action);
    if (category) params.set('category', category);
    return (await this.request(`/api/audit?${params.toString()}`)).logs;
  }

  async getAllUsers() {
    return (await this.request('/api/auth/users')).users;
  }

  async assignUserRole(uid, role, stallId = null) {
    return await this.request(`/api/auth/users/${uid}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, stall_id: stallId })
    });
  }

  async removeUser(uid) {
    return await this.request(`/api/auth/users/${uid}`, { method: 'DELETE' });
  }

  async addStallMember(stallId, memberData) {
    return await this.request(`/api/stalls/${stallId}/members`, {
      method: 'POST',
      body: JSON.stringify(memberData)
    });
  }

  async removeStallMember(stallId, memberId) {
    return await this.request(`/api/stalls/${stallId}/members/${memberId}`, {
      method: 'DELETE'
    });
  }

  async submitStallJoinRequest(inviteCode) {
    return await this.request('/api/stalls/join-request', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode })
    });
  }

  async getStallJoinRequests(stallId) {
    return (await this.request(`/api/stalls/${stallId}/join-requests`)).requests;
  }

  async approveJoinRequest(stallId, requestId) {
    return await this.request(`/api/stalls/${stallId}/join-requests/${requestId}/approve`, {
      method: 'POST'
    });
  }

  async rejectJoinRequest(stallId, requestId) {
    return await this.request(`/api/stalls/${stallId}/join-requests/${requestId}/reject`, {
      method: 'POST'
    });
  }

  async resetDemo() {
    return await this.request('/api/audit/reset-demo', { method: 'POST' });
  }
}

export const api = new ApiService();
export default api;
