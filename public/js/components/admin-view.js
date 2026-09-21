/**
 * Admin View Component - Event Command Center & Operations
 */

import api from '../api.js';
import state from '../state.js';

export function renderAdminView(container, state) {
  const summary = state.eventSummary || {};
  const stalls = state.stalls || [];
  const pendingSales = state.pendingSales || [];
  const activeTab = state.activeTab || 'command-center';

  container.innerHTML = `
    <!-- Segmented Navigation for Admin -->
    <div class="tab-navigation">
      <button class="tab-btn admin ${activeTab === 'command-center' ? 'active' : ''}" data-tab="command-center">
        <span>⚡ Command Center</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'verification-queue' ? 'active' : ''}" data-tab="verification-queue">
        <span>📝 Sales Verification</span>
        ${pendingSales.length > 0 ? `<span class="tab-badge" style="background:var(--status-danger);color:white;">${pendingSales.length}</span>` : ''}
      </button>
      <button class="tab-btn admin ${activeTab === 'stall-operations' ? 'active' : ''}" data-tab="stall-operations">
        <span>🏪 Stall Operations</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'broadcast-center' ? 'active' : ''}" data-tab="broadcast-center">
        <span>📢 Broadcasts</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'audit-log' ? 'active' : ''}" data-tab="audit-log">
        <span>📜 Audit Ledger</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
        <span>🏆 Event Leaderboard</span>
      </button>
    </div>

    <!-- Active Tab Content -->
    <div id="admin-tab-content">
      ${renderAdminTab(activeTab, summary, stalls, pendingSales, state)}
    </div>
  `;

  // Attach tab switch listeners
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      state.setTab(tab);
    });
  });

  // Attach actions for sub-views
  attachAdminEventListeners(container, state);
}

function renderAdminTab(tab, summary, stalls, pendingSales, state) {
  if (tab === 'command-center') {
    return `
      <!-- KPI Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card accent-indigo">
          <div class="stat-header">
            <span class="stat-label">Total Verified Gross Sales</span>
            <span class="stat-icon">💰</span>
          </div>
          <div class="stat-value mono-num">${summary.total_gross_sales_formatted || '₹0'}</div>
          <div class="stat-subtext">
            <span>Online: <strong>${summary.total_online_sales_formatted || '₹0'}</strong></span> • 
            <span>Offline: <strong>${summary.total_offline_sales_formatted || '₹0'}</strong></span>
          </div>
        </div>

        <div class="stat-card accent-amber">
          <div class="stat-header">
            <span class="stat-label">Pending Verification</span>
            <span class="stat-icon">⏳</span>
          </div>
          <div class="stat-value mono-num">${summary.pending_submissions_total_formatted || '₹0'}</div>
          <div class="stat-subtext">
            <strong>${summary.pending_submissions_count || 0}</strong> logs awaiting Admin approval
          </div>
        </div>

        <div class="stat-card accent-green">
          <div class="stat-header">
            <span class="stat-label">Break-Even Clearance</span>
            <span class="stat-icon">📈</span>
          </div>
          <div class="stat-value mono-num">${summary.break_even_rate || 0}%</div>
          <div class="stat-subtext">
            <strong>${summary.break_even_stalls_count || 0} of ${summary.total_stalls || 0}</strong> stalls in profit
          </div>
        </div>

        <div class="stat-card accent-rose">
          <div class="stat-header">
            <span class="stat-label">Event Attendance</span>
            <span class="stat-icon">👥</span>
          </div>
          <div class="stat-value mono-num">${summary.attendance ? summary.attendance.rate : 0}%</div>
          <div class="stat-subtext">
            <strong>${summary.attendance ? summary.attendance.confirmed : 0} of ${summary.attendance ? summary.attendance.total_members : 0}</strong> members confirmed present
          </div>
        </div>
      </div>

      <!-- Quick Action Alert if pending verification exists -->
      ${pendingSales.length > 0 ? `
        <div style="background:var(--status-warning-bg); border:1px solid var(--status-warning); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:24px;">🔔</span>
            <div>
              <div style="font-weight:700; color:var(--status-warning-text);">Action Required: ${pendingSales.length} Sales Logs Awaiting Verification</div>
              <div style="font-size:13px; color:var(--text-secondary);">Unverified sales will NOT reflect in leaderboard or gross earnings until you review them.</div>
            </div>
          </div>
          <button class="btn btn-admin" id="go-verify-btn">Review Queue →</button>
        </div>
      ` : ''}

      <!-- Stalls Performance Grid -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Stall Operations & Financial Status</div>
            <div class="section-desc">Live financial ledger and recovery progress across all Building Pravara stalls</div>
          </div>
          <button class="btn btn-outline" id="btn-add-stall-modal">+ Register New Stall</button>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Stall Name & Category</th>
                <th>Coordinator</th>
                <th>Verified Gross</th>
                <th>Expenses</th>
                <th>Net Profit</th>
                <th>Break-even %</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${stalls.map(s => {
                const fin = s.financials || {};
                const isProfitable = fin.is_profitable;
                const statusBadgeClass = s.status === 'active' ? 'badge-active' : 'badge-discontinued';
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;">${s.name}</div>
                      <div style="font-size:11px; color:var(--text-tertiary);">${s.category} • ${s.location}</div>
                    </td>
                    <td>
                      <div>${s.coordinator ? s.coordinator.name : 'Unassigned'}</div>
                      <div style="font-size:11px; color:var(--text-tertiary);">${s.coordinator ? s.coordinator.phone : ''}</div>
                    </td>
                    <td class="mono-num" style="font-weight:700;">${fin.gross_sales_formatted || '₹0'}</td>
                    <td class="mono-num">${fin.total_expenses_formatted || '₹0'}</td>
                    <td class="mono-num" style="font-weight:700; color:${isProfitable ? 'var(--status-success)' : 'var(--status-danger)'};">
                      ${fin.net_profit_formatted || '₹0'}
                    </td>
                    <td>
                      <div style="font-size:12px; font-weight:700; margin-bottom:2px;">${fin.recovered_percent_display || 'N/A'}</div>
                      <div class="progress-track" style="width:100px; height:6px;">
                        <div class="progress-fill ${fin.is_break_even ? 'success' : 'warning'}" style="width:${fin.recovered_percent || 0}%;"></div>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${s.attendance_rate >= 80 ? 'badge-verified' : 'badge-pending'}">
                        ${s.attendance_confirmed_count}/${s.members_count} (${s.attendance_rate}%)
                      </span>
                    </td>
                    <td>
                      <span class="badge ${statusBadgeClass}">${s.status.toUpperCase()}</span>
                      ${s.last_warning ? `<div style="font-size:10px; color:var(--status-warning-text); margin-top:2px;">⚠️ Warning: ${s.last_warning}</div>` : ''}
                    </td>
                    <td>
                      <button class="btn btn-outline btn-manage-stall" data-stall-id="${s.id}" style="padding:4px 8px; font-size:12px;">Manage</button>
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

  if (tab === 'verification-queue') {
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Sales Verification Queue</div>
            <div class="section-desc">Audit and verify daily sales submissions. Verified amounts are immediately locked into official gross earnings.</div>
          </div>
          <span class="badge badge-pending">${pendingSales.length} Pending Submissions</span>
        </div>

        ${pendingSales.length === 0 ? `
          <div style="text-align:center; padding:48px 20px; color:var(--text-tertiary);">
            <div style="font-size:40px; margin-bottom:12px;">✅</div>
            <div style="font-size:16px; font-weight:700; color:var(--text-primary);">All Submissions Verified</div>
            <div style="font-size:13px; margin-top:4px;">No pending sales logs awaiting Admin approval right now.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${pendingSales.map(sub => `
              <div style="border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:20px; background:var(--bg-surface-subtle);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                  <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <h3 style="font-size:18px;">${sub.stall_name}</h3>
                      <span class="badge badge-pending">PENDING VERIFICATION</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-tertiary); margin-top:2px;">
                      Submitted by <strong>${sub.submitted_by_name}</strong> • ${new Date(sub.submitted_at).toLocaleString()} • Idempotency Key: <code style="font-family:var(--font-mono);">${sub.idempotency_key}</code>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div class="mono-num" style="font-size:24px; font-weight:800; color:var(--text-primary);">
                      ₹${(sub.total_amount || 0).toLocaleString('en-IN')}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary);">
                      Online: <strong>₹${(sub.online_total || 0).toLocaleString('en-IN')}</strong> | Offline: <strong>₹${(sub.offline_total || 0).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                <!-- Line Item Details -->
                <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px; margin-bottom:16px;">
                  <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:8px;">Itemized Breakdown (${(sub.items || []).length} items)</div>
                  <table style="width:100%; font-size:13px; border-collapse:collapse;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--border-subtle); text-align:left; font-size:11px; color:var(--text-tertiary);">
                        <th style="padding:4px 0;">Item Name</th>
                        <th style="padding:4px 8px; text-align:center;">Qty</th>
                        <th style="padding:4px 8px; text-align:right;">Unit Price</th>
                        <th style="padding:4px 8px; text-align:center;">Mode</th>
                        <th style="padding:4px 0; text-align:right;">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(sub.items || []).map(it => `
                        <tr style="border-bottom:1px solid var(--border-subtle);">
                          <td style="padding:6px 0; font-weight:600;">${it.item_name}</td>
                          <td style="padding:6px 8px; text-align:center;">${it.qty}</td>
                          <td style="padding:6px 8px; text-align:right;" class="mono-num">₹${it.unit_price}</td>
                          <td style="padding:6px 8px; text-align:center;">
                            <span class="badge ${it.payment_mode === 'offline' ? 'badge-pending' : 'badge-verified'}">
                              ${it.payment_mode.toUpperCase()}
                            </span>
                          </td>
                          <td style="padding:6px 0; text-align:right; font-weight:700;" class="mono-num">₹${(it.qty * it.unit_price).toLocaleString('en-IN')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                  ${sub.notes ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:8px;">📝 Notes: <em>${sub.notes}</em></div>` : ''}
                </div>

                <!-- Admin Action Buttons -->
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                  <button class="btn btn-outline btn-reject-sale" data-sub-id="${sub.id}" style="color:var(--status-danger); border-color:var(--status-danger);">
                    ✕ Reject Log
                  </button>
                  <button class="btn btn-admin btn-verify-sale" data-sub-id="${sub.id}">
                    ✓ Verify & Add to Official Ledger
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  if (tab === 'stall-operations') {
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Stall Governance & Intervention</div>
            <div class="section-desc">Issue operational warnings, adjust stall statuses, or register new booths.</div>
          </div>
          <button class="btn btn-admin" id="btn-add-stall-modal-2">+ Register New Stall</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${stalls.map(s => `
            <div style="border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:16px; background:var(--bg-surface);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                  <h4 style="font-size:16px;">${s.name}</h4>
                  <div style="font-size:12px; color:var(--text-tertiary);">${s.category} • ${s.location}</div>
                </div>
                <span class="badge ${s.status === 'active' ? 'badge-active' : 'badge-discontinued'}">${s.status}</span>
              </div>
              <div style="font-size:12px; margin-bottom:12px;">
                Coordinator: <strong>${s.coordinator ? s.coordinator.name : 'None'}</strong> (${s.coordinator ? s.coordinator.phone : ''})
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-outline btn-warn-stall" data-stall-id="${s.id}" data-stall-name="${s.name}" style="flex:1; font-size:12px;">
                  ⚠️ Issue Warning
                </button>
                <button class="btn btn-outline btn-toggle-status" data-stall-id="${s.id}" data-current-status="${s.status}" style="flex:1; font-size:12px; color:${s.status === 'active' ? 'var(--status-danger)' : 'var(--status-success)'};">
                  ${s.status === 'active' ? 'Discontinue' : 'Reactivate'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (tab === 'broadcast-center') {
    return `
      <div class="section-card" style="max-width:700px;">
        <div class="section-header">
          <div>
            <div class="section-title">Event Operations Broadcast Center</div>
            <div class="section-desc">Broadcast high-priority announcements and notices to all Coordinators & Members</div>
          </div>
        </div>

        <form id="broadcast-form" style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Target Audience</label>
            <select id="broadcast-target" class="pos-input" style="width:100%;">
              <option value="all">Everyone (Event-wide: All Coordinators & Members)</option>
              <option value="coordinator">Stall Coordinators Only</option>
              <option value="member">Stall Members Only</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Announcement Title</label>
            <input type="text" id="broadcast-title" class="pos-input" placeholder="e.g. VIP Guest Arrival / Day 1 Sales Closing in 30 mins" required />
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Broadcast Message</label>
            <textarea id="broadcast-msg" class="pos-input" rows="4" placeholder="Type your event announcement here..." required></textarea>
          </div>

          <button type="submit" class="btn btn-admin" style="padding:12px;">
            📢 Send Instant Live Broadcast
          </button>
        </form>
      </div>
    `;
  }

  if (tab === 'audit-log') {
    const logs = state.auditLogs || [];
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Immutable Event Audit Ledger</div>
            <div class="section-desc">Every sales verification, attendance confirmation, and admin intervention is permanently recorded.</div>
          </div>
          <button class="btn btn-outline" id="btn-reset-demo" style="font-size:12px; color:var(--status-danger);">↺ Reset Demo Seed</button>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td class="mono-num" style="font-size:11px; white-space:nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td style="font-weight:600;">${log.actor_name}</td>
                  <td>
                    <span class="badge ${log.action.includes('VERIFIED') || log.action.includes('CONFIRMED') ? 'badge-verified' : 'badge-pending'}">
                      ${log.action}
                    </span>
                  </td>
                  <td style="font-size:12px; color:var(--text-tertiary);">${log.target_type}</td>
                  <td style="font-size:12px;">${log.details}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === 'leaderboard') {
    const leaderboard = (summary.leaderboard || []);
    return `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Official Event Leaderboard</div>
            <div class="section-desc">Ranked purely by Admin-verified gross sales. Updates live on every verification.</div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:60px;">Rank</th>
                <th>Stall Name & Category</th>
                <th>Verified Gross Sales</th>
                <th>Expenses</th>
                <th>Net Profit</th>
                <th>Break-even Status</th>
              </tr>
            </thead>
            <tbody>
              ${leaderboard.map(item => `
                <tr style="${item.rank <= 3 ? 'background:var(--bg-surface-subtle); font-weight:600;' : ''}">
                  <td style="font-size:18px; text-align:center;">
                    ${item.medal || item.rank}
                  </td>
                  <td>
                    <div style="font-size:15px; font-weight:700;">${item.stall_name}</div>
                    <div style="font-size:11px; color:var(--text-tertiary);">${item.category}</div>
                  </td>
                  <td class="mono-num" style="font-size:16px; font-weight:800; color:var(--text-primary);">
                    ${item.gross_sales_formatted}
                  </td>
                  <td class="mono-num">${item.total_expenses_formatted}</td>
                  <td class="mono-num" style="color:${item.is_profitable ? 'var(--status-success)' : 'var(--status-danger)'}; font-weight:700;">
                    ${item.net_profit_formatted}
                  </td>
                  <td>
                    <span class="badge ${item.is_break_even ? 'badge-verified' : 'badge-pending'}">
                      ${item.is_break_even ? 'CLEARED' : `${item.recovered_percent || 0}% RECOVERED`}
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

function attachAdminEventListeners(container, state) {
  // Go to verification queue shortcut
  const goVerifyBtn = container.querySelector('#go-verify-btn');
  if (goVerifyBtn) {
    goVerifyBtn.addEventListener('click', () => state.setTab('verification-queue'));
  }

  // Verify Sale Buttons
  container.querySelectorAll('.btn-verify-sale').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subId = btn.getAttribute('data-sub-id');
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      try {
        await api.verifySale(subId);
        window.showToast('Sale verified & added to official ledger!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Verify';
      }
    });
  });

  // Reject Sale Buttons
  container.querySelectorAll('.btn-reject-sale').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subId = btn.getAttribute('data-sub-id');
      const reason = prompt('Enter reason for rejecting this sales submission:');
      if (!reason) return;

      btn.disabled = true;
      try {
        await api.rejectSale(subId, reason);
        window.showToast('Sales submission rejected.', 'warning');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Broadcast Form
  const broadcastForm = container.querySelector('#broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetRole = container.querySelector('#broadcast-target').value;
      const title = container.querySelector('#broadcast-title').value;
      const message = container.querySelector('#broadcast-msg').value;

      try {
        await api.broadcastAnnouncement(title, message, targetRole);
        window.showToast('Announcement broadcasted event-wide!', 'success');
        broadcastForm.reset();
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }

  // Warning Button
  container.querySelectorAll('.btn-warn-stall').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stallId = btn.getAttribute('data-stall-id');
      const stallName = btn.getAttribute('data-stall-name');
      const reason = prompt(`Enter warning notice for ${stallName}:`);
      if (!reason) return;

      try {
        await api.updateStallStatus(stallId, { status: 'active', warning_reason: reason });
        window.showToast(`Warning issued to ${stallName}`, 'warning');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  });

  // Toggle Stall Status (Active / Discontinued)
  container.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stallId = btn.getAttribute('data-stall-id');
      const current = btn.getAttribute('data-current-status');
      const newStatus = current === 'active' ? 'discontinued' : 'active';
      
      if (!confirm(`Are you sure you want to mark this stall as ${newStatus.toUpperCase()}?`)) return;

      try {
        await api.updateStallStatus(stallId, { status: newStatus });
        window.showToast(`Stall status updated to ${newStatus}`, 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  });

  // Reset Demo Seed Button
  const resetBtn = container.querySelector('#btn-reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset entire event database back to initial seed data?')) return;
      try {
        await api.resetDemo();
        window.showToast('Database reset to fresh demo seed', 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }

  // Add Stall Modal Trigger
  const addStallBtn = container.querySelector('#btn-add-stall-modal') || container.querySelector('#btn-add-stall-modal-2');
  if (addStallBtn) {
    addStallBtn.addEventListener('click', () => {
      showAddStallModal(state);
    });
  }
}

function showAddStallModal(state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-stall-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size:18px;">Register New Stall</h3>
          <button class="modal-close-btn" id="close-stall-modal">✕</button>
        </div>

        <form id="new-stall-form" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="font-size:12px; font-weight:700;">Stall Name</label>
            <input type="text" id="stall-name-input" class="pos-input" placeholder="e.g. Drone Racing Zone" required />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Category</label>
            <select id="stall-cat-input" class="pos-input" style="width:100%;">
              <option value="Tech & Gaming">Tech & Gaming</option>
              <option value="Electronics & DIY">Electronics & DIY</option>
              <option value="Robotics">Robotics</option>
              <option value="Rural Tech">Rural Tech</option>
              <option value="Food & Beverage">Food & Beverage</option>
              <option value="Art & Crafts">Art & Crafts</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Stall Location / Booth #</label>
            <input type="text" id="stall-loc-input" class="pos-input" placeholder="e.g. Hall B - Booth 08" required />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Coordinator Name</label>
            <input type="text" id="coord-name-input" class="pos-input" placeholder="e.g. Prathamesh Kulkarni" required />
          </div>

          <div>
            <label style="font-size:12px; font-weight:700;">Coordinator Phone Number</label>
            <input type="text" id="coord-phone-input" class="pos-input" placeholder="+91 98XXX XXXXX" required />
          </div>

          <button type="submit" class="btn btn-admin" style="padding:12px; margin-top:8px;">
            Create Stall & Issue Credentials
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-stall-modal').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('new-stall-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stall-name-input').value;
    const category = document.getElementById('stall-cat-input').value;
    const location = document.getElementById('stall-loc-input').value;
    const coordinator_name = document.getElementById('coord-name-input').value;
    const coordinator_phone = document.getElementById('coord-phone-input').value;

    try {
      await api.createStall({
        name,
        category,
        location,
        coordinator_name,
        coordinator_phone
      });
      window.showToast(`Stall "${name}" created successfully!`, 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  });
}
