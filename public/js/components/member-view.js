/**
 * Stall Member View Component - Business Literacy, QR Badge, Arrival Check-in
 */

import api from '../api.js';
import state from '../state.js';
import { showQRModal } from './qr-modal.js';

export function renderMemberView(container, state) {
  const stall = state.activeStall || {};
  const fin = stall.financials || {};
  const user = state.currentUser || {};
  const activeTab = state.activeTab || 'member-dashboard';

  // Check current member's attendance record
  const myAttendance = stall.attendance
    ? stall.attendance.find(a => a.member_user_id === user.id)
    : null;

  container.innerHTML = `
    <!-- Segmented Navigation for Member -->
    <div class="tab-navigation">
      <button class="tab-btn member ${activeTab === 'member-dashboard' ? 'active' : ''}" data-tab="member-dashboard">
        <span>📊 Stall Financials</span>
      </button>
      <button class="tab-btn member ${activeTab === 'member-badge' ? 'active' : ''}" data-tab="member-badge">
        <span>🪪 My QR Badge & Check-in</span>
        ${myAttendance && myAttendance.status === 'confirmed' ? '<span class="tab-badge" style="background:var(--status-success);color:white;">✓ Present</span>' : ''}
      </button>
      <button class="tab-btn member ${activeTab === 'member-leaderboard' ? 'active' : ''}" data-tab="member-leaderboard">
        <span>🏆 Event Leaderboard</span>
      </button>
    </div>

    <!-- Active Tab Content -->
    <div id="member-tab-content">
      ${renderMemberTab(activeTab, stall, fin, user, myAttendance, state)}
    </div>
  `;

  // Attach tab switch listeners
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      state.setTab(tab);
    });
  });

  attachMemberEventListeners(container, state, user);
}

function renderMemberTab(tab, stall, fin, user, myAttendance, state) {
  if (tab === 'member-dashboard') {
    const isProfitable = fin.is_profitable;
    const isBreakEven = fin.is_break_even;

    return `
      <!-- Financial Literacy Banner -->
      <div style="background:var(--role-member-light); border:1px solid var(--role-member-border); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-weight:700; color:var(--role-member-text);">
            📍 ${stall.name || 'Your Stall'} Business Overview
          </div>
          <div style="font-size:13px; color:var(--text-secondary);">
            As a team member, you have full transparent visibility into your stall's verified sales, expenses, and break-even math.
          </div>
        </div>
        <button class="btn btn-member" id="btn-view-my-badge-shortcut">
          🪪 View My Badge
        </button>
      </div>

      <!-- Financial Metrics Grid -->
      <div class="stats-grid">
        <div class="stat-card accent-rose">
          <div class="stat-header">
            <span class="stat-label">Verified Gross Earnings</span>
            <span class="stat-icon">💰</span>
          </div>
          <div class="stat-value mono-num">${fin.gross_sales_formatted || '₹0'}</div>
          <div class="stat-subtext">
            <span>Online: <strong>${fin.online_sales_formatted || '₹0'}</strong></span> • 
            <span>Offline: <strong>${fin.offline_sales_formatted || '₹0'}</strong></span>
          </div>
        </div>

        <div class="stat-card accent-indigo">
          <div class="stat-header">
            <span class="stat-label">Total Stall Expenses</span>
            <span class="stat-icon">🧾</span>
          </div>
          <div class="stat-value mono-num">${fin.total_expenses_formatted || '₹0'}</div>
          <div class="stat-subtext">
            Setup, raw materials & merchandise costs
          </div>
        </div>

        <div class="stat-card ${isProfitable ? 'accent-green' : 'accent-rose'}">
          <div class="stat-header">
            <span class="stat-label">Net Profit / Margin</span>
            <span class="stat-icon">${isProfitable ? '📈' : '📉'}</span>
          </div>
          <div class="stat-value mono-num" style="color:${isProfitable ? 'var(--status-success)' : 'var(--status-danger)'};">
            ${fin.net_profit_formatted || '₹0'}
          </div>
          <div class="stat-subtext">
            ${isProfitable ? '🎉 Stall is operating in profit!' : `Requires <strong>${fin.amount_needed_formatted || '₹0'}</strong> to reach break-even`}
          </div>
        </div>

        <div class="stat-card accent-amber">
          <div class="stat-header">
            <span class="stat-label">Cost Recovery</span>
            <span class="stat-icon">🎯</span>
          </div>
          <div class="stat-value mono-num">${fin.recovered_percent_display || 'N/A'}</div>
          <div class="stat-subtext">
            ${isBreakEven ? '✅ Break-even cleared' : `${fin.recovered_percent || 0}% of initial investment recovered`}
          </div>
        </div>
      </div>

      <!-- Break-Even Visualizer -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Break-Even Progress</div>
        </div>
        <div style="padding:10px 0;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; font-weight:700;">
            <span>Recovery Target</span>
            <span class="mono-num">${fin.recovered_percent_display || '0%'}</span>
          </div>
          <div class="progress-track" style="height:14px;">
            <div class="progress-fill ${isBreakEven ? 'success' : 'warning'}" style="width:${fin.recovered_percent || 0}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-tertiary); margin-top:8px;">
            <span>Verified Sales: ${fin.gross_sales_formatted || '₹0'}</span>
            <span>Total Expenses: ${fin.total_expenses_formatted || '₹0'}</span>
          </div>
        </div>
      </div>

      <!-- Expense Categories List -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">Itemized Expense Categories</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${Object.entries(fin.expenses_by_category || {}).map(([cat, amt]) => `
            <div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px solid var(--border-subtle);">
              <span style="font-weight:600;">${cat}</span>
              <span class="mono-num" style="font-weight:700;">₹${amt.toLocaleString('en-IN')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (tab === 'member-badge') {
    const isConfirmed = myAttendance && myAttendance.status === 'confirmed';
    const isPending = myAttendance && myAttendance.status === 'pending_coordinator';

    return `
      <div style="display:grid; grid-template-columns:360px 1fr; gap:24px; align-items:start;">
        <!-- Left: Realistic Event Badge -->
        <div class="badge-credential-card" style="margin:0;">
          <div class="badge-lanyard-hole"></div>
          
          <div class="badge-header-strip member">
            <div class="badge-event-title">Building Pravara '26</div>
            <div class="badge-event-subtitle">Pravara Rural Engineering College, Loni</div>
          </div>

          <div class="badge-body">
            <div class="badge-qr-box" id="member-inline-qr" style="cursor:pointer;" title="Click to enlarge">
              <!-- Inline QR rendered via JS -->
              <div style="width:160px; height:160px; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--text-tertiary);">
                Loading QR Code...
              </div>
            </div>

            <div class="badge-user-name">${user.name}</div>
            <div class="badge-user-role-tag member">TEAM MEMBER</div>
            
            <div class="badge-stall-name">
              📍 ${user.stall_name || stall.name || 'Assigned Stall'}
            </div>

            <div class="badge-code-display">${user.badge_code || user.id}</div>
          </div>

          <div class="badge-footer-security">
            <span>🔒 VERIFIED STUDENT CREDENTIAL</span>
          </div>
        </div>

        <!-- Right: Arrival Check-In Workflow -->
        <div class="section-card" style="margin-bottom:0;">
          <div class="section-header">
            <div>
              <div class="section-title">Attendance Check-In</div>
              <div class="section-desc">Workflow A: Report your arrival at your assigned booth for Coordinator confirmation</div>
            </div>
          </div>

          <div style="padding:16px 0;">
            ${isConfirmed ? `
              <div style="background:var(--status-success-bg); border:1px solid var(--status-success); border-radius:var(--radius-md); padding:20px; text-align:center;">
                <div style="font-size:40px; margin-bottom:8px;">✅</div>
                <div style="font-size:18px; font-weight:700; color:var(--status-success-text);">
                  Attendance Confirmed Present
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">
                  Confirmed at <strong>${new Date(myAttendance.timestamp).toLocaleTimeString()}</strong> (${myAttendance.verified_method || 'Verified'}).
                </div>
              </div>
            ` : isPending ? `
              <div style="background:var(--status-warning-bg); border:1px solid var(--status-warning); border-radius:var(--radius-md); padding:20px; text-align:center;">
                <div style="font-size:40px; margin-bottom:8px;">⏳</div>
                <div style="font-size:18px; font-weight:700; color:var(--status-warning-text);">
                  Check-in Request Sent!
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">
                  Your Stall Coordinator has been notified and will approve your arrival on their dashboard.
                </div>
              </div>
            ` : `
              <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:24px; text-align:center;">
                <div style="font-size:40px; margin-bottom:12px;">📍</div>
                <div style="font-size:18px; font-weight:700; margin-bottom:6px;">
                  Have you arrived at ${stall.name || 'your stall'}?
                </div>
                <div style="font-size:13px; color:var(--text-secondary); max-width:400px; margin:0 auto 20px auto;">
                  Tap below to raise a live check-in request or present your QR badge to your Stall Coordinator for scanning.
                </div>
                <button class="btn btn-member" id="btn-tap-checkin" style="padding:14px 28px; font-size:16px;">
                  📍 I'm At My Stall — Check In
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'member-leaderboard') {
    const leaderboard = (state.eventSummary ? state.eventSummary.leaderboard : []) || [];
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Building Pravara Event Leaderboard</div>
            <div class="section-desc">Live standings based on verified gross sales</div>
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
                <tr style="${it.stall_id === stall.id ? 'background:var(--role-member-light); font-weight:700;' : ''}">
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

  return '';
}

function attachMemberEventListeners(container, state, user) {
  // Check-in trigger button
  const checkinBtn = container.querySelector('#btn-tap-checkin');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', async () => {
      checkinBtn.disabled = true;
      checkinBtn.textContent = 'Sending Request...';
      try {
        const res = await api.requestCheckin();
        window.showToast(res.message || 'Check-in request sent to your Coordinator!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        checkinBtn.disabled = false;
        checkinBtn.textContent = "📍 I'm At My Stall — Check In";
      }
    });
  }

  // View badge shortcut
  const shortcutBtn = container.querySelector('#btn-view-my-badge-shortcut');
  if (shortcutBtn) {
    shortcutBtn.addEventListener('click', () => {
      state.setTab('member-badge');
    });
  }

  // Render inline badge QR
  const inlineQr = container.querySelector('#member-inline-qr');
  if (inlineQr) {
    inlineQr.addEventListener('click', () => {
      showQRModal(user);
    });
    // Populate simple SVG
    inlineQr.innerHTML = `
      <svg width="150" height="150" viewBox="0 0 150 150" style="background:#fff;">
        <rect width="150" height="150" fill="#ffffff" />
        <rect x="10" y="10" width="40" height="40" fill="#0f172a" />
        <rect x="18" y="18" width="24" height="24" fill="#ffffff" />
        <rect x="24" y="24" width="12" height="12" fill="#0f172a" />

        <rect x="100" y="10" width="40" height="40" fill="#0f172a" />
        <rect x="108" y="18" width="24" height="24" fill="#ffffff" />
        <rect x="114" y="24" width="12" height="12" fill="#0f172a" />

        <rect x="10" y="100" width="40" height="40" fill="#0f172a" />
        <rect x="18" y="108" width="24" height="24" fill="#ffffff" />
        <rect x="24" y="114" width="12" height="12" fill="#0f172a" />

        <rect x="60" y="20" width="10" height="20" fill="#0f172a" />
        <rect x="75" y="15" width="15" height="15" fill="#0f172a" />
        <rect x="60" y="60" width="30" height="30" fill="#0f172a" />
        <rect x="100" y="70" width="30" height="15" fill="#0f172a" />
        <rect x="60" y="110" width="25" height="25" fill="#0f172a" />
        <rect x="100" y="100" width="40" height="40" fill="#0f172a" />
      </svg>
    `;
  }
}
