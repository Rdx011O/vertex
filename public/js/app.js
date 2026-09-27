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

// Global Icon Rendering Helper (Lucide Engine)
window.renderIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

// Global Notifications & Audit Log Drawer Helper
window.showNotificationsDrawer = showNotificationsDrawer;

// Global Toast Notification Helper
window.showToast = function (message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconName = type === 'success' ? 'check-circle-2' : type === 'warning' ? 'alert-triangle' : type === 'error' ? 'alert-circle' : 'info';
  toast.innerHTML = `
    <span style="font-size:16px; display:inline-flex; align-items:center;"><i data-lucide="${iconName}"></i></span>
    <div style="flex:1;">${message}</div>
  `;
  container.appendChild(toast);
  window.renderIcons();

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
    this.headerCenterContainer = document.getElementById('header-center-info');
    this.headerRightContainer = document.getElementById('header-right-actions');
    this.firebaseAuth = null;

    this.init();
  }

  async init() {
    state.initTheme();

    // Subscribe to state changes → re-render
    state.subscribe(() => this.render());

    // WebSocket real-time updates
    api.subscribe((event) => this.handleRealtimeEvent(event));

    // Brand logo home shortcut
    document.getElementById('brand-logo-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!state.currentUser) return;
      const defaultTab = state.currentUser.role === 'admin' ? 'command-center'
        : state.currentUser.role === 'coordinator' ? 'analytics'
        : 'member-dashboard';
      state.setTab(defaultTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

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
        if (state.isRegistering) {
          return; // Allow signup form to complete registration and set state directly
        }

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
      const isTargetStall = state.currentUser?.stall_id === event.payload?.stall_id;
      const isAdmin = state.currentUser?.role === 'admin';
      if (isTargetStall || isAdmin) {
        window.showToast(`🎉 ${event.payload?.stall_name || 'Stall'} sales verified!`, 'success');
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'ATTENDANCE_CONFIRMED') {
      const isTargetStall = state.currentUser?.stall_id === event.payload?.stall_id;
      const isTargetUser = state.currentUser?.id === event.payload?.member_id;
      const isAdmin = state.currentUser?.role === 'admin';
      if (isTargetStall || isTargetUser || isAdmin) {
        window.showToast(`✅ Attendance confirmed for ${event.payload?.member_name}.`, 'success');
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'ATTENDANCE_REQUESTED') {
      if (state.currentUser?.role === 'coordinator' && state.currentUser?.stall_id === event.payload?.stall_id) {
        window.showToast(`🔔 Arrival: ${event.payload?.member?.name} is at your stall!`, 'warning');
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'SALE_SUBMITTED') {
      if (state.currentUser?.role === 'admin') {
        window.showToast(`📥 ${event.payload?.stall_name} submitted sales for verification.`, 'info');
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'MEMBER_JOIN_REQUESTED') {
      if (state.currentUser?.role === 'coordinator' && state.currentUser?.stall_id === event.payload?.stall_id) {
        window.showToast(`🔔 New join request: ${event.payload?.request?.user_name} wants to join your stall!`, 'warning');
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'MEMBER_JOIN_APPROVED') {
      if (state.currentUser?.id === event.payload?.user_id) {
        window.showToast(`🎉 Your join request for "${event.payload?.stall_name}" was approved!`, 'success');
        state.scheduleRefresh(100);
      } else if (state.currentUser?.role === 'coordinator' && state.currentUser?.stall_id === event.payload?.stall_id) {
        state.scheduleRefresh(300);
      }
    } else if (event.type === 'MEMBER_JOIN_REJECTED') {
      if (state.currentUser?.id === event.payload?.user_id) {
        window.showToast('Your stall join request was declined.', 'error');
        state.scheduleRefresh(100);
      }
    } else if (['ANNOUNCEMENT_CREATED', 'EXPENSE_ADDED', 'STALL_UPDATED', 'STALL_CREATED', 'DATABASE_RESET'].includes(event.type)) {
      state.scheduleRefresh(400);
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

  updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.setAttribute('data-lucide', state.theme === 'dark' ? 'sun' : 'moon');
      window.renderIcons?.();
    }
  }

  render() {
    this.renderHeader();
    this.renderMainContent();
    this.renderAppNavigation();
    this.updateThemeIcon();
    window.renderIcons?.();
  }

  renderAppNavigation() {
    const sidebar = document.getElementById('app-nav-sidebar');
    const menuContainer = document.getElementById('sidebar-nav-menu');
    if (!sidebar || !menuContainer) return;

    const user = state.currentUser;
    if (!state.isAuthenticated || !user || !user.role) {
      sidebar.style.display = 'none';
      menuContainer.innerHTML = '';
      return;
    }

    sidebar.style.display = '';
    const role = user.role;
    const activeTab = state.activeTab;
    let buttonsHTML = '';

    if (role === 'coordinator') {
      const stall = state.activeStall || {};
      const pendingAttCount = stall.attendance ? stall.attendance.filter(a => a.status === 'pending_coordinator').length : 0;
      const offlineCount = api.offlineQueue.length;

      buttonsHTML = `
        <button class="sidebar-nav-btn ${activeTab === 'analytics' || !activeTab ? 'active' : ''}" data-nav-tab="analytics" title="Dashboard">
          <span class="nav-icon-wrap"><i data-lucide="bar-chart-3"></i></span>
          <span class="nav-text">Dashboard</span>
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'pos' ? 'active' : ''}" data-nav-tab="pos" title="POS Fast Counter">
          <span class="nav-icon-wrap"><i data-lucide="shopping-cart"></i></span>
          <span class="nav-text">POS Fast</span>
          ${offlineCount > 0 ? `<span class="sidebar-nav-badge">${offlineCount}</span>` : ''}
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'attendance' ? 'active' : ''}" data-nav-tab="attendance" title="Team Desk & Check-ins">
          <span class="nav-icon-wrap"><i data-lucide="users"></i></span>
          <span class="nav-text">Team Desk</span>
          ${pendingAttCount > 0 ? `<span class="sidebar-nav-badge">${pendingAttCount}</span>` : ''}
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'expenses' ? 'active' : ''}" data-nav-tab="expenses" title="Stall Expenses">
          <span class="nav-icon-wrap"><i data-lucide="receipt"></i></span>
          <span class="nav-text">Expenses</span>
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}" data-nav-tab="leaderboard" title="Event Rankings">
          <span class="nav-icon-wrap"><i data-lucide="trophy"></i></span>
          <span class="nav-text">Rankings</span>
        </button>
      `;
    } else if (role === 'member') {
      const stall = state.activeStall || {};
      const myAtt = stall.attendance ? stall.attendance.find(a => a.member_user_id === user.id) : null;
      const isCheckedIn = myAtt && myAtt.status === 'confirmed';

      buttonsHTML = `
        <button class="sidebar-nav-btn ${activeTab === 'member-dashboard' || !activeTab ? 'active' : ''}" data-nav-tab="member-dashboard" title="Stall Overview">
          <span class="nav-icon-wrap"><i data-lucide="store"></i></span>
          <span class="nav-text">Overview</span>
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'member-badge' ? 'active' : ''}" data-nav-tab="member-badge" title="My Event Pass QR">
          <span class="nav-icon-wrap"><i data-lucide="qr-code"></i></span>
          <span class="nav-text">My Pass</span>
          ${isCheckedIn ? '<span class="sidebar-nav-badge" style="background:var(--status-success);">✓</span>' : ''}
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'member-leaderboard' ? 'active' : ''}" data-nav-tab="member-leaderboard" title="Event Standings">
          <span class="nav-icon-wrap"><i data-lucide="trophy"></i></span>
          <span class="nav-text">Standings</span>
        </button>
        <button class="sidebar-nav-btn notif-drawer-trigger" data-open-hub="audit" title="Audit Log & Alerts">
          <span class="nav-icon-wrap"><i data-lucide="history"></i></span>
          <span class="nav-text">My Log</span>
        </button>
      `;
    } else if (role === 'admin') {
      const pendingSalesCount = (state.pendingSales || []).length;
      const pendingUsersCount = (state.allUsers || []).filter(u => u.role && u.role.startsWith('pending')).length;

      buttonsHTML = `
        <button class="sidebar-nav-btn ${activeTab === 'command-center' || !activeTab ? 'active' : ''}" data-nav-tab="command-center" title="Operations Command Center">
          <span class="nav-icon-wrap"><i data-lucide="layout-dashboard"></i></span>
          <span class="nav-text">Command</span>
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'verification-queue' ? 'active' : ''}" data-nav-tab="verification-queue" title="Sales Verification">
          <span class="nav-icon-wrap"><i data-lucide="check-check"></i></span>
          <span class="nav-text">Verify</span>
          ${pendingSalesCount > 0 ? `<span class="sidebar-nav-badge">${pendingSalesCount}</span>` : ''}
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'user-management' ? 'active' : ''}" data-nav-tab="user-management" title="User Management">
          <span class="nav-icon-wrap"><i data-lucide="users"></i></span>
          <span class="nav-text">Users</span>
          ${pendingUsersCount > 0 ? `<span class="sidebar-nav-badge">${pendingUsersCount}</span>` : ''}
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'stall-operations' ? 'active' : ''}" data-nav-tab="stall-operations" title="Stall Directory">
          <span class="nav-icon-wrap"><i data-lucide="store"></i></span>
          <span class="nav-text">Stalls</span>
        </button>
        <button class="sidebar-nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}" data-nav-tab="leaderboard" title="Live Rankings">
          <span class="nav-icon-wrap"><i data-lucide="trophy"></i></span>
          <span class="nav-text">Rankings</span>
        </button>
      `;
    } else {
      sidebar.style.display = 'none';
      return;
    }

    menuContainer.innerHTML = buttonsHTML;

    // Attach navigation clicks
    menuContainer.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-nav-tab');
        state.setTab(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Attach Activity / Audit drawer clicks
    menuContainer.querySelectorAll('[data-open-hub]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-open-hub') || 'audit';
        showNotificationsDrawer(state, tab);
      });
    });

    // Bottom footer drawer shortcut button
    const footerNotifBtn = document.getElementById('sidebar-notif-btn');
    if (footerNotifBtn && !footerNotifBtn._bound) {
      footerNotifBtn._bound = true;
      footerNotifBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNotificationsDrawer(state, 'audit');
      });
    }

    // Expand & Collapse Toggle Setup (with localStorage persistence)
    const isCollapsed = localStorage.getItem('vertex_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) icon.setAttribute('data-lucide', 'panel-left-open');
      const text = sidebar.querySelector('.sidebar-toggle-text');
      if (text) text.textContent = 'Expand';
    } else {
      sidebar.classList.remove('collapsed');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) icon.setAttribute('data-lucide', 'panel-left-close');
      const text = sidebar.querySelector('.sidebar-toggle-text');
      if (text) text.textContent = 'Collapse';
    }

    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn && !toggleBtn._bound) {
      toggleBtn._bound = true;
      toggleBtn.addEventListener('click', () => {
        const nowCollapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('vertex_sidebar_collapsed', nowCollapsed ? 'true' : 'false');
        const icon = document.getElementById('sidebar-toggle-icon');
        const text = sidebar.querySelector('.sidebar-toggle-text');
        if (nowCollapsed) {
          if (icon) icon.setAttribute('data-lucide', 'panel-left-open');
          if (text) text.textContent = 'Expand';
        } else {
          if (icon) icon.setAttribute('data-lucide', 'panel-left-close');
          if (text) text.textContent = 'Collapse';
        }
        window.renderIcons?.();
      });
    }
  }

  renderHeader() {
    const centerEl = this.headerCenterContainer || document.getElementById('header-center-info');
    const rightEl = this.headerRightContainer || document.getElementById('header-right-actions');

    if (!centerEl || !rightEl) return;
    const user = state.currentUser;

    if (!state.isAuthenticated || !user) {
      centerEl.innerHTML = '';
      rightEl.innerHTML = `
        <button class="header-btn header-btn-theme" id="theme-toggle-btn" title="Toggle Dark / Light Theme">
          <i data-lucide="${state.theme === 'dark' ? 'sun' : 'moon'}" id="theme-icon"></i>
        </button>
      `;
      document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
        state.toggleTheme();
        this.updateThemeIcon();
      });
      return;
    }

    const notifCount = state.unreadCount || 0;
    const roleIconTag = user.role === 'admin' ? '<i data-lucide="shield-check"></i>'
      : user.role === 'coordinator' ? '<i data-lucide="briefcase"></i>'
      : '<i data-lucide="user"></i>';
    const roleTitle = user.role === 'admin' ? 'Admin'
      : user.role === 'coordinator' ? 'Coordinator'
      : 'Member';
    const usernameDisplay = user.username ? `@${user.username}` : (user.name ? `@${user.name.split(' ')[0].toLowerCase()}` : '@user');

    // 2. Center of navigation: Role and Username
    centerEl.innerHTML = `
      <div class="header-user-pill" title="${user.name || ''} (${roleTitle})">
        <span class="role-badge-header ${user.role}">
          <span class="role-icon">${roleIconTag}</span>
          <span class="role-name">${roleTitle}</span>
        </span>
        <span class="header-username">${usernameDisplay}</span>
      </div>
    `;

    // 3 & 4. Right: Notification button beside Theme toggle button (plus Exit)
    rightEl.innerHTML = `
      <button class="header-btn header-btn-notif" id="notif-btn-header" title="Activity & Notifications (Alerts & Audit Log)">
        <span class="btn-icon"><i data-lucide="bell"></i></span>
        ${notifCount > 0 ? `<span class="badge-count">${notifCount}</span>` : ''}
      </button>
      <button class="header-btn header-btn-theme" id="theme-toggle-btn" title="Toggle Dark / Light Theme">
        <i data-lucide="${state.theme === 'dark' ? 'sun' : 'moon'}" id="theme-icon"></i>
      </button>
      <button class="header-btn header-btn-exit" id="signout-header-btn" title="Sign Out">
        <span class="btn-icon"><i data-lucide="log-out"></i></span>
      </button>
    `;

    document.getElementById('notif-btn-header')?.addEventListener('click', () => showNotificationsDrawer(state));
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      state.toggleTheme();
      this.updateThemeIcon();
    });
    document.getElementById('signout-header-btn')?.addEventListener('click', () => this.signOut());
  }

  renderMainContent() {
    if (!this.mainContainer) return;

    // Not yet initialized
    if (!this.firebaseAuth) {
      this.showLoader('Connecting to Vertex…');
      return;
    }

    // Not logged in → Login page (hides header & sidebar chrome too)
    if (!state.isAuthenticated) {
      // Hide top bar & sidebar during login
      document.querySelector('.role-switcher-bar')?.style.setProperty('display', 'none', 'important');
      document.querySelector('.app-header')?.style.setProperty('display', 'none', 'important');
      document.getElementById('app-nav-sidebar')?.style.setProperty('display', 'none', 'important');
      renderLoginView(this.mainContainer, this.firebaseAuth, () => {});
      return;
    }

    // Logged in — show app chrome
    document.querySelector('.role-switcher-bar')?.style.removeProperty('display');
    document.querySelector('.app-header')?.style.removeProperty('display');
    document.getElementById('app-nav-sidebar')?.style.removeProperty('display');
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
