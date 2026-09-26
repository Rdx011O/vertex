/**
 * Notifications Drawer Component
 */

import api from '../api.js';
import state from '../state.js';

export function showNotificationsDrawer(state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const notifs = state.notifications || [];

  // Automatically mark all non-announcements as seen in the background
  api.markNotificationsSeen().catch(err => console.warn('Could not auto-mark notifications as seen', err));

  const renderContent = () => {
    return `
      <div class="modal-backdrop active" id="notif-backdrop">
        <div class="modal-card" style="max-width:520px;">
          <div class="modal-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 style="font-size:18px;">Event Notifications & Alerts</h3>
              <span class="badge badge-pending" style="font-size:11px;">${notifs.filter(n => !n.is_read).length} Unread</span>
            </div>
            <button class="modal-close-btn" id="close-notif-btn">✕</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px; max-height:480px; overflow-y:auto; padding-right:4px;">
            ${notifs.map(n => {
              const isAnnouncement = n.type === 'announcement';
              const isRead = !!n.is_read;
              const typeIcon = isAnnouncement ? '📢' : (n.type === 'warning' ? '⚠️' : (n.type === 'member_joined' ? '🎉' : '🔔'));
              const badgeStyle = isAnnouncement ? 'background:rgba(99,102,241,0.15); color:var(--primary);' : (n.type === 'warning' ? 'background:rgba(239,68,68,0.15); color:var(--status-danger);' : 'background:rgba(16,185,129,0.15); color:var(--status-success);');

              return `
                <div class="notif-item-card ${isRead ? 'read' : 'unread'}" data-notif-id="${n.id}" data-type="${n.type}" style="border:1px solid ${isRead ? 'var(--border-subtle)' : 'var(--primary)'}; background:${isRead ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)'}; border-radius:var(--radius-sm); padding:14px; position:relative; transition:all 0.2s ease;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:16px;">${typeIcon}</span>
                      <span style="font-weight:700; font-size:14px; color:var(--text-primary);">${n.title}</span>
                      <span class="badge" style="${badgeStyle}; font-size:10px; padding:2px 6px;">${(n.type || 'NOTICE').toUpperCase()}</span>
                    </div>
                    <span style="font-size:11px; color:var(--text-tertiary);">${new Date(n.created_at).toLocaleTimeString()}</span>
                  </div>

                  <div style="font-size:13px; color:var(--text-secondary); line-height:1.45; margin-bottom:8px;">${n.message}</div>

                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:8px; margin-top:6px;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700;">
                      Audience: ${n.target_role ? n.target_role.toUpperCase() : 'ALL'}
                    </div>

                    ${isAnnouncement ? `
                      <button class="btn btn-outline btn-mark-notif-read" data-notif-id="${n.id}" style="font-size:11px; padding:3px 10px; ${isRead ? 'opacity:0.6; pointer-events:none; border-color:transparent; color:var(--text-tertiary);' : 'color:var(--primary); border-color:var(--primary);'}">
                        ${isRead ? '✓ Read' : '✓ Mark as read'}
                      </button>
                    ` : `
                      <span style="font-size:11px; color:var(--text-tertiary); font-style:italic;">
                        ${isRead ? 'Seen' : 'Click to view'}
                      </span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
            ${notifs.length === 0 ? '<div style="text-align:center; padding:36px; color:var(--text-tertiary);">No notifications right now.</div>' : ''}
          </div>
        </div>
      </div>
    `;
  };

  modalContainer.innerHTML = renderContent();

  const attachEvents = () => {
    document.getElementById('close-notif-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('notif-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'notif-backdrop') {
        modalContainer.innerHTML = '';
      }
    });

    // Mark as read button for Announcements
    modalContainer.querySelectorAll('.btn-mark-notif-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const notifId = btn.getAttribute('data-notif-id');
        btn.disabled = true;
        btn.textContent = 'Marking...';
        try {
          await api.markNotificationRead(notifId);
          const notif = notifs.find(n => n.id === notifId);
          if (notif) notif.is_read = true;
          window.showToast('Announcement marked as read', 'success');
          modalContainer.innerHTML = renderContent();
          attachEvents();
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '✓ Mark as read';
        }
      });
    });

    // Auto mark non-announcements on click/open
    modalContainer.querySelectorAll('.notif-item-card').forEach(card => {
      card.addEventListener('click', async () => {
        const notifId = card.getAttribute('data-notif-id');
        const type = card.getAttribute('data-type');
        const notif = notifs.find(n => n.id === notifId);
        if (type !== 'announcement' && notif && !notif.is_read) {
          try {
            await api.markNotificationRead(notifId);
            notif.is_read = true;
            modalContainer.innerHTML = renderContent();
            attachEvents();
          } catch (e) {
            console.warn('Could not mark as read', e);
          }
        }
      });
    });
  };

  attachEvents();
}

