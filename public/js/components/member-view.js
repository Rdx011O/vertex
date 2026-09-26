/**
 * Stall Member View Component - Business Literacy, QR Badge, Arrival Check-in
 */

import api from '../api.js';
import state from '../state.js';
import { generateVertexBadgeHTML, initBadgeInteractivity, showQRModal } from './qr-modal.js';

export function renderMemberView(container, state) {
  const stall = state.activeStall || {};
  const fin = stall.financials || {};
  const user = state.currentUser || {};
  // Guard: reset to default if stored tab belongs to another role
  const MEMBER_TABS = ['member-dashboard','member-badge','member-leaderboard','member-audit'];
  const activeTab = MEMBER_TABS.includes(state.activeTab) ? state.activeTab : 'member-dashboard';

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
      <button class="tab-btn member ${activeTab === 'member-audit' ? 'active' : ''}" data-tab="member-audit">
        <span>📜 My Activity Log</span>
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
    const activeTheme = localStorage.getItem('vertex_badge_theme') || 'theme-cobalt';

    const dynamicBadgeHTML = generateVertexBadgeHTML(user, {
      badge_code: user.badge_code,
      qr_image_url: user.qr_image_url,
      stall: stall
    }, { isModal: false, showLanyard: true });

    return `
      <!-- Top Dynamic Badge Hero Grid -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        
        <!-- Attendance Status Alert Card -->
        <div class="section-card" style="margin-bottom:0; background:var(--bg-surface);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:16px; color:var(--text-primary);">Arrival Check-In Status:</span>
                <span class="badge ${isConfirmed ? 'badge-verified' : (isPending ? 'badge-pending' : 'badge-pending')}" style="font-size:12px; padding:4px 10px;">
                  ${isConfirmed ? '✓ CONFIRMED PRESENT' : (isPending ? '⏳ APPROVAL PENDING' : '📍 NOT CHECKED IN')}
                </span>
              </div>
              <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
                ${isConfirmed 
                  ? `Confirmed present at <strong>${new Date(myAttendance.timestamp).toLocaleTimeString()}</strong> (${myAttendance.verified_method || 'QR Scanner'}).` 
                  : (isPending 
                    ? 'Check-in request sent to your Stall Coordinator. Awaiting confirmation.' 
                    : 'Report your arrival at your assigned booth or present your QR badge to your Coordinator.')}
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${!isConfirmed && !isPending ? `
                <button class="btn btn-member" id="btn-tap-checkin" style="font-size:13px; padding:8px 18px; font-weight:700;">
                  📍 I'm At My Stall — Check In
                </button>
              ` : ''}
              <button class="btn btn-outline" id="btn-enlarge-badge-modal" style="font-size:13px; padding:8px 18px;">
                🪪 Open Fullscreen Pass
              </button>
            </div>
          </div>
        </div>

        <!-- 3D Dynamic E-Badge Showcase -->
        <div style="background:radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.05) 70%, transparent 100%); padding:32px 16px; border-radius:var(--radius-xl); border:1px solid var(--border-subtle); display:flex; flex-direction:column; align-items:center;">
          
          <!-- Badge Subheader Instructions -->
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; max-width:780px; margin-bottom:16px; padding:0 8px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:#4f46e5; color:white; font-size:11px; font-weight:800; padding:4px 10px;">
                ⚡ DYNAMIC PASS
              </span>
              <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">
                Move cursor to 3D tilt • Tap QR to zoom • Flip for back
              </span>
            </div>
            <div class="ebadge-theme-selector" style="margin:0;">
              <span style="font-size:11px; font-weight:700; color:var(--text-secondary); margin-right:4px;">THEME:</span>
              <button class="theme-swatch-btn cyber ${activeTheme === 'theme-cyber' ? 'active' : ''}" data-theme="theme-cyber" title="Cyber Dark VIP"></button>
              <button class="theme-swatch-btn holo ${activeTheme === 'theme-holo' ? 'active' : ''}" data-theme="theme-holo" title="Prism Holo"></button>
              <button class="theme-swatch-btn gold ${activeTheme === 'theme-gold' ? 'active' : ''}" data-theme="theme-gold" title="Solar Gold"></button>
              <button class="theme-swatch-btn cobalt ${activeTheme === 'theme-cobalt' ? 'active' : ''}" data-theme="theme-cobalt" title="PREC Cobalt"></button>
            </div>
          </div>

          <!-- Dynamic Vertex E-Badge Render -->
          <div id="member-dynamic-badge-holder" style="width:100%; max-width:780px;">
            ${dynamicBadgeHTML}
          </div>

          <!-- Interactive Control Toolbar -->
          <div style="display:flex; justify-content:center; gap:10px; margin-top:20px; flex-wrap:wrap;">
            <button class="btn btn-outline" id="btn-flip-badge" style="font-size:13px; font-weight:700; padding:8px 18px; border-radius:10px; background:var(--bg-surface);">
              🔄 Flip Badge (Back View)
            </button>
            <button class="btn btn-outline" id="btn-toggle-lanyard" style="font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; background:var(--bg-surface);">
              🎗️ Toggle Lanyard Strap
            </button>
            <button class="btn btn-outline" id="btn-print-badge" style="font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; background:var(--bg-surface);">
              🖨️ Print VIP Pass
            </button>
            <button class="btn btn-outline" id="btn-copy-badge-id" style="font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; background:var(--bg-surface);">
              📋 Copy Pass ID
            </button>
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

  if (tab === 'member-audit') {
    const logs = (state.auditLogs || []);
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">My Personal Event Activity Log</div>
            <div class="section-desc">Level-1 verified log of your arrival check-ins, badge verifications, and stall contributions.</div>
          </div>
          <span class="badge badge-verified">${logs.length} Actions</span>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Activity Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td class="mono-num" style="font-size:11px; white-space:nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <span class="badge ${log.action.includes('CONFIRMED') || log.action.includes('JOINED') ? 'badge-verified' : 'badge-pending'}">
                      ${log.action}
                    </span>
                  </td>
                  <td style="font-size:13px;">${log.details}</td>
                </tr>
              `).join('')}
              ${logs.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--text-tertiary);">No personal activity recorded yet. Check in or contribute to see logs here!</td></tr>' : ''}
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

  // Fullscreen pass modal trigger
  const enlargeBtn = container.querySelector('#btn-enlarge-badge-modal');
  if (enlargeBtn) {
    enlargeBtn.addEventListener('click', () => {
      showQRModal(user);
    });
  }

  // Bind Dynamic 3D Badge Interactivity
  const badgeHolder = container.querySelector('#member-dynamic-badge-holder');
  if (badgeHolder) {
    initBadgeInteractivity(container, user, {
      badge_code: user.badge_code,
      qr_image_url: user.qr_image_url,
      stall: state.activeStall
    });

    // Ensure latest QR code from server is displayed
    api.getQRBadge(user.id).then(badge => {
      if (badge && badge.qr_image_url) {
        const qrImg = container.querySelector('#ebadge-qr-image-elem');
        if (qrImg) qrImg.src = badge.qr_image_url;
      }
    }).catch(err => console.warn('Badge fetch error:', err));
  }
}
