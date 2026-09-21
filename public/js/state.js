/**
 * Vertex Application Reactive State Store
 */

import api from './api.js';

class AppState {
  constructor() {
    this.currentUser = null;
    this.users = [];
    this.stalls = [];
    this.eventSummary = null;
    this.activeStall = null;
    this.activeTab = 'dashboard';
    this.notifications = [];
    this.unreadCount = 0;
    this.auditLogs = [];
    this.pendingSales = [];
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
      try {
        listener(this);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  async loadInitialData() {
    try {
      this.users = await api.getUsers();
      
      // Default to Admin or saved user
      const savedUserId = localStorage.getItem('vertex_active_user_id');
      const matchedUser = this.users.find(u => u.id === savedUserId);
      this.currentUser = matchedUser || this.users.find(u => u.role === 'admin') || this.users[0];
      
      if (this.currentUser) {
        api.setUserId(this.currentUser.id);
        localStorage.setItem('vertex_active_user_id', this.currentUser.id);
      }

      await this.refreshAll();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  async switchUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    this.currentUser = user;
    api.setUserId(user.id);
    localStorage.setItem('vertex_active_user_id', user.id);
    
    // Set default tab for role
    if (user.role === 'admin') {
      this.activeTab = 'command-center';
    } else if (user.role === 'coordinator') {
      this.activeTab = 'analytics';
    } else {
      this.activeTab = 'member-dashboard';
    }

    await this.refreshAll();
    this.emitChange();
  }

  setTab(tabId) {
    this.activeTab = tabId;
    this.emitChange();
  }

  async refreshAll() {
    try {
      this.eventSummary = await api.getEventSummary();
      this.stalls = await api.getStalls();
      this.notifications = await api.getNotifications();
      this.unreadCount = this.notifications.length;

      if (this.currentUser && this.currentUser.stall_id) {
        this.activeStall = await api.getStallDetails(this.currentUser.stall_id);
      }

      if (this.currentUser && this.currentUser.role === 'admin') {
        this.pendingSales = await api.getPendingSales();
        this.auditLogs = await api.getAuditLogs(50);
      }

      this.emitChange();
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }
}

export const state = new AppState();
export default state;
