/**
 * Unified Activity Center: Notifications & Audit Log Drawer
 * Features segmented division tab switcher between Notifications and Audit Log,
 * category filters, search, and real-time read/seen sync.
 */

import api from '../api.js';
import state from '../state.js';

export function showNotificationsDrawer(state, defaultTab = 'notifications') {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  let activeTab = defaultTab;
  let auditCategory = 'all';
  let auditSearch = '';

  const notifs = state.notifications || [];
  let auditLogs = state.auditLogs || [];

  // Automatically mark all non-announcements as seen in the background & sync local state
  let markedSeenAny = false;
  (state.notifications || []).forEach(n => {
    if (n.type !== 'announcement' && !n.is_read) {
      n.is_read = true;
      markedSeenAny = true;
    }
  });
  if (markedSeenAny) {
    state.unreadCount = (state.notifications || []).filter(n => !n.is_read).length;
    state.emitChange();
  }
  api.markNotificationsSeen().catch(err => console.warn('Could not auto-mark notifications as seen', err));

  // If audit logs aren't loaded yet, fetch them asynchronously
  if (auditLogs.length === 0) {
    api.getAuditLogs(100).then(logs => {
      if (Array.isArray(logs)) {
        auditLogs = logs;
        state.auditLogs = logs;
        if (activeTab === 'audit') {
          render();
        }
      }
    }).catch(e => console.warn('Could not fetch audit logs:', e));
  }

  const getActionColor = (action = '') => {
    const a = action.toUpperCase();
    if (a.includes('SALE') || a.includes('VERIFIED')) return { icon: 'credit-card', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.15)' };
    if (a.includes('EXPENSE')) return { icon: 'receipt', color: 'var(--status-danger)', bg: 'rgba(239, 68, 68, 0.15)' };
    if (a.includes('ATTENDANCE') || a.includes('CHECKIN')) return { icon: 'user-check', color: 'var(--role-coordinator)', bg: 'rgba(217, 119, 6, 0.15)' };
    if (a.includes('JOIN') || a.includes('MEMBER')) return { icon: 'user-plus', color: 'var(--role-member)', bg: 'rgba(225, 29, 72, 0.15)' };
    if (a.includes('STALL')) return { icon: 'store', color: 'var(--accent-primary)', bg: 'rgba(79, 70, 229, 0.15)' };
    if (a.includes('ANNOUNCEMENT') || a.includes('BROADCAST')) return { icon: 'megaphone', color: 'var(--status-info)', bg: 'rgba(2, 132, 199, 0.15)' };
    return { icon: 'activity', color: 'var(--text-secondary)', bg: 'var(--bg-surface-subtle)' };
  };

  const filterLogs = (logs) => {
    return logs.filter(l => {
      const matchCat = auditCategory === 'all' || (l.category && l.category.toLowerCase().includes(auditCategory.toLowerCase())) || (l.action && l.action.toLowerCase().includes(auditCategory.toLowerCase()));
      const matchSearch = !auditSearch || (l.details && l.details.toLowerCase().includes(auditSearch.toLowerCase())) || (l.action && l.action.toLowerCase().includes(auditSearch.toLowerCase())) || (l.actor_user_name && l.actor_user_name.toLowerCase().includes(auditSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  };

  const render = () => {
    const unreadCount = notifs.filter(n => !n.is_read).length;
    const filteredAudit = filterLogs(auditLogs);

    modalContainer.innerHTML = `
      <div class="modal-backdrop active" id="activity-hub-backdrop">
        <div class="modal-card activity-hub-modal" style="max-width:560px; width:100%; padding:20px;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="activity-hub-header-icon"><i data-lucide="layers"></i></div>
              <div>
                <h3 style="font-size:17px; font-weight:800; line-height:1.2;">Activity & Operations</h3>
                <div style="font-size:12px; color:var(--text-tertiary);">Live operational alerts & event audit trail</div>
              </div>
            </div>
            <button class="modal-close-btn" id="close-activity-hub-btn" title="Close"><i data-lucide="x"></i></button>
          </div>

          <!-- iOS-Style Segmented Division Switcher Tab -->
          <div class="activity-division-tabs">
            <button class="division-tab-btn ${activeTab === 'notifications' ? 'active' : ''}" data-division="notifications">
              <span class="tab-label-wrap">
                <i data-lucide="bell"></i>
                <span>Notifications</span>
              </span>
              ${unreadCount > 0 ? `<span class="division-badge">${unreadCount}</span>` : ''}
            </button>
            <button class="division-tab-btn ${activeTab === 'audit' ? 'active' : ''}" data-division="audit">
              <span class="tab-label-wrap">
                <i data-lucide="history"></i>
                <span>Audit Log</span>
              </span>
              <span class="division-count">${auditLogs.length}</span>
            </button>
          </div>

          <!-- ═══════════════════════════════════════════════════════ -->
          <!-- Tab 1: Notifications & Alerts                           -->
          <!-- ═══════════════════════════════════════════════════════ -->
          ${activeTab === 'notifications' ? `
            <div class="activity-tab-pane">
              <div class="notif-pane-header">
                <span style="font-size:12px; font-weight:600; color:var(--text-tertiary);">
                  ${notifs.length} total alerts (${unreadCount} unread)
                </span>
                ${unreadCount > 0 ? `
                  <button class="btn-text-action" id="btn-mark-all-read">
                    <i data-lucide="check-check"></i> Mark all read
                  </button>
                ` : ''}
              </div>

              <div class="activity-scroll-list">
                ${notifs.map(n => {
                  const isAnnouncement = n.type === 'announcement';
                  const isRead = !!n.is_read;
                  const typeIcon = isAnnouncement ? 'megaphone' : (n.type === 'warning' ? 'alert-triangle' : (n.type === 'member_joined' ? 'party-popper' : 'bell'));
                  const badgeColor = isAnnouncement ? 'var(--accent-primary)' : (n.type === 'warning' ? 'var(--status-danger)' : 'var(--status-success)');
                  const badgeBg = isAnnouncement ? 'var(--accent-light)' : (n.type === 'warning' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)');

                  return `
                    <div class="notif-item-card ${isRead ? 'read' : 'unread'}" data-notif-id="${n.id}" data-type="${n.type}">
                      <div class="notif-item-top">
                        <div class="notif-item-title-row">
                          <span class="notif-type-icon"><i data-lucide="${typeIcon}"></i></span>
                          <span class="notif-title-text">${n.title}</span>
                          <span class="notif-type-pill" style="color:${badgeColor}; background:${badgeBg};">
                            ${(n.type || 'NOTICE').toUpperCase()}
                          </span>
                        </div>
                        <span class="notif-time mono-num">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div class="notif-message-text">${n.message}</div>

                      <div class="notif-item-footer">
                        <span class="notif-audience">Audience: ${n.target_role ? n.target_role.toUpperCase() : 'ALL'}</span>
                        ${isAnnouncement ? `
                          <button class="btn-mark-read btn-mark-notif-read" data-notif-id="${n.id}">
                            ${isRead ? '✓ Read' : '✓ Mark as read'}
                          </button>
                        ` : `
                          <span class="notif-seen-tag">${isRead ? '✓ Seen' : 'Click to view'}</span>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
                ${notifs.length === 0 ? `
                  <div class="activity-empty-state">
                    <i data-lucide="bell-off"></i>
                    <div>No new notifications right now.</div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- ═══════════════════════════════════════════════════════ -->
          <!-- Tab 2: Event Audit Trail Ledger                         -->
          <!-- ═══════════════════════════════════════════════════════ -->
          ${activeTab === 'audit' ? `
            <div class="activity-tab-pane">
              <!-- Search & Filter Controls -->
              <div class="audit-filter-bar">
                <input type="text" id="audit-filter-input" class="pos-input audit-search-box" value="${auditSearch}" placeholder="Filter audit trail by action, user or details..." />
                
                <div class="audit-category-chips">
                  <button class="chip-filter ${auditCategory === 'all' ? 'active' : ''}" data-cat="all">All</button>
                  <button class="chip-filter ${auditCategory === 'financial' ? 'active' : ''}" data-cat="financial">Sales & Expenses</button>
                  <button class="chip-filter ${auditCategory === 'attendance' ? 'active' : ''}" data-cat="attendance">Attendance</button>
                  <button class="chip-filter ${auditCategory === 'stall' ? 'active' : ''}" data-cat="stall">Stalls</button>
                </div>
              </div>

              <div class="activity-scroll-list">
                ${filteredAudit.map(log => {
                  const style = getActionColor(log.action);
                  return `
                    <div class="audit-item-card">
                      <div class="audit-item-header">
                        <span class="audit-badge" style="color:${style.color}; background:${style.bg};">
                          <i data-lucide="${style.icon}"></i>
                          <span>${log.action}</span>
                        </span>
                        <span class="audit-time mono-num">${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      <div class="audit-desc">${log.details}</div>
                      <div class="audit-footer">
                        <span class="audit-actor"><i data-lucide="user"></i> ${log.actor_user_name || 'System'}</span>
                        <span class="audit-date mono-num">${new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
                ${filteredAudit.length === 0 ? `
                  <div class="activity-empty-state">
                    <i data-lucide="search-x"></i>
                    <div>No audit events match the current filter.</div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

        </div>
      </div>
    `;

    window.renderIcons?.();
    attachEvents();
  };

  const attachEvents = () => {
    // Close button
    document.getElementById('close-activity-hub-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      window.updateHeaderNotificationBadge?.();
    });

    // Backdrop click
    document.getElementById('activity-hub-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'activity-hub-backdrop') {
        modalContainer.innerHTML = '';
        window.updateHeaderNotificationBadge?.();
      }
    });

    // Division Switcher Click
    modalContainer.querySelectorAll('[data-division]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-division');
        render();
      });
    });

    // Mark single notification read
    modalContainer.querySelectorAll('.btn-mark-notif-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const notifId = btn.getAttribute('data-notif-id');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        state.markNotificationAsRead(notifId);
        window.updateHeaderNotificationBadge?.();
        render();
        try {
          await api.markNotificationRead(notifId);
          window.showToast('Notification marked as read', 'success');
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      });
    });

    // Auto mark non-announcement card on click
    modalContainer.querySelectorAll('.notif-item-card').forEach(card => {
      card.addEventListener('click', async () => {
        const notifId = card.getAttribute('data-notif-id');
        const notif = (state.notifications || []).find(n => n.id === notifId);
        if (notif && !notif.is_read) {
          state.markNotificationAsRead(notifId);
          window.updateHeaderNotificationBadge?.();
          render();
          try {
            await api.markNotificationRead(notifId);
          } catch (e) {
            console.warn('Could not mark as read on server:', e);
          }
        }
      });
    });

    // Mark all read button
    document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
      state.markAllNotificationsAsRead();
      window.updateHeaderNotificationBadge?.();
      render();
      try {
        await api.markNotificationsSeen();
        window.showToast('All notifications marked as read', 'success');
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });

    // Audit category chip filters
    modalContainer.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        auditCategory = chip.getAttribute('data-cat');
        render();
      });
    });

    // Audit search box input
    const auditInput = modalContainer.querySelector('#audit-filter-input');
    if (auditInput) {
      auditInput.addEventListener('input', (e) => {
        auditSearch = e.target.value;
        const list = modalContainer.querySelector('.activity-scroll-list');
        if (list) {
          const filtered = filterLogs(auditLogs);
          list.innerHTML = filtered.map(log => {
            const style = getActionColor(log.action);
            return `
              <div class="audit-item-card">
                <div class="audit-item-header">
                  <span class="audit-badge" style="color:${style.color}; background:${style.bg};">
                    <i data-lucide="${style.icon}"></i>
                    <span>${log.action}</span>
                  </span>
                  <span class="audit-time mono-num">${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <div class="audit-desc">${log.details}</div>
                <div class="audit-footer">
                  <span class="audit-actor"><i data-lucide="user"></i> ${log.actor_user_name || 'System'}</span>
                  <span class="audit-date mono-num">${new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            `;
          }).join('') || '<div class="activity-empty-state"><i data-lucide="search-x"></i><div>No audit events match the current filter.</div></div>';
          window.renderIcons?.();
        }
      });
    }
  };

  render();
}
