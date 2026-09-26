/**
 * Stall Coordinator View Component - Analytics, POS, Attendance, Expenses
 */

import api from '../api.js';
import state from '../state.js';
import { showQRModal, showQRScannerModal } from './qr-modal.js';

// In-memory cart for the POS session
let posCart = [];
let selectedPaymentMode = 'online';

export function renderCoordinatorView(container, state) {
  const stall = state.activeStall || {};
  const fin = stall.financials || {};
  // Guard: reset to default if stored tab belongs to another role (e.g. admin)
  const COORD_TABS = ['analytics','pos','attendance','expenses','leaderboard','audit-log'];
  const activeTab = COORD_TABS.includes(state.activeTab) ? state.activeTab : 'analytics';
  const offlineQueueCount = api.offlineQueue.length;

  container.innerHTML = `
    <!-- Segmented Navigation for Coordinator -->
    <div class="tab-navigation">
      <button class="tab-btn coordinator ${activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics">
        <span>📊 Business Analytics</span>
      </button>
      <button class="tab-btn coordinator ${activeTab === 'pos' ? 'active' : ''}" data-tab="pos">
        <span>⚡ POS Fast Entry</span>
        ${offlineQueueCount > 0 ? `<span class="tab-badge" style="background:var(--status-danger);color:white;">${offlineQueueCount} offline</span>` : ''}
      </button>
      <button class="tab-btn coordinator ${activeTab === 'attendance' ? 'active' : ''}" data-tab="attendance">
        <span>👥 Team & Attendance</span>
        ${stall.attendance && stall.attendance.filter(a => a.status === 'pending_coordinator').length > 0 ? `
          <span class="tab-badge" style="background:var(--role-coordinator);color:white;">
            ${stall.attendance.filter(a => a.status === 'pending_coordinator').length} req
          </span>
        ` : ''}
      </button>
      <button class="tab-btn coordinator ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">
        <span>💸 Expense Logger</span>
      </button>
      <button class="tab-btn coordinator ${activeTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
        <span>🏆 Leaderboard</span>
      </button>
      <button class="tab-btn coordinator ${activeTab === 'audit-log' ? 'active' : ''}" data-tab="audit-log">
        <span>📜 Stall Audit</span>
      </button>
    </div>

    <!-- Active Tab Content -->
    <div id="coordinator-tab-content">
      ${renderCoordinatorTab(activeTab, stall, fin, state)}
    </div>
  `;

  // Attach tab switch listeners
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      state.setTab(tab);
    });
  });

  attachCoordinatorEventListeners(container, state, stall);
}

function renderCoordinatorTab(tab, stall, fin, state) {
  if (tab === 'analytics') {
    const isProfitable = fin.is_profitable;
    const isBreakEven = fin.is_break_even;

    return `
      <!-- Financial Overview Cards -->
      <div class="stats-grid">
        <div class="stat-card accent-amber">
          <div class="stat-header">
            <span class="stat-label">Verified Gross Sales</span>
            <span class="stat-icon">💰</span>
          </div>
          <div class="stat-value mono-num">${fin.gross_sales_formatted || '₹0'}</div>
          <div class="stat-subtext">
            <span>Online: <strong>${fin.online_sales_formatted || '₹0'}</strong></span> • 
            <span>Offline: <strong>${fin.offline_sales_formatted || '₹0'}</strong></span>
          </div>
        </div>

        <div class="stat-card accent-rose">
          <div class="stat-header">
            <span class="stat-label">Total Logged Expenses</span>
            <span class="stat-icon">🧾</span>
          </div>
          <div class="stat-value mono-num">${fin.total_expenses_formatted || '₹0'}</div>
          <div class="stat-subtext">
            Rent, marketing & inventory costs
          </div>
        </div>

        <div class="stat-card ${isProfitable ? 'accent-green' : 'accent-rose'}">
          <div class="stat-header">
            <span class="stat-label">Net Profit / Loss</span>
            <span class="stat-icon">${isProfitable ? '📈' : '📉'}</span>
          </div>
          <div class="stat-value mono-num" style="color:${isProfitable ? 'var(--status-success)' : 'var(--status-danger)'};">
            ${fin.net_profit_formatted || '₹0'}
          </div>
          <div class="stat-subtext">
            ${isProfitable ? '✅ Running at a clean profit' : `Needs <strong>${fin.amount_needed_formatted || '₹0'}</strong> to reach break-even`}
          </div>
        </div>

        <div class="stat-card accent-indigo">
          <div class="stat-header">
            <span class="stat-label">Expense Recovery %</span>
            <span class="stat-icon">🎯</span>
          </div>
          <div class="stat-value mono-num">${fin.recovered_percent_display || 'N/A'}</div>
          <div class="stat-subtext">
            ${isBreakEven ? '🎉 Break-even goal achieved!' : `${fin.recovered_percent || 0}% of initial investment recovered`}
          </div>
        </div>
      </div>

      <!-- Pending Sales Callout if any -->
      ${fin.pending_submissions_count > 0 ? `
        <div style="background:var(--status-warning-bg); border:1px solid var(--status-warning); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-weight:700; color:var(--status-warning-text);">⏳ Pending Admin Verification: ${fin.pending_total_formatted} (${fin.pending_submissions_count} logs)</div>
            <div style="font-size:13px; color:var(--text-secondary);">These sales will be added to your official gross earnings as soon as Admin verifies your daily log.</div>
          </div>
        </div>
      ` : ''}

      <!-- Break-even Visualizer & Expense Breakdown -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px;">
        <div class="section-card" style="margin-bottom:0;">
          <div class="section-header">
            <div class="section-title">Break-Even Progress</div>
          </div>
          <div style="padding:10px 0;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; font-weight:700;">
              <span>Recovery Progress</span>
              <span class="mono-num">${fin.recovered_percent_display || '0%'}</span>
            </div>
            <div class="progress-track" style="height:14px;">
              <div class="progress-fill ${isBreakEven ? 'success' : 'warning'}" style="width:${fin.recovered_percent || 0}%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-tertiary); margin-top:8px;">
              <span>Gross: ${fin.gross_sales_formatted || '₹0'}</span>
              <span>Target: ${fin.total_expenses_formatted || '₹0'}</span>
            </div>
          </div>
        </div>

        <div class="section-card" style="margin-bottom:0;">
          <div class="section-header">
            <div class="section-title">Expense Categories</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${Object.entries(fin.expenses_by_category || {}).map(([cat, amt]) => `
              <div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px solid var(--border-subtle);">
                <span style="font-weight:600;">${cat}</span>
                <span class="mono-num" style="font-weight:700;">₹${amt.toLocaleString('en-IN')}</span>
              </div>
            `).join('')}
            ${Object.keys(fin.expenses_by_category || {}).length === 0 ? '<div style="font-size:13px; color:var(--text-tertiary);">No expenses logged yet.</div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'pos') {
    const catalog = stall.catalog || [];
    const cartTotal = posCart.reduce((sum, it) => sum + (it.price * it.qty), 0);

    return `
      <!-- Fast POS Terminal -->
      <div class="pos-container">
        <!-- Left: Item Catalog & Quick Entry -->
        <div class="pos-catalog-panel">
          <div class="pos-grid-header">
            <div>
              <div style="font-size:16px; font-weight:700;">Quick Tap Catalog</div>
              <div style="font-size:12px; color:var(--text-tertiary);">Tap items to add directly to current customer cart</div>
            </div>
            <button class="btn btn-outline" id="btn-add-catalog-item" style="font-size:12px; padding:4px 8px;">+ Custom Item</button>
          </div>

          <div class="pos-catalog-grid">
            ${catalog.map(it => `
              <button class="pos-item-btn btn-catalog-tap" data-name="${it.name}" data-price="${it.price}">
                <div class="pos-item-name">${it.name}</div>
                <div class="pos-item-price">₹${it.price}</div>
              </button>
            `).join('')}
          </div>

          <!-- Quick Custom Amount Entry -->
          <div class="pos-custom-bar">
            <div style="font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Custom Entry</div>
            <div class="pos-custom-row">
              <input type="text" id="custom-item-name" class="pos-input" placeholder="Item description..." />
              <input type="number" id="custom-item-price" class="pos-input price-input" placeholder="₹ Price" />
              <button class="btn btn-coordinator" id="btn-add-custom-item" style="padding:0 16px;">Add</button>
            </div>
          </div>
        </div>

        <!-- Right: Current Cart & Finish Day -->
        <div class="pos-cart-panel">
          <div class="pos-cart-header">
            <div style="font-weight:700; font-size:16px;">Active Order / Cart</div>
            <button id="btn-clear-cart" style="background:transparent; border:none; color:var(--status-danger); font-size:12px; font-weight:600; cursor:pointer;">Clear</button>
          </div>

          <!-- Payment Mode Toggle -->
          <div class="cart-payment-switch">
            <button class="payment-mode-btn ${selectedPaymentMode === 'online' ? 'active online' : ''}" data-mode="online">
              💳 UPI / Online
            </button>
            <button class="payment-mode-btn ${selectedPaymentMode === 'offline' ? 'active offline' : ''}" data-mode="offline">
              💵 Cash / Offline
            </button>
          </div>

          <!-- Cart Items List -->
          <div class="cart-items-list">
            ${posCart.length === 0 ? `
              <div style="text-align:center; padding:32px 10px; color:var(--text-tertiary); font-size:13px;">
                🛒 Cart is empty.<br>Tap catalog items to start ringing up sales.
              </div>
            ` : posCart.map((it, idx) => `
              <div class="cart-item-row">
                <div class="cart-item-info">
                  <div class="cart-item-title">${it.name}</div>
                  <div class="cart-item-meta mono-num">₹${it.price} × ${it.qty}</div>
                </div>
                <div class="cart-item-actions">
                  <span class="mono-num" style="font-weight:700;">₹${it.price * it.qty}</span>
                  <button class="cart-qty-btn btn-cart-dec" data-idx="${idx}">-</button>
                  <span style="font-size:13px; font-weight:700; min-width:16px; text-align:center;">${it.qty}</span>
                  <button class="cart-qty-btn btn-cart-inc" data-idx="${idx}">+</button>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Summary Box -->
          <div class="cart-summary-box">
            <div class="cart-summary-row">
              <span>Items in Cart</span>
              <span class="mono-num">${posCart.reduce((s, i) => s + i.qty, 0)}</span>
            </div>
            <div class="cart-summary-row">
              <span>Payment Mode</span>
              <span style="font-weight:700; text-transform:uppercase;">${selectedPaymentMode}</span>
            </div>
            <div class="cart-summary-row total-row">
              <span>Batch Total</span>
              <span class="mono-num">₹${cartTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <!-- Finish My Day / Submit to Admin Button -->
          <button class="btn-finish-day" id="btn-finish-day" ${posCart.length === 0 ? 'disabled' : ''}>
            <span>📤 Submit Sales Log to Admin</span>
          </button>
          <div style="font-size:11px; text-align:center; color:var(--text-tertiary); margin-top:8px;">
            Enforces idempotency • Saves locally if offline
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'attendance') {
    const members = (stall.members || []);
    const attendanceRecords = (stall.attendance || []);
    const pendingRequests = attendanceRecords.filter(a => a.status === 'pending_coordinator');
    const joinRequests = (stall.join_requests || []);
    const inviteCode = stall.invite_code || 'N/A';
    const myCoordAttendance = attendanceRecords.find(a => a.member_user_id === state.currentUser?.id && a.role === 'coordinator');
    const isCoordConfirmed = myCoordAttendance && myCoordAttendance.status === 'confirmed';

    return `
      <!-- Coordinator Self Attendance Status Card -->
      <div style="background:var(--bg-surface); border:1px solid ${isCoordConfirmed ? 'var(--status-success)' : 'var(--border-medium)'}; border-radius:var(--radius-md); padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:28px;">⭐</span>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:800; font-size:15px; color:var(--text-primary);">Stall Coordinator Attendance Status:</span>
              <span class="badge ${isCoordConfirmed ? 'badge-verified' : 'badge-pending'}">
                ${isCoordConfirmed ? '✓ CONFIRMED PRESENT' : '⏳ NOT YET MARKED'}
              </span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:3px;">
              ${isCoordConfirmed ? `Verified via ${myCoordAttendance.verified_method || 'QR Scanner'} at ${new Date(myCoordAttendance.timestamp).toLocaleTimeString()}` : 'Mark your official coordinator presence for today using your QR badge or button.'}
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${!isCoordConfirmed ? `
            <button class="btn btn-coordinator" id="btn-mark-coord-att" style="font-size:12px; padding:7px 14px;">
              ✓ Mark My Coordinator Attendance
            </button>
          ` : ''}
          <button class="btn btn-outline" id="btn-view-coord-qr" style="font-size:12px; padding:7px 14px;">
            🪪 View My Coordinator QR Badge
          </button>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="section-title">Stall Team Attendance Desk</div>
            <div class="section-desc">You are the single accountable signature for your stall's attendance. Scan member QR badges or approve check-in requests.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-coordinator" id="btn-add-member-modal">➕ Add Stall Member</button>
            <button class="btn btn-admin" id="btn-scan-qr-modal" style="font-size:13px; font-weight:700;">📷 Scan Member Badge QR</button>
          </div>
        </div>

        <!-- Stall Invite Code Sharing Banner -->
        <div style="background:var(--role-coordinator-light); border:1px solid var(--role-coordinator-border); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:var(--role-coordinator-text); text-transform:uppercase; letter-spacing:0.5px;">🔑 Stall Member Invite Code</div>
            <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
              <span class="mono-num" style="font-size:20px; font-weight:800; color:var(--text-primary); letter-spacing:2px; background:var(--bg-surface); padding:4px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-medium);">${inviteCode}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px;">
              Share this permanent 12-digit code with your members. When they paste it, their join request appears below for your approval.
            </div>
          </div>
          <button class="btn btn-coordinator btn-copy-invite-code" data-code="${inviteCode}">
            📋 Copy Invite Code
          </button>
        </div>

        <!-- Pending Member Join Requests -->
        ${joinRequests.length > 0 ? `
          <div style="background:rgba(99,102,241,0.08); border:1px solid var(--accent-primary); border-radius:var(--radius-md); padding:16px; margin-bottom:20px;">
            <div style="font-weight:700; color:var(--accent-primary); margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <span>🔔</span>
              <span>${joinRequests.length} Member Join Request${joinRequests.length > 1 ? 's' : ''} Pending Your Approval</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${joinRequests.map(req => `
                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface); padding:12px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); flex-wrap:wrap; gap:10px;">
                  <div>
                    <div style="font-weight:700; font-size:15px;">${req.user_name} ${req.user_username ? `<span style="font-size:12px; font-weight:400; color:var(--text-secondary);">@${req.user_username}</span>` : ''}</div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                      📧 ${req.user_email || '—'} • 📱 ${req.user_phone || '—'} ${req.user_college ? `• 🏫 ${req.user_college}` : ''}
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="btn btn-coordinator btn-approve-join" data-request-id="${req.id}" data-user-name="${req.user_name}">
                      ✓ Approve Join
                    </button>
                    <button class="btn btn-outline btn-reject-join" data-request-id="${req.id}" data-user-name="${req.user_name}" style="color:var(--status-danger);">
                      ✕ Decline
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Pending Check-in Requests Alert -->
        ${pendingRequests.length > 0 ? `
          <div style="background:var(--role-coordinator-light); border:1px solid var(--role-coordinator-border); border-radius:var(--radius-md); padding:16px; margin-bottom:20px;">
            <div style="font-weight:700; color:var(--role-coordinator-text); margin-bottom:8px;">
              ⚡ ${pendingRequests.length} Member Arrival Check-in Requests Pending
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${pendingRequests.map(req => {
                const member = members.find(m => m.id === req.member_user_id) || {};
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
                    <div>
                      <div style="font-weight:700;">${member.name || 'Member'} (${member.badge_code || ''})</div>
                      <div style="font-size:12px; color:var(--text-tertiary);">${member.designation || 'Team Member'} • Tapped "I'm at my stall" at ${new Date(req.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <button class="btn btn-success btn-confirm-att" data-att-id="${req.id}">
                      ✓ Confirm Arrival
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Team Roster -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member Name & Role</th>
                <th>Contact</th>
                <th>Badge Code</th>
                <th>Attendance Status</th>
                <th>Confirmation Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${members.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:32px; color:var(--text-tertiary);">
                    No team members added to your stall yet.<br>
                    Click <strong style="color:var(--text-primary);">"➕ Add Stall Member"</strong> above to add members to your stall.
                  </td>
                </tr>
              ` : members.map(m => {
                const record = attendanceRecords.find(a => a.member_user_id === m.id);
                const isConfirmed = record && record.status === 'confirmed';
                const isPending = record && record.status === 'pending_coordinator';
                
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;">${m.name}</div>
                      <div style="font-size:11px; color:var(--text-tertiary);">${m.designation || 'Team Member'}</div>
                    </td>
                    <td>${m.phone || '—'}</td>
                    <td class="mono-num" style="font-weight:700; color:var(--primary);">${m.badge_code || '—'}</td>
                    <td>
                      ${isConfirmed ? `
                        <span class="badge badge-verified">✓ CONFIRMED PRESENT</span>
                      ` : isPending ? `
                        <span class="badge badge-pending">⏳ PENDING YOUR APPROVAL</span>
                      ` : `
                        <span class="badge" style="background:var(--bg-surface-inset); color:var(--text-tertiary);">NOT CHECKED IN</span>
                      `}
                    </td>
                    <td class="mono-num" style="font-size:12px;">
                      ${isConfirmed ? `${new Date(record.timestamp).toLocaleTimeString()} (${record.verified_method})` : '—'}
                    </td>
                    <td>
                      <div style="display:flex; gap:6px; align-items:center;">
                        ${!isConfirmed ? `
                          <button class="btn btn-outline btn-scan-member-row" data-badge="${m.badge_code}" data-name="${m.name}" style="font-size:11px; padding:3px 8px; color:var(--status-success); border-color:var(--status-success);" title="Verify member attendance">📷 Scan</button>
                        ` : ''}
                        <button class="btn btn-outline btn-view-member-badge" data-uid="${m.id}" style="font-size:11px; padding:3px 8px;" title="View Member QR Badge">🪪 Badge</button>
                        <button class="btn btn-outline btn-remove-stall-member" data-member-id="${m.id}" data-member-name="${m.name}" style="font-size:11px; padding:3px 8px; color:var(--status-danger);" title="Remove member from stall">✕</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === 'expenses') {
    const expenses = (stall.expenses || []);
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Stall Expense Ledger</div>
            <div class="section-desc">Log costs for stall rent, materials, banners, and kits. Directly impacts your break-even recovery %!</div>
          </div>
          <button class="btn btn-coordinator" id="btn-log-expense-modal">+ Log New Expense</button>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Expense Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Logged At</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(e => `
                <tr>
                  <td style="font-weight:600;">${e.name}</td>
                  <td><span class="badge badge-pending">${e.category}</span></td>
                  <td class="mono-num" style="font-weight:700;">₹${e.amount.toLocaleString('en-IN')}</td>
                  <td class="mono-num" style="font-size:12px;">${new Date(e.timestamp).toLocaleString()}</td>
                </tr>
              `).join('')}
              ${expenses.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No expenses logged yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === 'leaderboard') {
    const leaderboard = (state.eventSummary ? state.eventSummary.leaderboard : []) || [];
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Building Pravara Event Leaderboard</div>
            <div class="section-desc">Live standings based on verified gross sales across all stalls</div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:60px;">Rank</th>
                <th>Stall</th>
                <th>Verified Gross</th>
                <th>Break-even Status</th>
              </tr>
            </thead>
            <tbody>
              ${leaderboard.map(it => `
                <tr style="${it.stall_id === stall.id ? 'background:var(--role-coordinator-light); font-weight:700;' : ''}">
                  <td style="font-size:18px; text-align:center;">${it.medal || it.rank}</td>
                  <td>
                    <div>${it.stall_name} ${it.stall_id === stall.id ? '👈 (Your Stall)' : ''}</div>
                    <div style="font-size:11px; color:var(--text-tertiary);">${it.category}</div>
                  </td>
                  <td class="mono-num" style="font-weight:800;">${it.gross_sales_formatted}</td>
                  <td>
                    <span class="badge ${it.is_break_even ? 'badge-verified' : 'badge-pending'}">
                      ${it.is_break_even ? 'CLEARED' : `${it.recovered_percent || 0}% RECOVERED`}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === 'audit-log') {
    const logs = (state.auditLogs || []);
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Stall & Team Operations Ledger</div>
            <div class="section-desc">Level-2 verified record of all sales verifications, attendance check-ins, and team updates for ${stall.name}.</div>
          </div>
          <span class="badge badge-verified">${logs.length} Recorded Events</span>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td class="mono-num" style="font-size:11px; white-space:nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td><span class="badge badge-pending" style="font-size:10px;">${log.category || 'Operations'}</span></td>
                  <td style="font-weight:600;">${log.actor_name}</td>
                  <td><span class="badge ${log.action.includes('VERIFIED') || log.action.includes('CONFIRMED') ? 'badge-verified' : 'badge-active'}">${log.action}</span></td>
                  <td style="font-size:12px;">${log.details}</td>
                </tr>
              `).join('')}
              ${logs.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-tertiary);">No audit activity recorded for this stall yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return '';
}

function attachCoordinatorEventListeners(container, state, stall) {
  // POS Item Tap
  container.querySelectorAll('.btn-catalog-tap').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const price = Number(btn.getAttribute('data-price'));
      
      const existing = posCart.find(i => i.name === name);
      if (existing) {
        existing.qty += 1;
      } else {
        posCart.push({ name, price, qty: 1, payment_mode: selectedPaymentMode });
      }
      renderCoordinatorView(container, state);
    });
  });

  // Custom Item Add
  const addCustomBtn = container.querySelector('#btn-add-custom-item');
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', () => {
      const nameInput = container.querySelector('#custom-item-name');
      const priceInput = container.querySelector('#custom-item-price');
      const name = nameInput.value.trim();
      const price = Number(priceInput.value);

      if (!name || isNaN(price) || price <= 0) {
        window.showToast('Please enter item name and valid price', 'error');
        return;
      }

      posCart.push({ name, price, qty: 1, payment_mode: selectedPaymentMode });
      nameInput.value = '';
      priceInput.value = '';
      renderCoordinatorView(container, state);
    });
  }

  // Clear Cart
  const clearBtn = container.querySelector('#btn-clear-cart');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      posCart = [];
      renderCoordinatorView(container, state);
    });
  }

  // Payment mode toggle
  container.querySelectorAll('.payment-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPaymentMode = btn.getAttribute('data-mode');
      posCart.forEach(it => it.payment_mode = selectedPaymentMode);
      renderCoordinatorView(container, state);
    });
  });

  // Quantity + / - buttons
  container.querySelectorAll('.btn-cart-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      if (posCart[idx]) {
        posCart[idx].qty += 1;
        renderCoordinatorView(container, state);
      }
    });
  });

  container.querySelectorAll('.btn-cart-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      if (posCart[idx]) {
        posCart[idx].qty -= 1;
        if (posCart[idx].qty <= 0) {
          posCart.splice(idx, 1);
        }
        renderCoordinatorView(container, state);
      }
    });
  });

  // Finish My Day / Submit POS Batch
  const finishBtn = container.querySelector('#btn-finish-day');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      if (posCart.length === 0) return;

      const onlineTotal = posCart
        .filter(i => i.payment_mode === 'online')
        .reduce((sum, i) => sum + (i.price * i.qty), 0);

      const offlineTotal = posCart
        .filter(i => i.payment_mode === 'offline')
        .reduce((sum, i) => sum + (i.price * i.qty), 0);

      // Generate Idempotency Key
      const idempotencyKey = `idem-${stall.id}-${Date.now()}`;

      finishBtn.disabled = true;
      finishBtn.textContent = 'Submitting...';

      try {
        const res = await api.submitSales({
          stall_id: stall.id,
          online_total: onlineTotal,
          offline_total: offlineTotal,
          items: posCart.map(i => ({
            item_name: i.name,
            unit_price: i.price,
            qty: i.qty,
            payment_mode: i.payment_mode
          })),
          idempotency_key: idempotencyKey,
          notes: `Batch submission with ${posCart.length} line items`
        });

        if (res.offline_queued) {
          window.showToast('📡 Saved in offline POS queue. Will sync when reconnected.', 'warning');
        } else {
          window.showToast('Sales log submitted to Admin for verification!', 'success');
        }

        posCart = [];
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        finishBtn.disabled = false;
        finishBtn.textContent = 'Submit Sales Log to Admin';
      }
    });
  }

  // Attendance Confirm Button
  container.querySelectorAll('.btn-confirm-att').forEach(btn => {
    btn.addEventListener('click', async () => {
      const attId = btn.getAttribute('data-att-id');
      btn.disabled = true;
      try {
        await api.confirmAttendance(attId);
        window.showToast('Attendance confirmed!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Log Expense Button
  const logExpBtn = container.querySelector('#btn-log-expense-modal');
  if (logExpBtn) {
    logExpBtn.addEventListener('click', () => {
      showLogExpenseModal(stall, state);
    });
  }

  // Add Catalog Item Modal Trigger
  const addCatBtn = container.querySelector('#btn-add-catalog-item');
  if (addCatBtn) {
    addCatBtn.addEventListener('click', () => {
      showAddCatalogItemModal(stall, state);
    });
  }

  // Add Member Modal Trigger
  const addMemberBtn = container.querySelector('#btn-add-member-modal');
  if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
      showAddStallMemberModal(stall, state);
    });
  }

  // Remove Stall Member Trigger
  container.querySelectorAll('.btn-remove-stall-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const memberId = btn.getAttribute('data-member-id');
      const memberName = btn.getAttribute('data-member-name') || 'this member';
      if (!confirm(`Remove "${memberName}" from your stall team?`)) return;
      try {
        await api.removeStallMember(stall.id, memberId);
        window.showToast?.(`Removed "${memberName}" from stall.`, 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast?.(err.message || 'Failed to remove member.', 'error');
      }
    });
  });

  // Copy Stall Invite Code
  container.querySelectorAll('.btn-copy-invite-code').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code');
      if (code) {
        try {
          await navigator.clipboard.writeText(code);
          window.showToast?.('✅ Stall Invite Code copied to clipboard!', 'success');
        } catch (e) {
          const temp = document.createElement('input');
          temp.value = code;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
          window.showToast?.('✅ Stall Invite Code copied to clipboard!', 'success');
        }
      }
    });
  });

  // Approve Member Join Request
  container.querySelectorAll('.btn-approve-join').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.getAttribute('data-request-id');
      const userName = btn.getAttribute('data-user-name') || 'Member';
      btn.disabled = true;
      btn.textContent = 'Approving…';
      try {
        await api.approveJoinRequest(stall.id, reqId);
        window.showToast?.(`✅ Approved ${userName} to join your stall team!`, 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast?.(err.message || 'Failed to approve request.', 'error');
        btn.disabled = false;
        btn.textContent = '✓ Approve Join';
      }
    });
  });

  // Reject Member Join Request
  container.querySelectorAll('.btn-reject-join').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.getAttribute('data-request-id');
      const userName = btn.getAttribute('data-user-name') || 'this member';
      if (!confirm(`Decline join request for ${userName}?`)) return;
      btn.disabled = true;
      try {
        await api.rejectJoinRequest(stall.id, reqId);
        window.showToast?.(`Declined request for ${userName}.`, 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast?.(err.message || 'Failed to reject request.', 'error');
        btn.disabled = false;
      }
    });
  });

  // ── QR Attendance Actions ──────────────────────────────────────────────────
  // Scan Member Badge QR Button
  const scanQrBtn = container.querySelector('#btn-scan-qr-modal');
  if (scanQrBtn) {
    scanQrBtn.addEventListener('click', () => {
      showQRScannerModal({
        title: '📷 Scan Member Badge QR',
        hint: `Point camera at member badge QR to verify and confirm their attendance for ${stall.name}.`,
        onScanSuccess: async () => {
          await state.refreshAll();
        }
      });
    });
  }

  // Mark Coordinator Self-Attendance
  const markCoordAttBtn = container.querySelector('#btn-mark-coord-att');
  if (markCoordAttBtn) {
    markCoordAttBtn.addEventListener('click', async () => {
      markCoordAttBtn.disabled = true;
      markCoordAttBtn.textContent = 'Verifying...';
      try {
        const myBadge = state.currentUser?.badge_code || state.currentUser?.id;
        const res = await api.scanConfirmAttendance(myBadge);
        window.showToast(res.message || 'Coordinator attendance confirmed!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        markCoordAttBtn.disabled = false;
        markCoordAttBtn.textContent = '✓ Mark My Coordinator Attendance';
      }
    });
  }

  // View My Coordinator QR Badge
  const viewCoordQrBtn = container.querySelector('#btn-view-coord-qr');
  if (viewCoordQrBtn) {
    viewCoordQrBtn.addEventListener('click', () => {
      showQRModal(state.currentUser);
    });
  }

  // Row Scan Button
  container.querySelectorAll('.btn-scan-member-row').forEach(btn => {
    btn.addEventListener('click', async () => {
      const badge = btn.getAttribute('data-badge');
      const name = btn.getAttribute('data-name');
      try {
        const res = await api.scanConfirmAttendance(badge);
        window.showToast(res.message || `Attendance confirmed for ${name}!`, 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  });

  // Row View Badge Button
  container.querySelectorAll('.btn-view-member-badge').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-uid');
      const member = (stall.members || []).find(m => m.id === uid);
      if (member) {
        showQRModal({ ...member, stall_name: stall.name });
      }
    });
  });
}

function showLogExpenseModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="log-exp-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size:18px;">Log Stall Expense</h3>
          <button class="modal-close-btn" id="close-exp-modal">✕</button>
        </div>

        <form id="exp-form" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="font-size:12px; font-weight:700;">Expense Category</label>
            <select id="exp-cat-input" class="pos-input" style="width:100%;">
              <option value="Raw Materials">Raw Materials & Supplies</option>
              <option value="Inventory Purchase">Inventory Purchase</option>
              <option value="Banners & Marketing">Banners & Marketing</option>
              <option value="Hardware & Kits">Hardware & Electronic Kits</option>
              <option value="Packaging">Packaging & Disposables</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Expense Name / Purpose</label>
            <input type="text" id="exp-name-input" class="pos-input" placeholder="e.g. 50x Extra Acrylic Badges" required />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Amount (₹ INR)</label>
            <input type="number" id="exp-amount-input" class="pos-input" placeholder="₹ 1500" required />
          </div>

          <button type="submit" class="btn btn-coordinator" style="padding:12px; margin-top:8px;">
            Add to Expense Ledger
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-exp-modal').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('exp-cat-input').value;
    const name = document.getElementById('exp-name-input').value;
    const amount = Number(document.getElementById('exp-amount-input').value);

    try {
      await api.logExpense(stall.id, { category, name, amount });
      window.showToast('Expense recorded & break-even recalculated!', 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  });
}

function showScanQRModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const members = stall.members || [];

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="scan-qr-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size:18px;">Scan Member Badge QR</h3>
          <button class="modal-close-btn" id="close-scan-modal">✕</button>
        </div>

        <div style="text-align:center; padding:16px 0;">
          <div style="font-size:48px; margin-bottom:8px;">📷</div>
          <div style="font-weight:700; font-size:15px;">Badge Scanner Simulator</div>
          <div style="font-size:12px; color:var(--text-tertiary); margin-top:4px;">
            Select a team member's badge or type badge code to verify attendance
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
          ${members.map(m => `
            <button class="btn btn-outline btn-quick-scan" data-code="${m.badge_code}" style="justify-content:space-between; text-align:left;">
              <span><strong>${m.name}</strong> (${m.designation || 'Member'})</span>
              <span class="mono-num" style="font-weight:700;">${m.badge_code}</span>
            </button>
          `).join('')}
        </div>

        <form id="manual-scan-form" style="display:flex; gap:8px;">
          <input type="text" id="manual-badge-input" class="pos-input" placeholder="Type badge code (e.g. BP-MEM-201)" required />
          <button type="submit" class="btn btn-coordinator">Verify</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-scan-modal').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  const handleScan = async (badgeCode) => {
    try {
      const res = await api.scanConfirmAttendance(badgeCode);
      window.showToast(res.message || 'Badge verified & attendance recorded!', 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  };

  modalContainer.querySelectorAll('.btn-quick-scan').forEach(btn => {
    btn.addEventListener('click', () => {
      handleScan(btn.getAttribute('data-code'));
    });
  });

  document.getElementById('manual-scan-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('manual-badge-input').value.trim();
    if (code) handleScan(code);
  });
}

function showAddCatalogItemModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-item-backdrop">
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <h3 style="font-size:18px;">Add Item to Stall Catalog</h3>
          <button class="modal-close-btn" id="close-catalog-modal">✕</button>
        </div>

        <form id="catalog-item-form" style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Item Name <span style="color:var(--status-danger);">*</span></label>
            <input type="text" id="cat-item-name" class="pos-input" placeholder="e.g. Masala Dosa, VR Experience" required style="width:100%;" />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Price (₹ INR) <span style="color:var(--status-danger);">*</span></label>
            <input type="number" id="cat-item-price" class="pos-input" placeholder="50" min="1" required style="width:100%;" />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Item Category</label>
            <input type="text" id="cat-item-cat" class="pos-input" placeholder="e.g. Snack, Combo, Pass" value="Standard" style="width:100%;" />
          </div>

          <div id="catalog-item-error" class="auth-error" style="display:none; color:var(--status-danger); font-size:12px;"></div>

          <button type="submit" class="btn btn-coordinator" id="btn-save-cat-item" style="padding:12px; margin-top:8px;">
            Save to Catalog
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-catalog-modal').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('catalog-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-item-name').value.trim();
    const price = Number(document.getElementById('cat-item-price').value);
    const category = document.getElementById('cat-item-cat').value.trim() || 'Standard';
    const errEl = document.getElementById('catalog-item-error');
    const saveBtn = document.getElementById('btn-save-cat-item');

    errEl.style.display = 'none';

    if (!name || isNaN(price) || price <= 0) {
      errEl.textContent = 'Please enter a valid item name and positive price.';
      errEl.style.display = 'block';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await api.addCatalogItem(stall.id, { name, price, category });
      window.showToast?.(`✅ "${name}" (₹${price}) added to catalog!`, 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      errEl.textContent = err.message || 'Failed to add item.';
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Catalog';
    }
  });
}

function showAddStallMemberModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-member-backdrop">
      <div class="modal-card" style="max-width:460px;">
        <div class="modal-header">
          <h3 style="font-size:18px;">➕ Add Stall Team Member</h3>
          <button class="modal-close-btn" id="close-member-modal">✕</button>
        </div>

        <form id="stall-member-form" style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Member Full Name <span style="color:var(--status-danger);">*</span></label>
            <input type="text" id="new-member-name" class="pos-input" placeholder="e.g. Rohan Sharma" required style="width:100%;" />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Phone / WhatsApp</label>
            <input type="tel" id="new-member-phone" class="pos-input" placeholder="+91 98000 00000" style="width:100%;" />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Stall Role / Designation <span style="color:var(--status-danger);">*</span></label>
            <select id="new-member-desig" class="pos-input" style="width:100%;">
              <option value="Billing & Cashier">Billing & Cashier</option>
              <option value="Order & Food Prep">Order & Food Prep</option>
              <option value="Display & Sales">Display & Sales</option>
              <option value="Hospitality & Service">Hospitality & Service</option>
              <option value="Technical Support">Technical Support</option>
              <option value="Team Member" selected>General Team Member</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Custom Badge Code <span style="color:var(--text-tertiary); font-weight:400;">(optional)</span></label>
            <input type="text" id="new-member-badge" class="pos-input" placeholder="e.g. M-1042 (leave empty for auto-generate)" style="width:100%;" />
          </div>

          <div id="stall-member-error" class="auth-error" style="display:none; color:var(--status-danger); font-size:12px;"></div>

          <button type="submit" class="btn btn-coordinator" id="btn-save-stall-member" style="padding:12px; margin-top:8px;">
            Add to Stall Team
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-member-modal').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('stall-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-member-name').value.trim();
    const phone = document.getElementById('new-member-phone').value.trim();
    const designation = document.getElementById('new-member-desig').value;
    const badge_code = document.getElementById('new-member-badge').value.trim();
    const errEl = document.getElementById('stall-member-error');
    const saveBtn = document.getElementById('btn-save-stall-member');

    errEl.style.display = 'none';

    if (!name) {
      errEl.textContent = 'Please enter member full name.';
      errEl.style.display = 'block';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding…';

    try {
      await api.addStallMember(stall.id, { name, phone, designation, badge_code });
      window.showToast?.(`✅ "${name}" added to your stall team!`, 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      errEl.textContent = err.message || 'Failed to add member.';
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add to Stall Team';
    }
  });
}

