/**
 * Vertex Admin Portal — Standalone App
 * Handles Firebase auth, user management, stall management, sales verification.
 */

import {
  initFirebase,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from './firebase.js';
import api from './api.js';

// ── Toast ────────────────────────────────────────────────────────────────────
window.showToast = function (message, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span style="font-size:16px;">${icon}</span><div style="flex:1;">${message}</div>`;
  c.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateY(10px)'; toast.style.transition='all 0.3s'; setTimeout(()=>toast.remove(),300); }, 4000);
};

// ── State ────────────────────────────────────────────────────────────────────
let firebaseAuth = null;
let currentAdminUser = null;
let activeTab = 'users';
let allUsers = [], allStalls = [], pendingSales = [], auditLogs = [];

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const { auth } = await initFirebase();
    firebaseAuth = auth;

    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        renderLoginPage();
        return;
      }

      // Set token provider
      api.setTokenProvider(() => fbUser.getIdToken(false));

      try {
        let res = await api.getMe();
        let profile = res.user;

        if (profile && profile.role === 'admin') {
          currentAdminUser = profile;
          renderHeader(profile);
          await loadAllData();
          renderApp();
          return;
        }

        // If user profile role is pending or not admin, try bootstrapping as admin
        try {
          const regRes = await api.registerProfile(fbUser.displayName || fbUser.email.split('@')[0], null, 'admin');
          if (regRes.user && regRes.user.role === 'admin') {
            currentAdminUser = regRes.user;
            renderHeader(regRes.user);
            await loadAllData();
            renderApp();
            return;
          }
        } catch (e) {
          console.warn('[Admin] Bootstrap register failed:', e);
        }

        renderAccessDenied(fbUser);
      } catch (err) {
        if (err.message?.includes('Profile not found') || err.message?.includes('403') || err.message?.includes('401')) {
          // Admin signed in but no profile in DB — create profile as admin
          try {
            const res = await api.registerProfile(fbUser.displayName || fbUser.email.split('@')[0], null, 'admin');
            if (res.user && res.user.role === 'admin') {
              currentAdminUser = res.user;
              renderHeader(res.user);
              await loadAllData();
              renderApp();
              return;
            }
          } catch (e) {
            console.warn('[Admin] Auto-profile creation error:', e);
          }
        }
        renderAccessDenied(fbUser);
      }
    });
  } catch (err) {
    document.getElementById('admin-main').innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <h2 style="color:var(--status-danger);">Firebase Configuration Error</h2>
        <p style="color:var(--text-secondary);">${err.message}</p>
        <p style="color:var(--text-secondary);font-size:13px;">Fill in .env and restart the server.</p>
      </div>
    `;
  }
}

async function loadAllData() {
  [allUsers, allStalls, pendingSales, auditLogs] = await Promise.all([
    api.request('/api/auth/users').then(r => r.users).catch(() => []),
    api.getStalls().catch(() => []),
    api.getPendingSales().catch(() => []),
    api.getAuditLogs(100).catch(() => [])
  ]);
}

async function doSignOut() {
  await signOut(firebaseAuth);
  currentAdminUser = null;
  document.getElementById('admin-header-right').innerHTML = '';
}

// ── Header ────────────────────────────────────────────────────────────────────
function renderHeader(user) {
  document.getElementById('admin-header-right').innerHTML = `
    <span style="color:var(--text-secondary);font-size:13px;font-weight:500;">${user.name}</span>
    <span class="role-badge-header admin">👑 Admin</span>
    <button class="btn btn-outline" id="admin-signout-btn" style="padding:4px 12px;font-size:13px;">⏏ Sign Out</button>
  `;
  document.getElementById('admin-signout-btn')?.addEventListener('click', doSignOut);
}

// ── Login Page ────────────────────────────────────────────────────────────────
function renderLoginPage() {
  document.getElementById('admin-header-right').innerHTML = '';
  document.getElementById('admin-main').innerHTML = `
    <div class="login-page" style="background:var(--bg-primary);min-height:80vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div class="login-card" style="max-width:440px;width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:32px;box-shadow:var(--shadow-lg);">
        <div class="login-brand" style="text-align:center;margin-bottom:20px;">
          <div class="login-logo" style="width:48px;height:48px;margin:0 auto 12px;font-size:24px;font-weight:800;background:linear-gradient(135deg,var(--role-admin),var(--primary-light));color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;">V</div>
          <div class="login-brand-text">
            <div class="login-title" style="font-size:20px;font-weight:800;letter-spacing:-0.5px;">VERTEX ADMIN</div>
            <div class="login-subtitle" style="font-size:13px;color:var(--text-secondary);margin-top:4px;">Building Pravara 2026 · Operations Control</div>
          </div>
        </div>

        <!-- Tab Switcher -->
        <div class="login-tabs" style="display:flex;background:var(--bg-surface-inset);border-radius:var(--radius-md);padding:4px;gap:4px;margin-bottom:20px;">
          <button class="login-tab active" id="tab-admin-signin" style="flex:1;padding:8px;border:none;border-radius:var(--radius-sm);background:var(--bg-surface);color:var(--text-primary);font-weight:600;font-size:13px;cursor:pointer;">Sign In</button>
          <button class="login-tab" id="tab-admin-signup" style="flex:1;padding:8px;border:none;border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);font-weight:600;font-size:13px;cursor:pointer;">Create Admin Account</button>
        </div>

        <!-- Sign In Form -->
        <form id="admin-signin-form" class="auth-form" style="display:block;">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Admin Email</label>
            <input type="email" id="admin-signin-email" class="form-input" placeholder="admin@pravaraengg.org.in" required style="width:100%;" />
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Password</label>
            <input type="password" id="admin-signin-password" class="form-input" placeholder="••••••••" required style="width:100%;" />
          </div>
          <div id="admin-signin-error" class="auth-error" style="display:none;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:16px;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="admin-signin-btn" style="width:100%;padding:12px;font-weight:600;">
            Sign In to Admin Portal →
          </button>
        </form>

        <!-- Sign Up Form (First-time Admin Registration) -->
        <form id="admin-signup-form" class="auth-form" style="display:none;">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Admin Full Name</label>
            <input type="text" id="admin-signup-name" class="form-input" placeholder="e.g. Operations Lead" required style="width:100%;" />
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Admin Email</label>
            <input type="email" id="admin-signup-email" class="form-input" placeholder="admin@prec.ac.in" required style="width:100%;" />
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Password (min 6 characters)</label>
            <input type="password" id="admin-signup-password" class="form-input" placeholder="••••••••" minlength="6" required style="width:100%;" />
          </div>
          <div id="admin-signup-error" class="auth-error" style="display:none;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:16px;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="admin-signup-btn" style="width:100%;padding:12px;font-weight:600;background:var(--role-admin);">
            Create Admin Account & Open Portal →
          </button>
          <p style="font-size:11px;color:var(--text-tertiary);margin-top:10px;text-align:center;">
            ⚡ First admin registration automatically acquires system administrator credentials.
          </p>
        </form>

        <p style="text-align:center;font-size:12px;color:var(--text-secondary);margin-top:20px;border-top:1px solid var(--border-subtle);padding-top:16px;">
          🔒 Restricted to event operations admins. Students: visit the <a href="/" style="color:var(--role-coordinator);font-weight:600;">student portal</a>.
        </p>
      </div>
    </div>
  `;

  // Switch tabs
  const signinTab = document.getElementById('tab-admin-signin');
  const signupTab = document.getElementById('tab-admin-signup');
  const signinForm = document.getElementById('admin-signin-form');
  const signupForm = document.getElementById('admin-signup-form');

  signinTab.addEventListener('click', () => {
    signinTab.style.background = 'var(--bg-surface)';
    signinTab.style.color = 'var(--text-primary)';
    signupTab.style.background = 'transparent';
    signupTab.style.color = 'var(--text-secondary)';
    signinForm.style.display = 'block';
    signupForm.style.display = 'none';
  });

  signupTab.addEventListener('click', () => {
    signupTab.style.background = 'var(--bg-surface)';
    signupTab.style.color = 'var(--text-primary)';
    signinTab.style.background = 'transparent';
    signinTab.style.color = 'var(--text-secondary)';
    signupForm.style.display = 'block';
    signinForm.style.display = 'none';
  });

  // Handle Sign In Submit
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-signin-email').value.trim();
    const password = document.getElementById('admin-signin-password').value;
    const errorEl = document.getElementById('admin-signin-error');
    const btn = document.getElementById('admin-signin-btn');
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err) {
      console.error('[Admin Sign-in]', err);
      let msg = 'Sign-in failed. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        msg = `Account not found or password incorrect.<br>If this is your first time, click <a href="#" id="switch-to-signup" style="color:var(--primary);text-decoration:underline;">Create Admin Account</a> above to register first.`;
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a moment and try again.';
      }
      errorEl.innerHTML = msg;
      errorEl.style.display = 'block';
      document.getElementById('switch-to-signup')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        signupTab.click();
      });
      btn.disabled = false;
      btn.textContent = 'Sign In to Admin Portal →';
    }
  });

  // Handle Sign Up Submit
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('admin-signup-name').value.trim();
    const email = document.getElementById('admin-signup-email').value.trim();
    const password = document.getElementById('admin-signup-password').value;
    const errorEl = document.getElementById('admin-signup-error');
    const btn = document.getElementById('admin-signup-btn');
    errorEl.style.display = 'none';

    if (!name) {
      errorEl.textContent = 'Please enter your full name.';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      api.setTokenProvider(() => userCredential.user.getIdToken(false));
      const res = await api.registerProfile(name, null, 'admin');

      window.showToast?.(`Admin account created for ${name}!`, 'success');
      currentAdminUser = res.user;
      renderHeader(res.user);
      await loadAllData();
      renderApp();
    } catch (err) {
      console.error('[Admin Sign-up]', err);
      let msg = err.message || 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please use the Sign In tab.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      errorEl.innerHTML = msg;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create Admin Account & Open Portal →';
    }
  });
}

function renderAccessDenied(fbUser) {
  document.getElementById('admin-main').innerHTML = `
    <div style="text-align:center;padding:60px 20px;max-width:500px;margin:0 auto;">
      <div style="font-size:48px;">🚫</div>
      <h2 style="margin:16px 0 8px;">Access Denied</h2>
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.5;">
        <strong>${fbUser.email}</strong> is registered but does not have admin permissions assigned yet.<br>
        If this is the master admin account, click below to claim admin privileges.
      </p>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
        <button class="btn btn-primary" id="claim-admin-btn">Claim Admin Role</button>
        <button class="btn btn-outline" id="denied-signout-btn">Sign Out</button>
      </div>
      <p style="font-size:12px;color:var(--text-tertiary);margin-top:16px;">
        Students: please access the <a href="/" style="color:var(--role-coordinator);">student portal</a>.
      </p>
    </div>
  `;
  document.getElementById('denied-signout-btn')?.addEventListener('click', () => signOut(firebaseAuth));
  document.getElementById('claim-admin-btn')?.addEventListener('click', async () => {
    try {
      const res = await api.registerProfile(fbUser.displayName || fbUser.email.split('@')[0], null, 'admin');
      if (res.user && res.user.role === 'admin') {
        window.showToast?.('Admin privileges granted!', 'success');
        currentAdminUser = res.user;
        renderHeader(res.user);
        await loadAllData();
        renderApp();
      } else {
        window.showToast?.('Could not grant admin privileges. Contact system administrator.', 'error');
      }
    } catch (e) {
      window.showToast?.(e.message, 'error');
    }
  });
}

// ── Main App Render ───────────────────────────────────────────────────────────
function renderApp() {
  document.getElementById('admin-main').innerHTML = `
    <!-- Tab Navigation -->
    <div class="admin-tabs">
      <button class="admin-tab ${activeTab === 'users' ? 'active' : ''}" data-tab="users">
        👥 Users <span class="tab-badge">${allUsers.filter(u=>u.role==='pending'||u.role==='pending_coordinator'||u.role==='pending_member').length || ''}</span>
      </button>
      <button class="admin-tab ${activeTab === 'stalls' ? 'active' : ''}" data-tab="stalls">
        🏪 Stalls
      </button>
      <button class="admin-tab ${activeTab === 'sales' ? 'active' : ''}" data-tab="sales">
        💰 Sales Verification
        ${pendingSales.length > 0 ? `<span class="tab-badge urgent">${pendingSales.length}</span>` : ''}
      </button>
      <button class="admin-tab ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit">
        📋 Audit Log
      </button>
    </div>

    <!-- Tab Content -->
    <div class="admin-tab-content" id="admin-tab-content">
      ${renderTabContent()}
    </div>
  `;

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderApp();
    });
  });

  attachTabListeners();
}

function renderTabContent() {
  if (activeTab === 'users') return renderUsersTab();
  if (activeTab === 'stalls') return renderStallsTab();
  if (activeTab === 'sales') return renderSalesTab();
  if (activeTab === 'audit') return renderAuditTab();
  return '';
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function renderUsersTab() {
  const pendingUsers = allUsers.filter(u => ['pending','pending_coordinator','pending_member'].includes(u.role));
  const assignedUsers = allUsers.filter(u => !['pending','pending_coordinator','pending_member'].includes(u.role));

  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h2>Registered Users</h2>
        <span style="color:var(--text-secondary);font-size:14px;">${allUsers.length} total</span>
      </div>

      ${pendingUsers.length > 0 ? `
      <div class="admin-subsection">
        <div class="subsection-title urgent-label">⏳ Pending Approval (${pendingUsers.length})</div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Desired Role</th><th>Since</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${pendingUsers.map(u => `
                <tr id="user-row-${u.id}">
                  <td><strong>${u.name}</strong></td>
                  <td>${u.email}</td>
                  <td><span class="role-pill ${u.role}">${u.role === 'pending_coordinator' ? '👔 Coordinator' : u.role === 'pending_member' ? '👤 Member' : '⏳ Pending'}</span></td>
                  <td>${formatDate(u.created_at)}</td>
                  <td>
                    <div class="action-row">
                      <select class="form-input-sm role-select" data-uid="${u.id}" style="width:130px;">
                        <option value="">Assign role…</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select class="form-input-sm stall-select" data-uid="${u.id}" style="width:140px;">
                        <option value="">No stall</option>
                        ${allStalls.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                      </select>
                      <button class="btn btn-sm btn-success assign-btn" data-uid="${u.id}">Assign ✓</button>
                      <button class="btn btn-sm btn-danger remove-btn" data-uid="${u.id}">Remove ✕</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : '<div class="empty-state">✅ No pending approvals.</div>'}

      ${assignedUsers.length > 0 ? `
      <div class="admin-subsection">
        <div class="subsection-title">Assigned Users (${assignedUsers.length})</div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Stall</th><th>Badge</th><th>Actions</th></tr></thead>
            <tbody>
              ${assignedUsers.map(u => `
                <tr id="user-row-${u.id}">
                  <td><strong>${u.name}</strong></td>
                  <td>${u.email}</td>
                  <td><span class="role-pill ${u.role}">${u.role}</span></td>
                  <td>${u.stall_name || '<span style="color:var(--text-secondary)">—</span>'}</td>
                  <td><code class="mono-num" style="font-size:11px;">${u.badge_code}</code></td>
                  <td>
                    <div class="action-row">
                      <select class="form-input-sm stall-select" data-uid="${u.id}" style="width:140px;">
                        <option value="">No stall</option>
                        ${allStalls.map(s => `<option value="${s.id}" ${s.id===u.stall_id?'selected':''}>${s.name}</option>`).join('')}
                      </select>
                      <button class="btn btn-sm btn-outline reassign-btn" data-uid="${u.id}" data-role="${u.role}">Update</button>
                      <button class="btn btn-sm btn-danger remove-btn" data-uid="${u.id}">Remove</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

// ── Stalls Tab ────────────────────────────────────────────────────────────────
function renderStallsTab() {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h2>Stalls (${allStalls.length})</h2>
        <button class="btn btn-primary btn-sm" id="create-stall-btn">+ Create Stall</button>
      </div>

      ${allStalls.length === 0 ? '<div class="empty-state">No stalls yet. Coordinators can set up their own stalls after being assigned the coordinator role, or create one manually here.</div>' : ''}

      <div class="stalls-grid">
        ${allStalls.map(s => {
          const fin = s.financials || {};
          const coord = allUsers.find(u => u.id === s.coordinator_user_id);
          return `
          <div class="stall-admin-card" style="border-top:4px solid ${s.banner_color || '#4F46E5'};">
            <div class="stall-card-header">
              <div>
                <div class="stall-card-name">${s.name}</div>
                <div class="stall-card-cat">${s.category} · ${s.location || '—'}</div>
              </div>
              <span class="status-pill ${s.status}">${s.status}</span>
            </div>
            <div class="stall-card-stats">
              <div class="stall-stat"><div class="stall-stat-val">${fin.gross_sales_formatted || '₹0'}</div><div class="stall-stat-lbl">Verified Sales</div></div>
              <div class="stall-stat"><div class="stall-stat-val">${fin.total_expenses_formatted || '₹0'}</div><div class="stall-stat-lbl">Expenses</div></div>
              <div class="stall-stat"><div class="stall-stat-val" style="color:${fin.is_profitable ? 'var(--status-success)' : 'var(--status-danger)'};">${fin.net_profit_formatted || '₹0'}</div><div class="stall-stat-lbl">Net P/L</div></div>
            </div>
            <div class="stall-card-footer">
              <span>Coord: <strong>${coord ? coord.name : 'Unassigned'}</strong></span>
              <div class="stall-card-actions">
                <button class="btn btn-sm btn-warning stall-warn-btn" data-stallid="${s.id}">⚠ Warn</button>
                <button class="btn btn-sm btn-danger stall-disc-btn" data-stallid="${s.id}">✕ Discontinue</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Create Stall Form (hidden by default) -->
      <div id="create-stall-form" class="admin-form-card" style="display:none;margin-top:24px;">
        <h3 style="margin-bottom:16px;">Create New Stall</h3>
        <div class="setup-grid-2">
          <div class="form-group">
            <label class="form-label">Stall Name *</label>
            <input type="text" id="new-stall-name" class="form-input" placeholder="e.g. Tech Zone" />
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" id="new-stall-cat" class="form-input" placeholder="Food & Beverage" />
          </div>
          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" id="new-stall-loc" class="form-input" placeholder="Hall A - Booth 12" />
          </div>
          <div class="form-group">
            <label class="form-label">Assign Coordinator (optional)</label>
            <select id="new-stall-coord" class="form-input">
              <option value="">None</option>
              ${allUsers.filter(u=>u.role==='coordinator'||u.role==='pending_coordinator').map(u=>`<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:12px;">
          <button class="btn btn-primary" id="submit-create-stall">Create Stall</button>
          <button class="btn btn-outline" id="cancel-create-stall">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── Sales Verification Tab ────────────────────────────────────────────────────
function renderSalesTab() {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h2>Pending Sales Verification</h2>
        <span style="color:var(--text-secondary);font-size:14px;">${pendingSales.length} awaiting review</span>
      </div>

      ${pendingSales.length === 0 ? `
        <div class="empty-state">✅ All submissions verified! No pending items.</div>
      ` : pendingSales.map(sub => `
        <div class="sales-verify-card" id="sub-card-${sub.id}">
          <div class="sales-verify-header">
            <div>
              <div class="sales-verify-title">${sub.stall_name}</div>
              <div class="sales-verify-meta">
                Submitted by <strong>${sub.submitted_by_name}</strong> · ${formatDate(sub.submitted_at)}
              </div>
              ${sub.notes ? `<div class="sales-verify-note">"${sub.notes}"</div>` : ''}
            </div>
            <div class="sales-verify-amount">
              <div class="sales-amount-big">₹${sub.total_amount?.toLocaleString('en-IN')}</div>
              <div class="sales-amount-split">
                Online: ₹${sub.online_total?.toLocaleString('en-IN')} · Cash: ₹${sub.offline_total?.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          ${sub.items?.length > 0 ? `
          <div class="line-items-table-wrap">
            <table class="admin-table line-items-table">
              <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Mode</th><th>Total</th></tr></thead>
              <tbody>
                ${sub.items.map(item => `
                  <tr>
                    <td>${item.item_name}</td>
                    <td>₹${item.unit_price}</td>
                    <td>${item.qty}</td>
                    <td><span class="mode-pill ${item.payment_mode}">${item.payment_mode}</span></td>
                    <td><strong>₹${(item.unit_price * item.qty).toLocaleString('en-IN')}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="sales-verify-actions">
            <button class="btn btn-success verify-sale-btn" data-subid="${sub.id}">✓ Verify & Add to Ledger</button>
            <div style="display:flex;gap:8px;align-items:center;flex:1;">
              <input type="text" class="form-input reject-reason-input" data-subid="${sub.id}"
                placeholder="Rejection reason…" style="flex:1;" />
              <button class="btn btn-danger reject-sale-btn" data-subid="${sub.id}">✕ Reject</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────
function renderAuditTab() {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h2>Audit Log</h2>
        <span style="color:var(--text-secondary);font-size:14px;">${auditLogs.length} entries</span>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            ${auditLogs.map(log => `
              <tr>
                <td style="white-space:nowrap;font-size:12px;color:var(--text-secondary);">${formatDate(log.timestamp)}</td>
                <td style="font-weight:600;font-size:13px;">${log.actor_name || log.actor_user_id}</td>
                <td><code class="action-code ${log.action.startsWith('SALES')? 'action-sales': log.action.startsWith('ATTENDANCE')? 'action-att': ''}">${log.action}</code></td>
                <td style="font-size:13px;color:var(--text-secondary);">${log.details}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function attachTabListeners() {
  // Assign pending user
  document.querySelectorAll('.assign-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const role = document.querySelector(`.role-select[data-uid="${uid}"]`)?.value;
      const stallId = document.querySelector(`.stall-select[data-uid="${uid}"]`)?.value;
      if (!role) { window.showToast('Select a role first.', 'warning'); return; }
      try {
        await api.request(`/api/auth/users/${uid}/role`, { method: 'PATCH', body: JSON.stringify({ role, stall_id: stallId || null }) });
        window.showToast('Role assigned!', 'success');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  // Reassign existing user
  document.querySelectorAll('.reassign-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const role = btn.dataset.role;
      const stallId = document.querySelector(`.stall-select[data-uid="${uid}"]`)?.value;
      try {
        await api.request(`/api/auth/users/${uid}/role`, { method: 'PATCH', body: JSON.stringify({ role, stall_id: stallId || null }) });
        window.showToast('Updated!', 'success');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  // Remove user
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this user profile? Their Firebase account will remain but they will lose access.')) return;
      try {
        await api.request(`/api/auth/users/${btn.dataset.uid}`, { method: 'DELETE' });
        window.showToast('User removed.', 'success');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  // Create stall button
  document.getElementById('create-stall-btn')?.addEventListener('click', () => {
    document.getElementById('create-stall-form').style.display = 'block';
  });
  document.getElementById('cancel-create-stall')?.addEventListener('click', () => {
    document.getElementById('create-stall-form').style.display = 'none';
  });
  document.getElementById('submit-create-stall')?.addEventListener('click', async () => {
    const name = document.getElementById('new-stall-name')?.value.trim();
    const category = document.getElementById('new-stall-cat')?.value.trim() || 'General';
    const location = document.getElementById('new-stall-loc')?.value.trim();
    const coordUid = document.getElementById('new-stall-coord')?.value;
    if (!name) { window.showToast('Stall name required.', 'warning'); return; }
    try {
      await api.createStall({ name, category, location, coordinator_uid: coordUid || undefined });
      window.showToast(`Stall "${name}" created!`, 'success');
      await loadAllData(); activeTab = 'stalls'; renderApp();
    } catch (err) { window.showToast(err.message, 'error'); }
  });

  // Stall actions
  document.querySelectorAll('.stall-warn-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reason = prompt('Warning reason (shown to coordinator):');
      if (!reason) return;
      try {
        await api.updateStallStatus(btn.dataset.stallid, { status: 'warning', warning_reason: reason });
        window.showToast('Warning issued.', 'warning');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  document.querySelectorAll('.stall-disc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Discontinue this stall? This will notify the coordinator.')) return;
      try {
        await api.updateStallStatus(btn.dataset.stallid, { status: 'discontinued' });
        window.showToast('Stall discontinued.', 'warning');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  // Sales verification
  document.querySelectorAll('.verify-sale-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.verifySale(btn.dataset.subid);
        window.showToast('Sales verified and added to ledger! 🎉', 'success');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });

  document.querySelectorAll('.reject-sale-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reason = document.querySelector(`.reject-reason-input[data-subid="${btn.dataset.subid}"]`)?.value.trim();
      if (!reason) { window.showToast('Please enter a rejection reason.', 'warning'); return; }
      try {
        await api.rejectSale(btn.dataset.subid, reason);
        window.showToast('Submission rejected.', 'warning');
        await loadAllData(); renderApp();
      } catch (err) { window.showToast(err.message, 'error'); }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
