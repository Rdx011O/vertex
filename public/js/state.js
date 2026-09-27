/**
 * Vertex Application Reactive State Store (Firebase-Auth-aware)
 */

import api from './api.js';

class AppState {
  constructor() {
    this.currentUser = null;       // DB profile (from /api/auth/me)
    this.firebaseUser = null;      // Firebase Auth user object
    this.isAuthenticated = false;
    this.stalls = [];
    this.eventSummary = null;
    this.activeStall = null;
    this.activeTab = 'analytics';
    this.notifications = [];
    this.unreadCount = 0;
    this.auditLogs = [];
    this.pendingSales = [];
    this.allUsers = [];            // Admin: all registered users
    this.isRegistering = false;    // True while signup form is completing registration
    this.theme = localStorage.getItem('vertex_theme') || 'light';
    this.listeners = new Set();
  }

  initTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('vertex_theme', this.theme);
    this.initTheme();
    this.emitChange();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange() {
    for (const listener of this.listeners) {
      try { listener(this); }
      catch (err) { console.error('State listener error:', err); }
    }
  }

  /** Called by app.js when Firebase Auth state changes */
  async onFirebaseAuth(firebaseUser) {
    this.firebaseUser = firebaseUser;

    if (!firebaseUser) {
      // Logged out
      this.isAuthenticated = false;
      this.currentUser = null;
      this.stalls = [];
      this.activeStall = null;
      this.emitChange();
      return;
    }

    this.isAuthenticated = true;

    // Set token provider on API client
    api.setTokenProvider(() => firebaseUser.getIdToken(false));

    // Load profile from DB
    try {
      this.currentUser = await api.getMe();
    } catch (err) {
      // PROFILE_NOT_FOUND → user just signed up, needs register-profile step
      if (err.message && err.message.includes('Profile not found')) {
        this.currentUser = null; // triggers registration screen
      } else {
        console.error('Failed to fetch user profile:', err);
      }
    }

    // Immediately emit change so shell/dashboard renders without delay
    this.emitChange();

    // Concurrently fetch all operational data in background
    if (this.currentUser) {
      this.refreshAll();
    }
  }

  setTab(tabId) {
    this.activeTab = tabId;
    this.emitChange();
  }

  markNotificationAsRead(notifId) {
    if (!notifId) return;
    const notif = (this.notifications || []).find(n => n.id === notifId);
    if (notif) {
      notif.is_read = true;
    }
    this.unreadCount = Math.max(0, (this.notifications || []).filter(n => !n.is_read).length);
    window.updateHeaderNotificationBadge?.();
    this.emitChange();
  }

  markAllNotificationsAsRead() {
    (this.notifications || []).forEach(n => {
      n.is_read = true;
    });
    this.unreadCount = 0;
    window.updateHeaderNotificationBadge?.();
    this.emitChange();
  }

  addNotification(notif) {
    if (!notif || !notif.id) return;
    const exists = (this.notifications || []).find(n => n.id === notif.id);
    if (!exists) {
      this.notifications.unshift(notif);
      this.unreadCount = (this.notifications || []).filter(n => !n.is_read).length;
      window.updateHeaderNotificationBadge?.();
      this.emitChange();
    }
  }

  scheduleRefresh(delay = 400) {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    // Add 50-250ms random jitter so multiple browser windows do not fire at the exact same millisecond
    const jitter = Math.floor(Math.random() * 200);
    this._refreshTimer = setTimeout(() => {
      this.refreshAll();
    }, delay + jitter);
  }

  async refreshAll() {
    if (this._isRefreshing) {
      this._hasQueuedRefresh = true;
      return;
    }
    this._isRefreshing = true;

    try {
      const promises = [
        api.getEventSummary()
          .then(s => { if (s) this.eventSummary = s; })
          .catch(e => console.warn('[State] getEventSummary:', e.message)),
        api.getStalls()
          .then(s => { if (Array.isArray(s)) this.stalls = s; })
          .catch(e => console.warn('[State] getStalls:', e.message)),
        api.getNotifications()
          .then(n => {
            if (Array.isArray(n)) {
              this.notifications = n;
              this.unreadCount = n.filter(x => !x.is_read).length;
              window.updateHeaderNotificationBadge?.();
            }
          })
          .catch(e => console.warn('[State] getNotifications:', e.message))
      ];

      if (this.currentUser && this.currentUser.stall_id) {
        promises.push(
          api.getStallDetails(this.currentUser.stall_id)
            .then(d => { if (d) this.activeStall = d; })
            .catch(e => console.warn('[State] getStallDetails:', e.message))
        );
      } else {
        this.activeStall = null;
      }

      if (this.currentUser) {
        promises.push(
          api.getAuditLogs(100)
            .then(l => { if (Array.isArray(l)) this.auditLogs = l; })
            .catch(e => console.warn('[State] getAuditLogs:', e.message))
        );

        if (this.currentUser.role === 'admin') {
          promises.push(
            api.getPendingSales()
              .then(p => { if (Array.isArray(p)) this.pendingSales = p; })
              .catch(e => console.warn('[State] getPendingSales:', e.message))
          );
          promises.push(
            api.getAllUsers()
              .then(u => { if (Array.isArray(u)) this.allUsers = u; })
              .catch(e => console.warn('[State] getAllUsers:', e.message))
          );
        }
      }

      await Promise.allSettled(promises);
      this.emitChange();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      this._isRefreshing = false;
      if (this._hasQueuedRefresh) {
        this._hasQueuedRefresh = false;
        this.scheduleRefresh(200);
      }
    }
  }
}

export const state = new AppState();
export default state;
