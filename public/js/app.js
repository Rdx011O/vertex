/**
 * Vertex Main Application Orchestrator
 * Handles Firebase Auth flow → routes to correct view per role/state.
 */

import api from './api.js';
import state from './state.js';
import { initFirebase, onAuthStateChanged, signOut } from './firebase.js';
import { renderLoginView, renderPendingApprovalView } from './components/login-view.js';
import { renderAdminView } from './components/admin-view.js';
import { renderCoordinatorView } from './components/coordinator-view.js';
import { renderMemberView } from './components/member-view.js';
import { showQRModal } from './components/qr-modal.js';
import { showNotificationsDrawer } from './components/notifications-drawer.js';

// Global Toast Notification Helper
window.showToast = function (message, type = 'info') {
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
    this.headerUserContainer = document.getElementById('header-user-info');
    this.firebaseAuth = null;

    this.init();
  }

  async init() {
    state.initTheme();

    // Subscribe to state changes → re-render
    state.subscribe(() => this.render());

    // WebSocket real-time updates
    api.subscribe((event) => this.handleRealtimeEvent(event));

    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => state.toggleTheme());

    // Offline simulator
    const simOfflineCheckbox = document.getElementById('sim-offline-toggle');
    if (simOfflineCheckbox) {
      simOfflineCheckbox.addEventListener('change', (e) => {
        const isOffline = e.target.checked;
        api.setSimulatedOffline(isOffline);
        this.updateNetworkUI(isOffline);
      });
    }

    // Show loading while Firebase initializes
    this.showLoader('Connecting to Vertex…');

    try {
      const { auth } = await initFirebase();
      this.firebaseAuth = auth;

      // Listen to Firebase Auth state (also fires when another tab signs in/up on same origin)
      onAuthStateChanged(auth, async (firebaseUser) => {
        // Cross-tab session guard: if a DIFFERENT user's UID shows up (e.g. someone
        // signs up in another browser tab), warn the admin instead of silently failing.
        const prevUid = state.firebaseUser?.uid;
        if (prevUid && firebaseUser && firebaseUser.uid !== prevUid) {
          window.showToast(
            '⚠️ Another account signed in from a different tab. Your admin session was replaced. ' +
            'Please sign in as admin again, or use an Incognito window for student testing.',
            'warning'
          );
        }

        await state.onFirebaseAuth(firebaseUser);
        this.render();
      });
    } catch (err) {
      console.error('Firebase init failed:', err);
      this.showError(err.message);
    }
  }

  async signOut() {
    try {
      await signOut(this.firebaseAuth);
      window.showToast('You have been signed out.', 'info');
    } catch (err) {
      window.showToast('Sign-out failed. Please try again.', 'error');
    }
  }

  handleRealtimeEvent(event) {
    const dot = document.getElementById('ws-status-dot');
    const text = document.getElementById('ws-status-text');

    if (event.type === 'WS_STATUS') {
      if (dot && text) {
        if (event.status === 'connected') {
          dot.className = 'status-dot online'; text.textContent = 'Live Sync';
        } else {
          dot.className = 'status-dot offline'; text.textContent = 'Reconnecting';
        }
      }
    } else if (event.type === 'SALE_VERIFIED') {
      window.showToast(`🎉 ${event.payload?.stall_name} sales verified!`, 'success');
      state.refreshAll();
    } else if (event.type === 'ATTENDANCE_CONFIRMED') {
      window.showToast(`✅ Attendance confirmed for ${event.payload?.member_name}.`, 'success');
      state.refreshAll();
    } else if (event.type === 'ATTENDANCE_REQUESTED') {
      if (state.currentUser?.role === 'coordinator' && state.currentUser?.stall_id === event.payload?.stall_id) {
        window.showToast(`🔔 Arrival: ${event.payload?.member?.name} is at your stall!`, 'warning');
      }
      state.refreshAll();
    } else if (event.type === 'SALE_SUBMITTED') {
      if (state.currentUser?.role === 'admin') {
        window.showToast(`📥 ${event.payload?.stall_name} submitted sales for verification.`, 'info');
      }
      state.refreshAll();
    } else if (event.type === 'MEMBER_JOIN_REQUESTED') {
      if (state.currentUser?.role === 'coordinator' && state.currentUser?.stall_id === event.payload?.stall_id) {
        window.showToast(`🔔 New join request: ${event.payload?.request?.user_name} wants to join your stall!`, 'warning');
      }
      state.refreshAll();
    } else if (event.type === 'MEMBER_JOIN_APPROVED') {
      if (state.currentUser?.id === event.payload?.user_id) {
        window.showToast(`🎉 Your join request for "${event.payload?.stall_name}" was approved!`, 'success');
      }
      state.refreshAll();
    } else if (event.type === 'MEMBER_JOIN_REJECTED') {
      if (state.currentUser?.id === event.payload?.user_id) {
        window.showToast('Your stall join request was declined.', 'error');
      }
      state.refreshAll();
    } else if (['ANNOUNCEMENT_CREATED', 'EXPENSE_ADDED', 'STALL_UPDATED', 'STALL_CREATED', 'DATABASE_RESET'].includes(event.type)) {
      state.refreshAll();
    }
  }

  updateNetworkUI(isOffline) {
    const banner = document.getElementById('offline-notice-banner');
    if (banner) banner.style.display = isOffline ? 'flex' : 'none';
    const dot = document.getElementById('ws-status-dot');
    const text = document.getElementById('ws-status-text');
    if (dot && text) {
      dot.className = isOffline ? 'status-dot offline' : 'status-dot online';
      text.textContent = isOffline ? 'Dead Spot (Simulated)' : 'Live Sync';
    }
  }

  showLoader(msg = 'Loading…') {
    if (this.mainContainer) {
      this.mainContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;">
          <div class="spinner"></div>
          <p style="color:var(--text-secondary);font-size:15px;">${msg}</p>
        </div>
      `;
    }
  }

  showError(msg) {
    if (this.mainContainer) {
      this.mainContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
          <h2 style="color:var(--status-danger);margin-bottom:8px;">Configuration Error</h2>
          <p style="color:var(--text-secondary);max-width:480px;margin:0 auto 20px;">${msg}</p>
          <p style="color:var(--text-secondary);font-size:13px;">
            Please copy <code>.env.example</code> to <code>.env</code>, fill in your Firebase credentials, and restart the server.
          </p>
        </div>
      `;
    }
  }

  render() {
    this.renderHeader();
    this.renderMainContent();
  }

  renderHeader() {
    if (!this.headerUserContainer) return;
    const user = state.currentUser;

    if (!state.isAuthenticated || !user) {
      this.headerUserContainer.innerHTML = '';
      return;
    }

    const notifCount = state.unreadCount || 0;
    const roleLabel = user.role === 'admin' ? '👑 Admin'
      : user.role === 'coordinator' ? '👔 Coordinator'
      : '👤 Member';

    this.headerUserContainer.innerHTML = `
      <span class="role-badge-header ${user.role}">${roleLabel}</span>
      <span style="font-size:13px;color:var(--text-secondary);font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.name}</span>
      <button class="header-btn" id="btn-show-my-qr">🪪 My Badge</button>
      <button class="header-btn" id="notif-btn-header">
        🔔 Alerts ${notifCount > 0 ? `<span class="badge-count">${notifCount}</span>` : ''}
      </button>
      <button class="header-btn" id="signout-header-btn" title="Sign Out" style="color:var(--status-danger);">⏏ Sign Out</button>
    `;

    document.getElementById('btn-show-my-qr')?.addEventListener('click', () => showQRModal(user));
    document.getElementById('notif-btn-header')?.addEventListener('click', () => showNotificationsDrawer(state));
    document.getElementById('signout-header-btn')?.addEventListener('click', () => this.signOut());
  }

  renderMainContent() {
    if (!this.mainContainer) return;

    // Not yet initialized
    if (!this.firebaseAuth) {
      this.showLoader('Connecting to Vertex…');
      return;
    }

    // Not logged in → Login page (hides header chrome too)
    if (!state.isAuthenticated) {
      // Hide top bar decorations during login
      document.querySelector('.role-switcher-bar')?.style.setProperty('display', 'none', 'important');
      document.querySelector('.app-header')?.style.setProperty('display', 'none', 'important');
      renderLoginView(this.mainContainer, this.firebaseAuth, () => {});
      return;
    }

    // Logged in — show app chrome
    document.querySelector('.role-switcher-bar')?.style.removeProperty('display');
    document.querySelector('.app-header')?.style.removeProperty('display');
    // Hide the old role-switcher content (no longer needed)
    const roleBar = document.getElementById('role-switcher-container');
    if (roleBar) roleBar.innerHTML = '';

    // Logged in but no DB profile yet → needs to register profile
    if (state.isAuthenticated && !state.currentUser) {
      renderPendingApprovalView(this.mainContainer, state.firebaseUser, () => this.signOut());
      return;
    }

    const user = state.currentUser;
    const role = user.role;

    // 1. Admin: Instant Direct Access to Command Center
    if (role === 'admin') {
      renderAdminView(this.mainContainer, state);
      return;
    }

    // 2. Stall Coordinator: Instant Direct Access to Coordinator Panel
    if (role === 'coordinator') {
      renderCoordinatorView(this.mainContainer, state);
      return;
    }

    // 3. Active Stall Member: Instant Direct Access to Member Dashboard
    if (role === 'member' && user.stall_id) {
      renderMemberView(this.mainContainer, state);
      return;
    }

    // 4. Code Mode: EXCLUSIVELY for Stall Members who need to join their stall
    renderPendingApprovalView(this.mainContainer, state.currentUser || state.firebaseUser, () => this.signOut());
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.vertexApp = new VertexApp();
});
