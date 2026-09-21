/**
 * Notifications Drawer Component
 */

import api from '../api.js';
import state from '../state.js';

export function showNotificationsDrawer(state) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const notifs = state.notifications || [];

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="notif-backdrop">
      <div class="modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 style="font-size:18px;">Event Notifications & Alerts</h3>
          <button class="modal-close-btn" id="close-notif-btn">✕</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:auto;">
          ${notifs.map(n => `
            <div style="border:1px solid var(--border-subtle); background:var(--bg-surface-subtle); border-radius:var(--radius-sm); padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:700; font-size:14px;">${n.title}</span>
                <span style="font-size:11px; color:var(--text-tertiary);">${new Date(n.created_at).toLocaleTimeString()}</span>
              </div>
              <div style="font-size:13px; color:var(--text-secondary); line-height:1.4;">${n.message}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--text-tertiary); margin-top:8px; font-weight:700;">
                Audience: ${n.target_role.toUpperCase()}
              </div>
            </div>
          `).join('')}
          ${notifs.length === 0 ? '<div style="text-align:center; padding:32px; color:var(--text-tertiary);">No notifications right now.</div>' : ''}
        </div>
      </div>
    </div>
  `;

  document.getElementById('close-notif-btn').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('notif-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'notif-backdrop') {
      modalContainer.innerHTML = '';
    }
  });
}
