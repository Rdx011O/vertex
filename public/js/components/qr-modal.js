/**
 * QR Code Generator & Lanyard Badge Modal Component
 * Generates pure vector SVG QR code representation for user badges.
 */

// Simple lightweight SVG QR Matrix generator (deterministic visual QR representation)
function generateSVGQRCode(data, size = 180) {
  // A clean QR matrix layout with standard finder patterns
  const modules = 21;
  const cellSize = size / modules;
  
  // Deterministic pseudo-random hash from string data
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }

  let rects = '';

  // 1. Finder patterns at (0,0), (14,0), (0,14)
  const drawFinder = (startX, startY) => {
    // Outer 7x7
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          const x = (startX + c) * cellSize;
          const y = (startY + r) * cellSize;
          rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(14, 0);
  drawFinder(0, 14);

  // 2. Timing lines
  for (let i = 8; i < 13; i++) {
    if (i % 2 === 0) {
      rects += `<rect x="${i * cellSize}" y="${6 * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
      rects += `<rect x="${6 * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
    }
  }

  // 3. Data area fill based on hash
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      // Skip finder zones
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      if (r === 6 || c === 6) continue;

      const bit = ((hash ^ (r * 31 + c * 17)) & (1 << ((r + c) % 8))) !== 0;
      if (bit) {
        const x = c * cellSize;
        const y = r * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">${rects}</svg>`;
}

export function showQRModal(user) {
  if (!user) return;

  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  const qrSvg = generateSVGQRCode(`VERTEX:USER:${user.id}:${user.badge_code}`);
  const roleClass = user.role;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="qr-modal-backdrop">
      <div class="modal-card" style="max-width: 400px; padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="badge-credential-card">
          <div class="badge-lanyard-hole"></div>
          
          <div class="badge-header-strip ${roleClass}">
            <button class="modal-close-btn" id="close-qr-btn" style="position: absolute; right: 12px; top: 12px; color: white;">✕</button>
            <div class="badge-event-title">Building Pravara '26</div>
            <div class="badge-event-subtitle">Pravara Rural Engineering College, Loni</div>
          </div>

          <div class="badge-body">
            <div class="badge-qr-box">
              ${qrSvg}
            </div>

            <div class="badge-user-name">${user.name}</div>
            <div class="badge-user-role-tag ${roleClass}">${user.role.toUpperCase()}</div>
            
            <div class="badge-stall-name">
              ${user.stall_name ? `📍 ${user.stall_name}` : '🏛️ Event Operations Headquarters'}
            </div>

            <div class="badge-code-display">${user.badge_code || user.id}</div>
          </div>

          <div class="badge-footer-security">
            <span>🔒 VERIFIED EVENT CREDENTIAL • NON-TRANSFERABLE</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('close-qr-btn').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });

  document.getElementById('qr-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal-backdrop') {
      modalContainer.innerHTML = '';
    }
  });
}
