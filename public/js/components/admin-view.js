/**
 * Admin View Component - Event Command Center, Stall CRUD, Intervention & Governance
 */

import api from '../api.js';
import state from '../state.js';

let stallSearchQuery = '';
let auditCategoryFilter = 'all';
let auditSearchQuery = '';

export function renderAdminView(container, state) {
  const summary = state.eventSummary || {};
  const stalls = state.stalls || [];
  const pendingSales = state.pendingSales || [];

  // Guard: reset to default if stored tab belongs to another role
  const ADMIN_TABS = ['command-center','verification-queue','user-management','stall-operations','broadcast-center','audit-log','leaderboard'];
  const activeTab = ADMIN_TABS.includes(state.activeTab) ? state.activeTab : 'command-center';

  container.innerHTML = `
    <!-- Segmented Navigation for Admin -->
    <div class="tab-navigation">
      <button class="tab-btn admin ${activeTab === 'command-center' ? 'active' : ''}" data-tab="command-center">
        <span><i data-lucide="layout-dashboard"></i> Command Center</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'verification-queue' ? 'active' : ''}" data-tab="verification-queue">
        <span><i data-lucide="check-check"></i> Sales Verification</span>
        ${pendingSales.length > 0 ? `<span class="tab-badge" style="background:var(--status-danger);color:white;">${pendingSales.length}</span>` : ''}
      </button>
      <button class="tab-btn admin ${activeTab === 'user-management' ? 'active' : ''}" data-tab="user-management">
        <span><i data-lucide="users"></i> User Management</span>
        ${(state.allUsers || []).filter(u => u.role && u.role.startsWith('pending')).length > 0 ? `<span class="tab-badge" style="background:var(--status-warning);color:white;">${(state.allUsers || []).filter(u => u.role && u.role.startsWith('pending')).length} pending</span>` : ''}
      </button>
      <button class="tab-btn admin ${activeTab === 'stall-operations' ? 'active' : ''}" data-tab="stall-operations">
        <span><i data-lucide="store"></i> Stall Operations</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'broadcast-center' ? 'active' : ''}" data-tab="broadcast-center">
        <span><i data-lucide="megaphone"></i> Broadcasts</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'audit-log' ? 'active' : ''}" data-tab="audit-log">
        <span><i data-lucide="history"></i> Audit Ledger</span>
      </button>
      <button class="tab-btn admin ${activeTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
        <span><i data-lucide="trophy"></i> Event Leaderboard</span>
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
  window.renderIcons?.();
}

function filterStalls(stalls, query) {
  if (!query || !query.trim()) return stalls;
  const q = query.toLowerCase().trim();
  return stalls.filter(s =>
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.category && s.category.toLowerCase().includes(q)) ||
    (s.location && s.location.toLowerCase().includes(q)) ||
    (s.allotted_number && s.allotted_number.toLowerCase().includes(q)) ||
    (s.status && s.status.toLowerCase().includes(q)) ||
    (s.coordinator && s.coordinator.name && s.coordinator.name.toLowerCase().includes(q)) ||
    (s.coordinator && s.coordinator.phone && s.coordinator.phone.includes(q))
  );
}

function renderAdminTab(tab, summary, stalls, pendingSales, state) {
  const filteredStalls = filterStalls(stalls, stallSearchQuery);

  if (tab === 'command-center') {
    return `
      <!-- KPI Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card accent-indigo">
          <div class="stat-header">
            <span class="stat-label">Total Verified Gross Sales</span>
            <span class="stat-icon"><i data-lucide="credit-card"></i></span>
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
            <span class="stat-icon"><i data-lucide="clock"></i></span>
          </div>
          <div class="stat-value mono-num">${summary.pending_submissions_total_formatted || '₹0'}</div>
          <div class="stat-subtext">
            <strong>${summary.pending_submissions_count || 0}</strong> logs awaiting Admin approval
          </div>
        </div>

        <div class="stat-card accent-green">
          <div class="stat-header">
            <span class="stat-label">Break-Even Clearance</span>
            <span class="stat-icon"><i data-lucide="trending-up"></i></span>
          </div>
          <div class="stat-value mono-num">${summary.break_even_rate || 0}%</div>
          <div class="stat-subtext">
            <strong>${summary.break_even_stalls_count || 0} of ${summary.total_stalls || 0}</strong> stalls in profit
          </div>
        </div>

        <div class="stat-card accent-rose">
          <div class="stat-header">
            <span class="stat-label">Event Attendance</span>
            <span class="stat-icon"><i data-lucide="users"></i></span>
          </div>
          <div class="stat-value mono-num">${summary.attendance ? summary.attendance.rate : 0}%</div>
          <div class="stat-subtext">
            <strong>${summary.attendance ? summary.attendance.confirmed : 0} of ${summary.attendance ? summary.attendance.total_members : 0}</strong> members confirmed present
          </div>
        </div>
      </div>

      <!-- Quick Action Alert if pending verification exists -->
      ${pendingSales.length > 0 ? `
        <div style="background:var(--status-warning-bg); border:1px solid var(--status-warning); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:24px; color:var(--status-warning);"><i data-lucide="bell"></i></span>
            <div>
              <div style="font-weight:700; color:var(--status-warning-text);">Action Required: ${pendingSales.length} Sales Logs Awaiting Verification</div>
              <div style="font-size:13px; color:var(--text-secondary);">Unverified sales will NOT reflect in leaderboard or gross earnings until you review them.</div>
            </div>
          </div>
          <button class="btn btn-admin" id="go-verify-btn">Review Queue →</button>
        </div>
      ` : ''}

      <!-- Stalls Performance Grid with Search -->
      <div class="section-card">
        <div class="section-header" style="flex-wrap:wrap; gap:14px;">
          <div>
            <div class="section-title">Stall Operations & Financial Status</div>
            <div class="section-desc">Live financial ledger and recovery progress across all Building Pravara stalls</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="position:relative;">
              <input type="text" id="stall-search-input-cc" class="pos-input" value="${stallSearchQuery}" placeholder="Search stalls by name, category, location..." style="width:280px; padding:7px 12px; font-size:13px;" />
            </div>
            <button class="btn btn-admin" id="btn-add-stall-modal"><i data-lucide="plus-circle"></i> Register New Stall</button>
          </div>
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
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStalls.map(s => {
                const fin = s.financials || {};
                const isProfitable = fin.is_profitable;
                const statusBadgeClass = s.status === 'active' ? 'badge-active' : (s.status === 'warning' ? 'badge-pending' : 'badge-discontinued');
                return `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; border-radius:50%; background:${s.banner_color || 'var(--primary)'}; display:inline-block;"></span>
                        <div style="font-weight:700;">${s.name}</div>
                        ${s.is_flagged ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:var(--status-danger); font-size:10px;">🚩 FLAGGED</span>` : ''}
                      </div>
                      <div style="font-size:11px; color:var(--text-tertiary); margin-left:18px;">${s.category} • ${s.location || 'Courtyard'} ${s.allotted_number ? `• #${s.allotted_number}` : ''}</div>
                    </td>
                    <td>
                      <div>${s.coordinator ? s.coordinator.name : 'Unassigned'}</div>
                      <div style="font-size:11px; color:var(--text-tertiary);">${s.coordinator ? s.coordinator.phone || '' : ''}</div>
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
                        ${s.attendance_confirmed_count || 0}/${s.members_count || 0} (${s.attendance_rate || 0}%)
                      </span>
                    </td>
                    <td>
                      <span class="badge ${statusBadgeClass}">${(s.status || 'active').toUpperCase()}</span>
                      ${s.last_warning ? `<div style="font-size:10px; color:var(--status-warning-text); margin-top:2px;">⚠️ ${s.last_warning}</div>` : ''}
                      ${s.is_flagged && s.flag_reason ? `<div style="font-size:10px; color:var(--status-danger); margin-top:2px;">🚩 ${s.flag_reason}</div>` : ''}
                    </td>
                    <td style="text-align:center;">
                      <div style="display:flex; justify-content:center; gap:6px;">
                        <button class="btn btn-outline btn-manage-stall" data-stall-id="${s.id}" style="padding:4px 10px; font-size:12px; font-weight:700;">
                          <i data-lucide="settings"></i> Manage
                        </button>
                        <button class="btn btn-outline btn-edit-stall" data-stall-id="${s.id}" style="padding:4px 8px; font-size:12px;" title="Edit Stall Details">
                          <i data-lucide="edit-3"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
              ${filteredStalls.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align:center; padding:36px; color:var(--text-tertiary);">
                    No stalls matching "${stallSearchQuery || ''}".
                  </td>
                </tr>
              ` : ''}
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
            <div style="margin-bottom:12px; color:var(--status-success);"><i data-lucide="check-circle-2" style="width:44px; height:44px;"></i></div>
            <div style="font-size:16px; font-weight:700; color:var(--text-primary);">All Submissions Verified</div>
            <div style="font-size:13px; margin-top:4px;">No pending sales logs awaiting Admin approval right now.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${pendingSales.map(sub => `
              <div style="border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:20px; background:var(--bg-surface-subtle);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
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
                              ${(it.payment_mode || 'online').toUpperCase()}
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
        <div class="section-header" style="flex-wrap:wrap; gap:14px;">
          <div>
            <div class="section-title">Stall Governance & Intervention</div>
            <div class="section-desc">Issue operational warnings, adjust stall details, flag violations, or register new booths.</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; width:100%; max-width:480px;">
            <input type="text" id="stall-search-input-ops" class="pos-input" value="${stallSearchQuery}" placeholder="🔍 Search stalls..." style="flex:1 1 180px; min-width:140px; padding:7px 12px; font-size:13px;" />
            <button class="btn btn-admin" id="btn-add-stall-modal-2" style="white-space:nowrap;">+ Register New Stall</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap:16px;">
          ${filteredStalls.map(s => {
            const isFlagged = !!s.is_flagged;
            return `
              <div style="border:1px solid ${isFlagged ? 'var(--status-danger)' : 'var(--border-medium)'}; border-radius:var(--radius-md); padding:18px; background:var(--bg-surface); position:relative; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                  <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="width:12px; height:12px; border-radius:50%; background:${s.banner_color || 'var(--primary)'}; display:inline-block;"></span>
                      <h4 style="font-size:16px; margin:0;">${s.name}</h4>
                    </div>
                    <div style="font-size:12px; color:var(--text-tertiary); margin-top:2px; margin-left:18px;">${s.category} • ${s.location || 'Courtyard'} ${s.allotted_number ? `(#${s.allotted_number})` : ''}</div>
                  </div>
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <span class="badge ${s.status === 'active' ? 'badge-active' : (s.status === 'warning' ? 'badge-pending' : 'badge-discontinued')}">${(s.status || 'active').toUpperCase()}</span>
                    ${isFlagged ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:var(--status-danger); font-size:10px;">🚩 FLAGGED</span>` : ''}
                  </div>
                </div>

                <div style="font-size:12px; margin-bottom:10px; background:var(--bg-surface-subtle); padding:8px 10px; border-radius:var(--radius-sm);">
                  <div>Coordinator: <strong>${s.coordinator ? s.coordinator.name : 'Unassigned'}</strong> ${s.coordinator && s.coordinator.phone ? `(${s.coordinator.phone})` : ''}</div>
                  <div style="color:var(--text-tertiary); margin-top:2px;">Invite Code: <code style="font-family:var(--font-mono); font-weight:700; color:var(--primary);">${s.invite_code || 'N/A'}</code></div>
                </div>

                ${s.last_warning ? `
                  <div style="font-size:11px; background:rgba(245,158,11,0.1); border-left:3px solid var(--status-warning); padding:6px 8px; margin-bottom:10px; color:var(--status-warning-text); border-radius:0 var(--radius-sm) var(--radius-sm) 0;">
                    <strong>⚠️ Active Warning:</strong> ${s.last_warning}
                  </div>
                ` : ''}

                ${isFlagged && s.flag_reason ? `
                  <div style="font-size:11px; background:rgba(239,68,68,0.1); border-left:3px solid var(--status-danger); padding:6px 8px; margin-bottom:10px; color:var(--status-danger); border-radius:0 var(--radius-sm) var(--radius-sm) 0;">
                    <strong>🚩 Flag Reason:</strong> ${s.flag_reason}
                  </div>
                ` : ''}

                <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
                  <button class="btn btn-admin btn-manage-stall" data-stall-id="${s.id}" style="flex:2; font-size:12px; padding:6px 12px; font-weight:700;">
                    ⚙️ Manage Actions
                  </button>
                  <button class="btn btn-outline btn-edit-stall" data-stall-id="${s.id}" style="flex:1; font-size:12px; padding:6px 8px;">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-outline btn-delete-stall" data-stall-id="${s.id}" data-stall-name="${s.name}" style="font-size:12px; padding:6px 8px; color:var(--status-danger); border-color:var(--status-danger);" title="Delete Stall">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
          ${filteredStalls.length === 0 ? `
            <div style="grid-column:1/-1; text-align:center; padding:48px 20px; color:var(--text-tertiary);">
              No stalls found matching "${stallSearchQuery || ''}".
            </div>
          ` : ''}
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
    let logs = state.auditLogs || [];

    if (auditCategoryFilter !== 'all') {
      logs = logs.filter(l => (l.category || '').toLowerCase() === auditCategoryFilter.toLowerCase());
    }
    if (auditSearchQuery && auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase().trim();
      logs = logs.filter(l =>
        (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.target_type && l.target_type.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    }

    const categories = ['all', 'Stall Operations', 'Financials', 'Team & Attendance', 'Broadcasts', 'Governance'];

    return `
      <div class="section-card">
        <div class="section-header" style="flex-wrap:wrap; gap:14px;">
          <div>
            <div class="section-title">Immutable Event Audit Ledger</div>
            <div class="section-desc">Complete Level-3 ledger tracking all stall lifecycle, financial verifications, attendance, and interventions.</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <input type="text" id="audit-search-input" class="pos-input" value="${auditSearchQuery}" placeholder="🔍 Search audit logs..." style="width:240px; padding:6px 10px; font-size:13px;" />
            <button class="btn btn-outline" id="btn-reset-demo" style="font-size:12px; color:var(--status-danger);">↺ Reset Demo Seed</button>
          </div>
        </div>

        <!-- Category Filter Pills -->
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          ${categories.map(cat => `
            <button class="btn btn-outline btn-audit-cat ${auditCategoryFilter.toLowerCase() === cat.toLowerCase() ? 'active' : ''}" data-cat="${cat}" style="font-size:12px; padding:4px 12px; ${auditCategoryFilter.toLowerCase() === cat.toLowerCase() ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}">
              ${cat === 'all' ? 'All Categories' : cat}
            </button>
          `).join('')}
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                const cat = log.category || 'General';
                const catBadgeStyle = cat === 'Financials' ? 'background:rgba(16,185,129,0.15); color:var(--status-success);' : (cat === 'Stall Operations' ? 'background:rgba(99,102,241,0.15); color:var(--primary);' : (cat === 'Team & Attendance' ? 'background:rgba(139,92,246,0.15); color:#8B5CF6;' : 'background:rgba(107,114,128,0.15); color:var(--text-secondary);'));

                return `
                  <tr>
                    <td class="mono-num" style="font-size:11px; white-space:nowrap;">${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span class="badge" style="${catBadgeStyle}; font-size:10px;">${cat.toUpperCase()}</span>
                    </td>
                    <td style="font-weight:600;">${log.actor_name}</td>
                    <td>
                      <span class="badge ${log.action.includes('VERIFIED') || log.action.includes('CONFIRMED') || log.action.includes('CREATED') ? 'badge-verified' : (log.action.includes('WARNING') || log.action.includes('FLAG') || log.action.includes('DISCONTINUE') ? 'badge-pending' : 'badge-active')}">
                        ${log.action}
                      </span>
                    </td>
                    <td style="font-size:12px; color:var(--text-tertiary);">${log.target_type}</td>
                    <td style="font-size:12px; line-height:1.4;">${log.details}</td>
                  </tr>
                `;
              }).join('')}
              ${logs.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:36px; color:var(--text-tertiary);">
                    No audit records match the selected filter.
                  </td>
                </tr>
              ` : ''}
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

  // ── User Management Tab ──────────────────────────────────────────────────
  if (tab === 'user-management') {
    const allUsers = state.allUsers || [];
    const pendingAdmins = allUsers.filter(u => u.role === 'pending_admin');
    const pendingCoords = allUsers.filter(u => u.role === 'pending_coordinator');
    const pendingMembers = allUsers.filter(u => u.role === 'pending_member');
    const activeUsers = allUsers.filter(u => ['admin','coordinator','member'].includes(u.role));
    const stalls = state.stalls || [];

    const roleBadge = (role = '') => {
      const map = {
        'admin': 'badge-active', 'coordinator': 'badge-verified',
        'member': 'badge-pending', 'pending_admin': 'badge-pending',
        'pending_coordinator': 'badge-pending',
        'pending_member': 'badge-pending', 'pending': 'badge-pending'
      };
      return `<span class="badge ${map[role] || 'badge-pending'}">${role.replace('_',' ').toUpperCase()}</span>`;
    };

    const userCard = (u, stalls, showStallAssign = false) => `
      <div class="user-mgmt-card" data-uid="${u.id}">
        <div class="user-mgmt-avatar">${(u.name || '?').charAt(0).toUpperCase()}</div>
        <div class="user-mgmt-info">
          <div class="user-mgmt-name">${u.name} ${u.username ? `<span style="font-size:12px;color:var(--text-secondary);font-weight:400;">@${u.username}</span>` : ''}</div>
          <div class="user-mgmt-email">${u.email}</div>
          ${u.college_name ? `<div class="user-mgmt-meta">🏫 ${u.college_name}</div>` : ''}
          ${u.stall_name_desired ? `<div class="user-mgmt-meta">🏪 Stall: <strong>${u.stall_name_desired}</strong> · ${u.stall_category_desired || ''}</div>` : ''}
          ${u.stall_alloted_number ? `<div class="user-mgmt-meta">🔢 Allotted #: <strong>${u.stall_alloted_number}</strong></div>` : ''}
          ${u.phone ? `<div class="user-mgmt-meta">📱 ${u.phone}</div>` : ''}
          <div style="margin-top:6px;">${roleBadge(u.role)}</div>
        </div>
        <div class="user-mgmt-actions">
          ${showStallAssign && u.role === 'pending_admin' ? `
            <button class="btn btn-admin btn-approve-admin" data-uid="${u.id}" style="font-size:12px;padding:4px 12px;">✓ Approve as Admin</button>
          ` : ''}
          ${showStallAssign && u.role === 'pending_coordinator' ? `
            <div style="display:flex;flex-direction:column;gap:6px;">
              <select class="form-input assign-stall-select" data-uid="${u.id}" style="font-size:12px;padding:4px 8px;">
                <option value="">Assign to stall...</option>
                ${stalls.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join('')}
              </select>
              <button class="btn btn-admin btn-approve-coord" data-uid="${u.id}" style="font-size:12px;padding:4px 12px;">✓ Approve as Coordinator</button>
            </div>
          ` : ''}
          ${showStallAssign && u.role === 'pending_member' ? `
            <div style="display:flex;flex-direction:column;gap:6px;">
              <select class="form-input assign-stall-select" data-uid="${u.id}" style="font-size:12px;padding:4px 8px;">
                <option value="">Assign to stall...</option>
                ${stalls.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join('')}
              </select>
              <button class="btn btn-outline btn-approve-member" data-uid="${u.id}" style="font-size:12px;padding:4px 12px;">✓ Approve as Member</button>
            </div>
          ` : ''}
          <button class="btn btn-outline btn-remove-user" data-uid="${u.id}" style="font-size:11px;padding:3px 8px;color:var(--status-danger);margin-top:4px;">✕ Remove</button>
        </div>
      </div>
    `;

    return `
      ${pendingAdmins.length > 0 ? `
        <!-- Pending Admins -->
        <div class="section-card" style="margin-bottom:20px;">
          <div class="section-header">
            <div>
              <div class="section-title">⏳ Pending Administrators <span class="badge badge-pending">${pendingAdmins.length}</span></div>
              <div class="section-desc">Review administrator sign-ups and grant admin access.</div>
            </div>
          </div>
          <div class="user-mgmt-list">${pendingAdmins.map(u => userCard(u, stalls, true)).join('')}</div>
        </div>
      ` : ''}

      <!-- Pending Coordinators -->
      <div class="section-card" style="margin-bottom:20px;">
        <div class="section-header">
          <div>
            <div class="section-title">⏳ Pending Coordinators <span class="badge badge-pending">${pendingCoords.length}</span></div>
            <div class="section-desc">Review coordinator sign-ups. Assign to an existing stall and approve access.</div>
          </div>
        </div>
        ${pendingCoords.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">No pending coordinator requests.</div>` :
          `<div class="user-mgmt-list">${pendingCoords.map(u => userCard(u, stalls, true)).join('')}</div>`}
      </div>

      <!-- Pending Members -->
      <div class="section-card" style="margin-bottom:20px;">
        <div class="section-header">
          <div>
            <div class="section-title">⏳ Pending Members <span class="badge badge-pending">${pendingMembers.length}</span></div>
            <div class="section-desc">Review member sign-ups. Assign to a stall to grant access.</div>
          </div>
        </div>
        ${pendingMembers.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">No pending member requests.</div>` :
          `<div class="user-mgmt-list">${pendingMembers.map(u => userCard(u, stalls, true)).join('')}</div>`}
      </div>

      <!-- All Active Users -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">✅ Active Users</div>
            <div class="section-desc">All approved users and their stall assignments.</div>
          </div>
        </div>
        ${activeUsers.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text-tertiary);">No active users yet.</div>` :
          `<div class="user-mgmt-list">${activeUsers.map(u => userCard(u, stalls, false)).join('')}</div>`}
      </div>
    `;
  }

  return '';
}

function attachAdminEventListeners(container, state) {
  // Search bar listener (Command center & Stall operations)
  const ccSearch = container.querySelector('#stall-search-input-cc');
  if (ccSearch) {
    ccSearch.addEventListener('input', (e) => {
      stallSearchQuery = e.target.value;
      const content = container.querySelector('#admin-tab-content');
      if (content) content.innerHTML = renderAdminTab('command-center', state.eventSummary || {}, state.stalls || [], state.pendingSales || [], state);
      attachAdminEventListeners(container, state);
      const reSearch = container.querySelector('#stall-search-input-cc');
      if (reSearch) { reSearch.focus(); reSearch.setSelectionRange(reSearch.value.length, reSearch.value.length); }
    });
  }

  const opsSearch = container.querySelector('#stall-search-input-ops');
  if (opsSearch) {
    opsSearch.addEventListener('input', (e) => {
      stallSearchQuery = e.target.value;
      const content = container.querySelector('#admin-tab-content');
      if (content) content.innerHTML = renderAdminTab('stall-operations', state.eventSummary || {}, state.stalls || [], state.pendingSales || [], state);
      attachAdminEventListeners(container, state);
      const reSearch = container.querySelector('#stall-search-input-ops');
      if (reSearch) { reSearch.focus(); reSearch.setSelectionRange(reSearch.value.length, reSearch.value.length); }
    });
  }

  // Audit category filter listeners
  container.querySelectorAll('.btn-audit-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      auditCategoryFilter = btn.getAttribute('data-cat') || 'all';
      const content = container.querySelector('#admin-tab-content');
      if (content) content.innerHTML = renderAdminTab('audit-log', state.eventSummary || {}, state.stalls || [], state.pendingSales || [], state);
      attachAdminEventListeners(container, state);
    });
  });

  // Audit search query
  const auditSearch = container.querySelector('#audit-search-input');
  if (auditSearch) {
    auditSearch.addEventListener('input', (e) => {
      auditSearchQuery = e.target.value;
      const content = container.querySelector('#admin-tab-content');
      if (content) content.innerHTML = renderAdminTab('audit-log', state.eventSummary || {}, state.stalls || [], state.pendingSales || [], state);
      attachAdminEventListeners(container, state);
      const reSearch = container.querySelector('#audit-search-input');
      if (reSearch) { reSearch.focus(); reSearch.setSelectionRange(reSearch.value.length, reSearch.value.length); }
    });
  }

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

  // Manage Stall Action Button (Opens comprehensive Manage Modal)
  container.querySelectorAll('.btn-manage-stall').forEach(btn => {
    btn.addEventListener('click', () => {
      const stallId = btn.getAttribute('data-stall-id');
      const stall = (state.stalls || []).find(s => s.id === stallId);
      if (stall) {
        showManageStallModal(stall, state);
      }
    });
  });

  // Edit Stall Button
  container.querySelectorAll('.btn-edit-stall').forEach(btn => {
    btn.addEventListener('click', () => {
      const stallId = btn.getAttribute('data-stall-id');
      const stall = (state.stalls || []).find(s => s.id === stallId);
      if (stall) {
        showEditStallModal(stall, state);
      }
    });
  });

  // Delete Stall Button
  container.querySelectorAll('.btn-delete-stall').forEach(btn => {
    btn.addEventListener('click', () => {
      const stallId = btn.getAttribute('data-stall-id');
      const stall = (state.stalls || []).find(s => s.id === stallId);
      if (stall) {
        showDeleteStallModal(stall, state);
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

  // User Management: Approve as Admin
  container.querySelectorAll('.btn-approve-admin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      btn.disabled = true; btn.textContent = 'Approving...';
      try {
        await api.assignUserRole(uid, 'admin', null);
        window.showToast('Administrator approved!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false; btn.textContent = '✓ Approve as Admin';
      }
    });
  });

  // User Management: Approve as Coordinator
  container.querySelectorAll('.btn-approve-coord').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      const card = btn.closest('.user-mgmt-card');
      const stallId = card?.querySelector('.assign-stall-select')?.value;
      if (!stallId) { window.showToast('Please select a stall to assign first.', 'warning'); return; }
      btn.disabled = true; btn.textContent = 'Approving...';
      try {
        await api.assignUserRole(uid, 'coordinator', stallId);
        window.showToast('Coordinator approved & assigned to stall!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false; btn.textContent = '✓ Approve as Coordinator';
      }
    });
  });

  // User Management: Approve as Member
  container.querySelectorAll('.btn-approve-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      const card = btn.closest('.user-mgmt-card');
      const stallId = card?.querySelector('.assign-stall-select')?.value;
      if (!stallId) { window.showToast('Please select a stall to assign first.', 'warning'); return; }
      btn.disabled = true; btn.textContent = 'Approving...';
      try {
        await api.assignUserRole(uid, 'member', stallId);
        window.showToast('Member approved & assigned to stall!', 'success');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
        btn.disabled = false; btn.textContent = '✓ Approve as Member';
      }
    });
  });

  // User Management: Remove user
  container.querySelectorAll('.btn-remove-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      if (!confirm('Remove this user profile? This cannot be undone.')) return;
      try {
        await api.removeUser(uid);
        window.showToast('User profile removed.', 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  });
}

/**
 * Add Stall Modal (Working Form)
 */
function showAddStallModal(state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const users = state.allUsers || [];
  const eligibleCoords = users.filter(u => u.role === 'coordinator' || u.role === 'pending_coordinator' || !u.stall_id);

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-stall-backdrop">
      <div class="modal-card" style="max-width:520px;">
        <div class="modal-header">
          <h3 style="font-size:18px;">Register New Stall</h3>
          <button class="modal-close-btn" id="close-stall-modal">✕</button>
        </div>

        <form id="new-stall-form" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Stall Name *</label>
            <input type="text" id="stall-name-input" class="pos-input" placeholder="e.g. Drone Racing Zone" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Category *</label>
              <select id="stall-cat-input" class="pos-input" style="width:100%;">
                <option value="Tech & Gaming">Tech & Gaming</option>
                <option value="Electronics & DIY">Electronics & DIY</option>
                <option value="Robotics">Robotics</option>
                <option value="Rural Tech">Rural Tech</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Art & Crafts">Art & Crafts</option>
                <option value="Merchandise">Merchandise</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Allotted Booth #</label>
              <input type="text" id="stall-allot-input" class="pos-input" placeholder="e.g. A-12" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Location Description</label>
              <input type="text" id="stall-loc-input" class="pos-input" placeholder="e.g. Main Courtyard - North Wing" />
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Banner Color</label>
              <input type="color" id="stall-color-input" value="#4F46E5" style="width:100%; height:38px; padding:2px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); cursor:pointer;" />
            </div>
          </div>

          <div style="border-top:1px solid var(--border-subtle); padding-top:10px;">
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Assign Coordinator</label>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <select id="stall-coord-select" class="pos-input" style="width:100%;">
                <option value="">-- Select Existing User or Fill Below --</option>
                ${eligibleCoords.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
              </select>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input type="text" id="coord-name-input" class="pos-input" placeholder="Or New Coordinator Name" />
                <input type="text" id="coord-phone-input" class="pos-input" placeholder="Coordinator Phone (+91...)" />
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-admin" style="padding:12px; margin-top:8px;">
            ✓ Create Stall & Issue Invite Code
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-stall-modal')?.addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('add-stall-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-stall-backdrop') modalContainer.innerHTML = '';
  });

  document.getElementById('new-stall-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stall-name-input').value;
    const category = document.getElementById('stall-cat-input').value;
    const location = document.getElementById('stall-loc-input').value;
    const allotted_number = document.getElementById('stall-allot-input').value;
    const banner_color = document.getElementById('stall-color-input').value;
    const coordinator_uid = document.getElementById('stall-coord-select').value || null;
    const coordinator_name = document.getElementById('coord-name-input').value;
    const coordinator_phone = document.getElementById('coord-phone-input').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Stall...';

    try {
      await api.createStall({
        name,
        category,
        location,
        allotted_number,
        banner_color,
        coordinator_uid,
        coordinator_name,
        coordinator_phone
      });
      window.showToast(`Stall "${name}" created successfully!`, 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ Create Stall & Issue Invite Code';
    }
  });
}

/**
 * Edit Stall Details Modal (Working Form)
 */
function showEditStallModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const users = state.allUsers || [];

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="edit-stall-backdrop">
      <div class="modal-card" style="max-width:520px;">
        <div class="modal-header">
          <div>
            <h3 style="font-size:18px;">Edit Stall Details</h3>
            <span style="font-size:12px; color:var(--text-tertiary);">Editing ID: ${stall.id}</span>
          </div>
          <button class="modal-close-btn" id="close-edit-stall-modal">✕</button>
        </div>

        <form id="edit-stall-form" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Stall Name *</label>
            <input type="text" id="edit-stall-name" class="pos-input" value="${stall.name || ''}" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Category *</label>
              <select id="edit-stall-cat" class="pos-input" style="width:100%;">
                ${['Tech & Gaming','Electronics & DIY','Robotics','Rural Tech','Food & Beverage','Art & Crafts','Merchandise'].map(c => `
                  <option value="${c}" ${stall.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Allotted Booth #</label>
              <input type="text" id="edit-stall-allot" class="pos-input" value="${stall.allotted_number || ''}" placeholder="e.g. A-12" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Location Description</label>
              <input type="text" id="edit-stall-loc" class="pos-input" value="${stall.location || ''}" />
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Banner Color</label>
              <input type="color" id="edit-stall-color" value="${stall.banner_color || '#4F46E5'}" style="width:100%; height:38px; padding:2px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); cursor:pointer;" />
            </div>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Assigned Coordinator</label>
            <select id="edit-stall-coord" class="pos-input" style="width:100%;">
              <option value="">-- No Coordinator Assigned --</option>
              ${users.map(u => `
                <option value="${u.id}" ${stall.coordinator_user_id === u.id ? 'selected' : ''}>
                  ${u.name} (${u.role}) - ${u.email}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Operating Status</label>
            <select id="edit-stall-status" class="pos-input" style="width:100%;">
              <option value="active" ${stall.status === 'active' ? 'selected' : ''}>ACTIVE (Normal operations)</option>
              <option value="warning" ${stall.status === 'warning' ? 'selected' : ''}>WARNING (Under caution)</option>
              <option value="discontinued" ${stall.status === 'discontinued' ? 'selected' : ''}>DISCONTINUED (Locked)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn btn-outline" id="cancel-edit-stall">Cancel</button>
            <button type="submit" class="btn btn-admin">💾 Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-edit-stall-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
  document.getElementById('cancel-edit-stall')?.addEventListener('click', () => modalContainer.innerHTML = '');
  document.getElementById('edit-stall-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-stall-backdrop') modalContainer.innerHTML = '';
  });

  document.getElementById('edit-stall-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-stall-name').value;
    const category = document.getElementById('edit-stall-cat').value;
    const location = document.getElementById('edit-stall-loc').value;
    const allotted_number = document.getElementById('edit-stall-allot').value;
    const banner_color = document.getElementById('edit-stall-color').value;
    const coordinator_uid = document.getElementById('edit-stall-coord').value || null;
    const status = document.getElementById('edit-stall-status').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      await api.updateStall(stall.id, {
        name,
        category,
        location,
        allotted_number,
        banner_color,
        coordinator_uid,
        status
      });
      window.showToast(`Stall "${name}" details updated successfully!`, 'success');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Save Changes';
    }
  });
}

/**
 * Delete Stall Confirmation Modal (Working Form)
 */
function showDeleteStallModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="del-stall-backdrop">
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <h3 style="font-size:18px; color:var(--status-danger);">🗑️ Delete Stall</h3>
          <button class="modal-close-btn" id="close-del-stall-modal">✕</button>
        </div>

        <div style="margin:16px 0; font-size:14px; color:var(--text-secondary); line-height:1.5;">
          Are you sure you want to permanently delete <strong>"${stall.name}"</strong>?
          <div style="background:rgba(239,68,68,0.1); border-radius:var(--radius-sm); padding:10px; margin-top:10px; font-size:12px; color:var(--status-danger);">
            ⚠️ This will unlink the coordinator and all team members from this booth. This action is permanently audited.
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-outline" id="cancel-del-stall">Cancel</button>
          <button class="btn btn-outline" id="confirm-del-stall" style="background:var(--status-danger); color:white; border-color:var(--status-danger);">
            Yes, Delete Stall
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('close-del-stall-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
  document.getElementById('cancel-del-stall')?.addEventListener('click', () => modalContainer.innerHTML = '');
  document.getElementById('del-stall-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'del-stall-backdrop') modalContainer.innerHTML = '';
  });

  document.getElementById('confirm-del-stall')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirm-del-stall');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    try {
      await api.deleteStall(stall.id);
      window.showToast(`Stall "${stall.name}" has been deleted.`, 'info');
      modalContainer.innerHTML = '';
      await state.refreshAll();
    } catch (err) {
      window.showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Yes, Delete Stall';
    }
  });
}

/**
 * Admin Manage Modal on tap of "Manage" button with 4 distinct working actions:
 * 1. Issue Warning [with context]
 * 2. Discontinue Them (Coordinator or Member) [with context]
 * 3. Flag Them (Stall or User) [with context]
 * 4. Stall Discontinue [with context]
 */
function showManageStallModal(stall, state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const members = (state.allUsers || []).filter(u => u.stall_id === stall.id);
  const coordinator = stall.coordinator_user_id ? (state.allUsers || []).find(u => u.id === stall.coordinator_user_id) : stall.coordinator;

  let activeActionTab = 'warning';

  const renderManageView = () => {
    return `
      <div class="modal-backdrop active" id="manage-stall-backdrop">
        <div class="modal-card" style="max-width:620px;">
          <!-- Header -->
          <div class="modal-header" style="align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:14px; height:14px; border-radius:50%; background:${stall.banner_color || 'var(--primary)'}; display:inline-block;"></span>
                <h3 style="font-size:19px; margin:0;">${stall.name}</h3>
                <span class="badge ${stall.status === 'active' ? 'badge-active' : 'badge-discontinued'}">${(stall.status || 'active').toUpperCase()}</span>
                ${stall.is_flagged ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:var(--status-danger); font-size:10px;">🚩 FLAGGED</span>` : ''}
              </div>
              <div style="font-size:12px; color:var(--text-tertiary); margin-top:3px; margin-left:22px;">
                ${stall.category} • ${stall.location || 'Courtyard'} • Coordinator: <strong>${coordinator ? coordinator.name : 'Unassigned'}</strong>
              </div>
            </div>
            <button class="modal-close-btn" id="close-manage-modal">✕</button>
          </div>

          <!-- Manage Action Sub-Tabs -->
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:16px 0 12px 0;">
            <button class="btn btn-outline manage-subtab-btn ${activeActionTab === 'warning' ? 'active' : ''}" data-action="warning" style="font-size:11px; padding:8px 4px; text-align:center; font-weight:700; ${activeActionTab === 'warning' ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}">
              1. ⚠️ Issue Warning
            </button>
            <button class="btn btn-outline manage-subtab-btn ${activeActionTab === 'discontinue-user' ? 'active' : ''}" data-action="discontinue-user" style="font-size:11px; padding:8px 4px; text-align:center; font-weight:700; ${activeActionTab === 'discontinue-user' ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}">
              2. 👤 Discontinue Them
            </button>
            <button class="btn btn-outline manage-subtab-btn ${activeActionTab === 'flag' ? 'active' : ''}" data-action="flag" style="font-size:11px; padding:8px 4px; text-align:center; font-weight:700; ${activeActionTab === 'flag' ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}">
              3. 🚩 Flag Them
            </button>
            <button class="btn btn-outline manage-subtab-btn ${activeActionTab === 'discontinue-stall' ? 'active' : ''}" data-action="discontinue-stall" style="font-size:11px; padding:8px 4px; text-align:center; font-weight:700; ${activeActionTab === 'discontinue-stall' ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}">
              4. 🛑 Stall Discontinue
            </button>
          </div>

          <!-- Action Body -->
          <div id="manage-action-panel" style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:18px;">
            ${renderActionPanelContent(activeActionTab, stall, coordinator, members)}
          </div>

          <!-- Quick Footer Shortcuts -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; border-top:1px solid var(--border-subtle); padding-top:12px;">
            <button class="btn btn-outline" id="btn-quick-edit-stall" style="font-size:12px;">✏️ Edit Details</button>
            <button class="btn btn-outline" id="btn-quick-delete-stall" style="font-size:12px; color:var(--status-danger); border-color:var(--status-danger);">🗑️ Delete Stall</button>
          </div>
        </div>
      </div>
    `;
  };

  const renderActionPanelContent = (tab, stall, coordinator, members) => {
    if (tab === 'warning') {
      return `
        <form id="action-warning-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">1. Issue Warning to Stall</div>
            <div style="font-size:12px; color:var(--text-secondary);">Sends a formal operational warning notice to the coordinator and team members. This will be logged in the immutable audit ledger.</div>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Warning Context / Specific Reason *</label>
            <textarea id="warning-context-input" class="pos-input" rows="3" placeholder="e.g. Unreported cash transactions observed / Booth overcrowding violation..." required style="width:100%;">${stall.last_warning || ''}</textarea>
          </div>
          <button type="submit" class="btn btn-admin" style="background:#D97706; border-color:#D97706; color:white; padding:10px;">
            ⚠️ Dispatch Warning Notice
          </button>
        </form>
      `;
    }

    if (tab === 'discontinue-user') {
      const allStallPeople = [];
      if (coordinator) allStallPeople.push({ id: coordinator.id, name: coordinator.name, role: 'Coordinator' });
      members.forEach(m => {
        if (!allStallPeople.some(p => p.id === m.id)) {
          allStallPeople.push({ id: m.id, name: m.name, role: 'Member' });
        }
      });

      return `
        <form id="action-discontinue-user-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">2. Discontinue Member / Coordinator</div>
            <div style="font-size:12px; color:var(--text-secondary);">Removes a specific individual from this stall team, revoking their stall permissions with mandatory context.</div>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Select Person to Discontinue *</label>
            <select id="discontinue-user-select" class="pos-input" style="width:100%;" required>
              <option value="">-- Choose Team Member or Coordinator --</option>
              ${allStallPeople.map(p => `
                <option value="${p.id}">${p.name} (${p.role})</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Discontinuation Reason / Context *</label>
            <textarea id="discontinue-user-reason" class="pos-input" rows="2" placeholder="e.g. Code of conduct violation / Repeated absence..." required style="width:100%;"></textarea>
          </div>
          <button type="submit" class="btn btn-admin" style="background:var(--status-danger); border-color:var(--status-danger); color:white; padding:10px;">
            🛑 Discontinue Person from Stall
          </button>
        </form>
      `;
    }

    if (tab === 'flag') {
      const allStallPeople = [];
      if (coordinator) allStallPeople.push({ id: coordinator.id, name: coordinator.name, role: 'Coordinator' });
      members.forEach(m => {
        if (!allStallPeople.some(p => p.id === m.id)) {
          allStallPeople.push({ id: m.id, name: m.name, role: 'Member' });
        }
      });

      return `
        <form id="action-flag-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">3. Flag Violation [with context]</div>
            <div style="font-size:12px; color:var(--text-secondary);">Flags either the entire stall or a specific member for admin scrutiny.</div>
          </div>
          <div style="display:flex; gap:16px;">
            <label style="font-size:13px; display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="flag-target" value="stall" checked id="flag-radio-stall" />
              Flag Entire Stall
            </label>
            <label style="font-size:13px; display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="flag-target" value="user" id="flag-radio-user" />
              Flag Specific Individual
            </label>
          </div>
          <div id="flag-user-dropdown-wrap" style="display:none;">
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Select Individual</label>
            <select id="flag-user-select" class="pos-input" style="width:100%;">
              <option value="">-- Choose Person --</option>
              ${allStallPeople.map(p => `
                <option value="${p.id}">${p.name} (${p.role})</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Flag Context / Reason *</label>
            <textarea id="flag-context-input" class="pos-input" rows="3" placeholder="e.g. Audit discrepancy of ₹5,000 / Disciplinary complaint..." required style="width:100%;">${stall.flag_reason || ''}</textarea>
          </div>
          <button type="submit" class="btn btn-admin" style="background:#7C3AED; border-color:#7C3AED; color:white; padding:10px;">
            🚩 Apply Flag with Context
          </button>
        </form>
      `;
    }

    if (tab === 'discontinue-stall') {
      return `
        <form id="action-discontinue-stall-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px; color:var(--status-danger);">4. Discontinue Entire Stall</div>
            <div style="font-size:12px; color:var(--text-secondary);">Halts stall operations immediately. POS sales submission and team check-ins will be locked.</div>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Discontinuation Justification / Context *</label>
            <textarea id="stall-discontinue-context" class="pos-input" rows="3" placeholder="e.g. Safety inspection failure / Event rule non-compliance..." required style="width:100%;">${stall.discontinue_reason || ''}</textarea>
          </div>
          <button type="submit" class="btn btn-admin" style="background:var(--status-danger); border-color:var(--status-danger); color:white; padding:10px;">
            🛑 Discontinue Entire Stall Immediately
          </button>
        </form>
      `;
    }

    return '';
  };

  modalContainer.innerHTML = renderManageView();

  const attachManageEvents = () => {
    document.getElementById('close-manage-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
    document.getElementById('manage-stall-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'manage-stall-backdrop') modalContainer.innerHTML = '';
    });

    // Subtab switcher
    modalContainer.querySelectorAll('.manage-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeActionTab = btn.getAttribute('data-action');
        modalContainer.innerHTML = renderManageView();
        attachManageEvents();
      });
    });

    // Quick Shortcuts
    document.getElementById('btn-quick-edit-stall')?.addEventListener('click', () => {
      showEditStallModal(stall, state);
    });

    document.getElementById('btn-quick-delete-stall')?.addEventListener('click', () => {
      showDeleteStallModal(stall, state);
    });

    // Action 1: Warning Form
    const warnForm = document.getElementById('action-warning-form');
    if (warnForm) {
      warnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = document.getElementById('warning-context-input').value;
        const btn = warnForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Dispatching...';
        try {
          await api.issueStallWarning(stall.id, reason);
          window.showToast(`Warning issued to ${stall.name}`, 'warning');
          modalContainer.innerHTML = '';
          await state.refreshAll();
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '⚠️ Dispatch Warning Notice';
        }
      });
    }

    // Action 2: Discontinue User Form
    const discUserForm = document.getElementById('action-discontinue-user-form');
    if (discUserForm) {
      discUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('discontinue-user-select').value;
        const reason = document.getElementById('discontinue-user-reason').value;
        if (!userId) {
          window.showToast('Please select an individual to discontinue', 'warning');
          return;
        }
        const btn = discUserForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Discontinuing...';
        try {
          await api.discontinueUserFromStall(stall.id, { userId, reason });
          window.showToast('Individual discontinued from stall.', 'info');
          modalContainer.innerHTML = '';
          await state.refreshAll();
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '🛑 Discontinue Person from Stall';
        }
      });
    }

    // Action 3: Flag Form
    const flagForm = document.getElementById('action-flag-form');
    if (flagForm) {
      const radioStall = document.getElementById('flag-radio-stall');
      const radioUser = document.getElementById('flag-radio-user');
      const wrapUser = document.getElementById('flag-user-dropdown-wrap');

      radioStall?.addEventListener('change', () => { wrapUser.style.display = 'none'; });
      radioUser?.addEventListener('change', () => { wrapUser.style.display = 'block'; });

      flagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetType = radioUser.checked ? 'user' : 'stall';
        const userId = targetType === 'user' ? document.getElementById('flag-user-select').value : null;
        const reason = document.getElementById('flag-context-input').value;

        if (targetType === 'user' && !userId) {
          window.showToast('Please select a person to flag', 'warning');
          return;
        }

        const btn = flagForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Applying Flag...';
        try {
          await api.flagStallOrUser(stall.id, { targetType, userId, reason });
          window.showToast('Flag applied with context!', 'success');
          modalContainer.innerHTML = '';
          await state.refreshAll();
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '🚩 Apply Flag with Context';
        }
      });
    }

    // Action 4: Stall Discontinue Form
    const discStallForm = document.getElementById('action-discontinue-stall-form');
    if (discStallForm) {
      discStallForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = document.getElementById('stall-discontinue-context').value;
        const btn = discStallForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Discontinuing Stall...';
        try {
          await api.discontinueStall(stall.id, reason);
          window.showToast(`Stall "${stall.name}" discontinued!`, 'info');
          modalContainer.innerHTML = '';
          await state.refreshAll();
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '🛑 Discontinue Entire Stall Immediately';
        }
      });
    }
  };

  attachManageEvents();
}
