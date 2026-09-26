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

    if (this.currentUser) {
      await this.refreshAll();
    }

    this.emitChange();
  }

  setTab(tabId) {
    this.activeTab = tabId;
    this.emitChange();
  }

  async refreshAll() {
    try {
      if (this.isAuthenticated) {
        try {
          this.currentUser = await api.getMe();
        } catch (_) { /* profile not yet ready */ }
      }

      this.eventSummary = await api.getEventSummary();
      this.stalls = await api.getStalls();

      try {
        this.notifications = await api.getNotifications();
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
      } catch (_) { /* non-critical */ }

      if (this.currentUser && this.currentUser.stall_id) {
        this.activeStall = await api.getStallDetails(this.currentUser.stall_id);
      } else {
        this.activeStall = null;
      }

      if (this.currentUser) {
        try {
          this.auditLogs = await api.getAuditLogs(100);
        } catch (_) { /* non-critical */ }

        if (this.currentUser.role === 'admin') {
          this.pendingSales = await api.getPendingSales();
          try { this.allUsers = await api.getAllUsers(); } catch (_) { /* non-critical */ }
        }
      }

      this.emitChange();
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }
}

export const state = new AppState();
export default state;
