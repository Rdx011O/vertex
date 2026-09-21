/**
 * Vertex Main Application Orchestrator
 */

import api from './api.js';
import state from './state.js';
import { renderAdminView } from './components/admin-view.js';
import { renderCoordinatorView } from './components/coordinator-view.js';
import { renderMemberView } from './components/member-view.js';
import { showQRModal } from './components/qr-modal.js';
import { showNotificationsDrawer } from './components/notifications-drawer.js';

// Global Toast Notification Helper
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `
    <span style="font-size:16px;">${icon}</span>
    <div style="flex:1;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

class VertexApp {
  constructor() {
    this.mainContainer = document.getElementById('app-main');
    this.roleBarContainer = document.getElementById('role-switcher-container');
    this.headerUserContainer = document.getElementById('header-user-info');
    
    this.init();
  }

  async init() {
    state.initTheme();

    // Setup global state listener
    state.subscribe(() => {
      this.render();
    });

    // Setup WebSocket real-time updates
    api.subscribe((event) => {
      this.handleRealtimeEvent(event);
    });

    // Theme toggle button
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      state.toggleTheme();
    });

    // Notifications button
    document.getElementById('notif-btn')?.addEventListener('click', () => {
      showNotificationsDrawer(state);
    });

    // Simulated Offline Mode switch
    const simOfflineCheckbox = document.getElementById('sim-offline-toggle');
    if (simOfflineCheckbox) {
      simOfflineCheckbox.addEventListener('change', (e) => {
        const isOffline = e.target.checked;
        api.setSimulatedOffline(isOffline);
        this.updateNetworkUI(isOffline);
      });
    }

    // Load initial data
    await state.loadInitialData();
    this.render();
  }

  handleRealtimeEvent(event) {
    if (event.type === 'WS_STATUS') {
      const dot = document.getElementById('ws-status-dot');
      const text = document.getElementById('ws-status-text');
      if (dot && text) {
        if (event.status === 'connected') {
          dot.className = 'status-dot online';
          text.textContent = 'Live Sync';
        } else {
          dot.className = 'status-dot offline';
          text.textContent = 'Reconnecting';
        }
      }
    } else if (event.type === 'SALE_VERIFIED') {
      window.showToast(`🎉 ${event.payload.stall_name} sales verified by Admin! Official totals updated.`, 'success');
      state.refreshAll();
    } else if (event.type === 'ATTENDANCE_CONFIRMED') {
      window.showToast(`✅ Attendance confirmed for ${event.payload.member_name} at ${event.payload.stall_name}.`, 'success');
      state.refreshAll();
    } else if (event.type === 'ATTENDANCE_REQUESTED') {
      if (state.currentUser && state.currentUser.role === 'coordinator' && state.currentUser.stall_id === event.payload.stall_id) {
        window.showToast(`🔔 Arrival Alert: ${event.payload.member.name} requested check-in confirmation!`, 'warning');
      }
      state.refreshAll();
    } else if (event.type === 'SALE_SUBMITTED') {
      if (state.currentUser && state.currentUser.role === 'admin') {
        window.showToast(`📥 New Sales Batch: ${event.payload.stall_name} submitted ₹${event.payload.submission.total_amount} for verification!`, 'info');
      }
      state.refreshAll();
    } else if (event.type === 'ANNOUNCEMENT_CREATED') {
      window.showToast(`📢 Event Notice: ${event.payload.notification.title}`, 'info');
      state.refreshAll();
    } else if (event.type === 'EXPENSE_ADDED' || event.type === 'STALL_UPDATED' || event.type === 'DATABASE_RESET') {
      state.refreshAll();
    }
  }

  updateNetworkUI(isOffline) {
    const banner = document.getElementById('offline-notice-banner');
    if (banner) {
      banner.style.display = isOffline ? 'flex' : 'none';
    }
    const dot = document.getElementById('ws-status-dot');
    const text = document.getElementById('ws-status-text');
    if (dot && text) {
      if (isOffline) {
        dot.className = 'status-dot offline';
        text.textContent = 'Dead Spot (Simulated)';
      } else {
        dot.className = 'status-dot online';
        text.textContent = 'Live Sync';
      }
    }
  }

  render() {
    this.renderRoleBar();
    this.renderHeaderUserInfo();
    this.renderMainContent();
  }

  renderRoleBar() {
    if (!this.roleBarContainer) return;
    const users = state.users || [];
    const currentUser = state.currentUser;

    // Group users by role
    const admins = users.filter(u => u.role === 'admin');
    const coords = users.filter(u => u.role === 'coordinator');
    const members = users.filter(u => u.role === 'member');

    this.roleBarContainer.innerHTML = `
      <div class="role-switcher-group">
        <span class="role-label">Switch View:</span>
        
        <!-- Admin -->
        ${admins.map(u => `
          <button class="role-pill-btn role-admin ${currentUser && currentUser.id === u.id ? 'active' : ''}" data-uid="${u.id}">
            👑 Admin (${u.name.split(' ')[0]})
          </button>
        `).join('')}

        <span style="color:var(--border-strong);">|</span>

        <!-- Coordinators -->
        ${coords.map(u => `
          <button class="role-pill-btn role-coordinator ${currentUser && currentUser.id === u.id ? 'active' : ''}" data-uid="${u.id}">
            👔 Coord: ${u.stall_name || u.name.split(' ')[0]}
          </button>
        `).join('')}

        <span style="color:var(--border-strong);">|</span>

        <!-- Members -->
        ${members.slice(0, 3).map(u => `
          <button class="role-pill-btn role-member ${currentUser && currentUser.id === u.id ? 'active' : ''}" data-uid="${u.id}">
            👤 Member (${u.name.split(' ')[0]})
          </button>
        `).join('')}
      </div>
    `;

    // Attach click listeners to role buttons
    this.roleBarContainer.querySelectorAll('.role-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-uid');
        state.switchUser(uid);
      });
    });
  }

  renderHeaderUserInfo() {
    if (!this.headerUserContainer) return;
    const user = state.currentUser;
    if (!user) return;

    const notifCount = state.unreadCount || 0;
    const roleClass = user.role;

    this.headerUserContainer.innerHTML = `
      <span class="role-badge-header ${roleClass}">
        ${user.role === 'admin' ? '👑 Admin' : user.role === 'coordinator' ? '👔 Stall Coordinator' : '👤 Stall Member'}
      </span>
      <button class="header-btn" id="btn-show-my-qr">
        🪪 My Badge
      </button>
      <button class="header-btn" id="notif-btn-header">
        🔔 Alerts ${notifCount > 0 ? `<span class="badge-count">${notifCount}</span>` : ''}
      </button>
    `;

    document.getElementById('btn-show-my-qr')?.addEventListener('click', () => {
      showQRModal(user);
    });

    document.getElementById('notif-btn-header')?.addEventListener('click', () => {
      showNotificationsDrawer(state);
    });
  }

  renderMainContent() {
    if (!this.mainContainer) return;
    const user = state.currentUser;
    if (!user) {
      this.mainContainer.innerHTML = `
        <div style="text-align:center; padding:64px 20px;">
          <h2>Loading Vertex Event Operations System...</h2>
        </div>
      `;
      return;
    }

    // Role-specific main content render
    if (user.role === 'admin') {
      renderAdminView(this.mainContainer, state);
    } else if (user.role === 'coordinator') {
      renderCoordinatorView(this.mainContainer, state);
    } else if (user.role === 'member') {
      renderMemberView(this.mainContainer, state);
    }
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.vertexApp = new VertexApp();
});
