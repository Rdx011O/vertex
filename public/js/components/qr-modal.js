/**
 * Vertex Dynamic E-Badge Component & QR Scanner System
 * Production-quality dynamic e-badge for Building Pravara 2026.
 * Features vector SVG technical grids, geometric Vertex marks, 3D tilt/flip interactions,
 * real-time security HUD telemetry, dynamic theme customization, and high-definition role-tailored credentials.
 */

import api from '../api.js';
import state from '../state.js';

/**
 * Returns Category Theming Class & Label
 */
function getCategoryTheming(category = '') {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('beverage')) {
    return { class: 'food', label: 'FOOD & BEVERAGE', accent: '#f97316' };
  }
  if (cat.includes('game') || cat.includes('gaming') || cat.includes('robotics')) {
    return { class: 'games', label: 'GAMES & TECH', accent: '#8b5cf6' };
  }
  if (cat.includes('sponsor') || cat.includes('partner')) {
    return { class: 'sponsor', label: 'BUSINESS × SPONSOR', accent: '#f59e0b' };
  }
  return { class: 'tech', label: (category || 'BUSINESS & INNOVATION').toUpperCase(), accent: '#06b6d4' };
}

/**
 * Generates the Complete Dynamic Vertex E-Badge HTML Structure (Front & Back Faces)
 */
export function generateVertexBadgeHTML(user, badgeData = null, options = { isModal: true, showLanyard: true, theme: null }) {
  const role = user.role || 'member';
  const roleTitle = role === 'admin' 
    ? 'EVENT OPERATIONS • ADMIN' 
    : (role === 'coordinator' ? 'STALL COORDINATOR' : 'STALL TEAM MEMBER');

  const badgeCode = badgeData?.badge_code || user.badge_code || 'BP-2026';
  const qrImageUrl = badgeData?.qr_image_url || user.qr_image_url;
  const stallName = badgeData?.stall?.name || user.stall_name || user.stall_name_desired || null;
  const stallCategory = badgeData?.stall?.category || user.stall_category_desired || 'Tech & Innovation';
  const boothNumber = badgeData?.stall?.allotted_number || user.stall_alloted_number || null;
  const collegeName = user.college_name || 'Pravara Rural Engineering College, Loni';
  const catTheme = getCategoryTheming(stallCategory);
  const initials = (user.name || 'VP').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  
  const savedTheme = options.theme || localStorage.getItem('vertex_badge_theme') || (role === 'admin' ? 'theme-cyber' : (role === 'coordinator' ? 'theme-gold' : 'theme-cobalt'));
  const showLanyard = options.showLanyard !== false;

  return `
    <div class="ebadge-perspective-wrapper" id="ebadge-card-container">
      
      <!-- Optional VIP Lanyard Ribbon & Clasp -->
      <div class="ebadge-lanyard-wrapper ${showLanyard ? '' : 'hidden'}" id="ebadge-lanyard-strap-box">
        <div class="ebadge-lanyard-strap"></div>
        <div class="ebadge-lanyard-clasp">
          <div class="ebadge-lanyard-ring"></div>
        </div>
      </div>

      <div class="ebadge-card-3d" id="ebadge-card-element">
        
        <!-- ── FRONT FACE: THE OFFICIAL HORIZONTAL E-BADGE ── -->
        <div class="ebadge-face ebadge-face-front ${savedTheme}" id="ebadge-front-side">
          <!-- Interactive Holographic Glare -->
          <div class="ebadge-glare" id="ebadge-glare-effect"></div>

          <!-- SVG Technical Blueprint Grid & Circuit Geometry -->
          <svg class="ebadge-bg-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="tech-grid-pat" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(99, 102, 241, 0.08)" stroke-width="1" />
                <circle cx="0" cy="0" r="1.5" fill="rgba(99, 102, 241, 0.25)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tech-grid-pat)" />
            <line x1="0" y1="45" x2="100%" y2="45" stroke="rgba(99, 102, 241, 0.15)" stroke-width="1" stroke-dasharray="4 4" />
          </svg>

          <!-- SVG Vertex Watermark Mark -->
          <svg class="ebadge-watermark-v" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,5 95,90 5,90" stroke="#4f46e5" stroke-width="4" stroke-linejoin="round" />
            <polygon points="50,25 80,80 20,80" fill="rgba(79, 70, 229, 0.1)" />
          </svg>

          <div class="ebadge-grid-layout">
            <!-- Left Panel: Identity, Branding & Assignment -->
            <div class="ebadge-left-panel">
              <!-- Top Branding Strip -->
              <div class="ebadge-brand-header">
                <div class="ebadge-brand-logo-wrap">
                  <div class="ebadge-v-logo-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 22 19 2 19" />
                      <line x1="12" y1="9" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <div class="ebadge-brand-title">BUILDING PRAVARA</div>
                    <div class="ebadge-brand-sub">VERTEX '26 • PREC LONI</div>
                  </div>
                </div>
                <div class="ebadge-edition-pill">
                  <span style="color:#10b981;">●</span> SECURE PASS
                </div>
              </div>

              <!-- Profile Monogram & Name -->
              <div class="ebadge-profile-section">
                <div class="ebadge-avatar-wrap">
                  <div class="ebadge-avatar-ring ${role}">
                    <span>${initials}</span>
                    <div class="ebadge-role-dot"></div>
                  </div>
                </div>
                <div class="ebadge-user-meta">
                  <div class="ebadge-user-name">${user.name || 'Participant'}</div>
                  <div class="ebadge-user-college">
                    <span>🏫</span>
                    <span>${collegeName}</span>
                  </div>
                  <div class="ebadge-role-badge-pill ${role}">
                    ${role === 'admin' ? '👑' : (role === 'coordinator' ? '⭐' : '👤')} ${roleTitle}
                  </div>
                </div>
              </div>

              <!-- Stall Assignment Card or Admin Ops Header -->
              ${role === 'admin' ? `
                <div class="ebadge-stall-card-box" style="background:rgba(99, 102, 241, 0.12); border-color:rgba(99, 102, 241, 0.35);">
                  <div>
                    <div class="ebadge-stall-title" style="color:var(--text-primary);">
                      <span>⚡</span>
                      <span>EVENT OPERATIONS & COMMAND CENTER</span>
                    </div>
                    <div class="ebadge-stall-sub">Full Event Verification & Ledger Authority</div>
                  </div>
                  <span class="ebadge-cat-tag" style="background:#e0e7ff; color:#3730a3;">EXECUTIVE</span>
                </div>
              ` : `
                <div class="ebadge-stall-card-box">
                  <div>
                    <div class="ebadge-stall-title">
                      <span>🏪</span>
                      <span>${stallName || 'Stall Assignment Pending'}</span>
                    </div>
                    <div class="ebadge-stall-sub">
                      ${boothNumber ? `Booth #${boothNumber} • ` : ''}Building Pravara Expo Pavilion
                    </div>
                  </div>
                  <span class="ebadge-cat-tag ${catTheme.class}">${catTheme.label}</span>
                </div>
              `}

              <!-- Micro Technical Footer & Live Clock -->
              <div class="ebadge-footer-strip">
                <span>MINDSET • INNOVATION • ENTREPRENEURSHIP</span>
                <span class="ebadge-live-clock-bar">
                  <span class="ebadge-clock-radar"></span>
                  <span id="ebadge-live-time">SYNC: --:--:--</span>
                </span>
              </div>
            </div>

            <!-- Right Panel: QR Security Vault -->
            <div class="ebadge-right-panel">
              <div style="font-family:var(--font-mono); font-size:10px; font-weight:800; color:var(--text-secondary); letter-spacing:0.12em; text-transform:uppercase;">
                OFFICIAL QR CREDENTIAL
              </div>

              <!-- High-Resolution Vector QR Box with Cyber Corner Brackets & Scanline -->
              <div class="ebadge-qr-frame" id="ebadge-qr-zoom-trigger" title="Click to enlarge QR for scanner">
                <div class="ebadge-scan-line"></div>
                <div class="ebadge-qr-corner tl"></div>
                <div class="ebadge-qr-corner tr"></div>
                <div class="ebadge-qr-corner bl"></div>
                <div class="ebadge-qr-corner br"></div>

                ${qrImageUrl ? `
                  <img src="${qrImageUrl}" alt="Event Badge QR" id="ebadge-qr-image-elem" />
                ` : `
                  <div style="width:152px; height:152px; display:flex; align-items:center; justify-content:center; background:#ffffff; font-size:11px; color:#64748b; text-align:center; padding:10px;">
                    Generating High-Res QR...
                  </div>
                `}
              </div>

              <!-- Badge ID & Status Line -->
              <div style="display:flex; flex-direction:column; align-items:center;">
                <div class="ebadge-code-strip">${badgeCode}</div>
                <div class="ebadge-status-line">
                  <div class="ebadge-status-dot-pulse"></div>
                  <span>ACTIVE CREDENTIAL</span>
                </div>
              </div>

              <!-- Micro Security Hash -->
              <div style="font-family:var(--font-mono); font-size:9px; color:#94a3b8; text-align:center;">
                AUTH: PREC-BP26-${badgeCode.slice(-4)} • TAP QR TO ENLARGE
              </div>
            </div>
          </div>
        </div>

        <!-- ── BACK FACE: SECURITY CLEARANCE & NFC / VENUE TERMS ── -->
        <div class="ebadge-face ebadge-face-back ${savedTheme}" id="ebadge-back-side">
          <div class="ebadge-mag-stripe"></div>

          <div class="ebadge-back-layout">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-family:var(--font-display); font-size:18px; font-weight:800; letter-spacing:0.05em; color:white;">
                  BUILDING PRAVARA 2026
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                  Official Credential ID: <strong style="color:white;">${badgeCode}</strong>
                </div>
              </div>
              
              <!-- Interactive Gold NFC Microchip -->
              <div class="ebadge-chip-sim" id="ebadge-nfc-chip-btn" title="Tap to simulate NFC Verification">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#78350f" stroke-width="1.8">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                  <line x1="7" y1="15" x2="7" y2="19" />
                  <line x1="17" y1="15" x2="17" y2="19" />
                </svg>
              </div>
            </div>

            <!-- Terms and Event Coordinates -->
            <div class="ebadge-back-terms">
              <p style="margin:0 0 6px 0; color:#cbd5e1;"><strong>EVENT ACCESS TERMS:</strong></p>
              <ul style="padding-left:16px; margin:0 0 10px 0; font-size:10px; color:#94a3b8; line-height:1.45;">
                <li>This badge is non-transferable and grants authorized festival admission.</li>
                <li>Stall personnel must present this badge QR at daily check-in for attendance.</li>
                <li>All sales transactions logged via Vertex ledger are subject to live verification.</li>
              </ul>
              <div style="display:flex; justify-content:space-between; font-size:10px; color:#cbd5e1; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
                <span>📍 PREC Loni Campus • 19.5843° N, 74.4533° E</span>
                <span>🚨 Control Desk: +91 (PREC-OPS)</span>
              </div>
            </div>

            <!-- Security Barcode & Timestamp -->
            <div>
              <div class="ebadge-back-barcode">
                || | | ||| | || |||| | | ||| || ||| | | |||| |||
              </div>
              <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:9px; color:#64748b; margin-top:6px;">
                <span>ISSUED: 2026-10-01</span>
                <span>ENCRYPTED FIREBASE VERIFIED</span>
                <span>STATUS: OPERATIONAL</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Initializes all 3D Tilt, Theme Switcher, Real-Time Clock, and Interactive Triggers
 */
export function initBadgeInteractivity(rootElement, user, badgeData) {
  if (!rootElement) return;

  const cardElement = rootElement.querySelector('#ebadge-card-element');
  const cardContainer = rootElement.querySelector('#ebadge-card-container');
  const glareEffect = rootElement.querySelector('#ebadge-glare-effect');
  const frontSide = rootElement.querySelector('#ebadge-front-side');
  const backSide = rootElement.querySelector('#ebadge-back-side');
  const liveTimeElem = rootElement.querySelector('#ebadge-live-time');

  // 1. Live Realtime Security Clock (updated every 250ms with live milliseconds)
  const updateClock = () => {
    if (!liveTimeElem || !document.body.contains(liveTimeElem)) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + Math.floor(now.getMilliseconds() / 100);
    liveTimeElem.textContent = `SYNC: ${timeStr}`;
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 250);

  // 2. 3D Mouse Tilt and Light Reflection
  if (cardContainer && cardElement) {
    cardContainer.addEventListener('mousemove', (e) => {
      const rect = cardContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      if (!cardElement.classList.contains('flipped')) {
        cardElement.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
      if (glareEffect) {
        glareEffect.style.background = `linear-gradient(${115 + rotateY * 2.5}deg, transparent 0%, rgba(255, 255, 255, 0.45) 30%, rgba(99, 102, 241, 0.3) 50%, rgba(255, 255, 255, 0.45) 70%, transparent 100%)`;
      }
    });

    cardContainer.addEventListener('mouseleave', () => {
      if (!cardElement.classList.contains('flipped')) {
        cardElement.style.transform = 'rotateX(0deg) rotateY(0deg)';
      }
    });
  }

  // 3. Flip Card Handler
  let isFlipped = false;
  const flipBtn = rootElement.querySelector('#btn-flip-badge');
  const flipToggle = () => {
    if (!cardElement) return;
    isFlipped = !isFlipped;
    if (isFlipped) {
      cardElement.classList.add('flipped');
      cardElement.style.transform = 'rotateY(180deg)';
      if (flipBtn) flipBtn.innerHTML = '🔄 Flip Badge (Front View)';
    } else {
      cardElement.classList.remove('flipped');
      cardElement.style.transform = 'rotateY(0deg)';
      if (flipBtn) flipBtn.innerHTML = '🔄 Flip Badge (Back View)';
    }
  };

  if (flipBtn) flipBtn.addEventListener('click', flipToggle);

  // 4. Theme Selector Swatches
  rootElement.querySelectorAll('.theme-swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      rootElement.querySelectorAll('.theme-swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (frontSide) {
        frontSide.className = `ebadge-face ebadge-face-front ${theme}`;
      }
      if (backSide) {
        backSide.className = `ebadge-face ebadge-face-back ${theme}`;
      }
      localStorage.setItem('vertex_badge_theme', theme);
    });
  });

  // 5. Lanyard Toggle
  const lanyardBtn = rootElement.querySelector('#btn-toggle-lanyard');
  const lanyardStrap = rootElement.querySelector('#ebadge-lanyard-strap-box');
  if (lanyardBtn && lanyardStrap) {
    lanyardBtn.addEventListener('click', () => {
      lanyardStrap.classList.toggle('hidden');
      lanyardBtn.innerHTML = lanyardStrap.classList.contains('hidden') ? '🎗️ Attach Lanyard Strap' : '🎗️ Hide Lanyard Strap';
    });
  }

  // 6. NFC Simulation
  const nfcChip = rootElement.querySelector('#ebadge-nfc-chip-btn');
  if (nfcChip) {
    nfcChip.addEventListener('click', () => {
      window.showToast?.('📡 NFC Chip Interrogated: Pass Cryptographically Validated!', 'success');
    });
  }

  // 7. QR Zoom Modal Trigger
  const qrZoomTrigger = rootElement.querySelector('#ebadge-qr-zoom-trigger');
  const qrImg = rootElement.querySelector('#ebadge-qr-image-elem');
  const qrUrl = qrImg ? qrImg.src : (badgeData?.qr_image_url || user.qr_image_url);
  const badgeCode = badgeData?.badge_code || user.badge_code || user.id;

  if (qrZoomTrigger && qrUrl) {
    qrZoomTrigger.addEventListener('click', () => {
      showQRZoomModal(qrUrl, badgeCode, user.name);
    });
  }

  // 8. Copy Badge ID
  rootElement.querySelector('#btn-copy-badge-id')?.addEventListener('click', () => {
    navigator.clipboard.writeText(badgeCode).then(() => {
      window.showToast?.(`Badge ID ${badgeCode} copied to clipboard!`, 'success');
    });
  });

  // 9. Print
  rootElement.querySelector('#btn-print-badge')?.addEventListener('click', () => {
    window.print();
  });

  return () => {
    clearInterval(clockInterval);
  };
}

/**
 * Fullscreen Gate Scan Viewfinder Modal for High-Distance Scanners
 */
export function showQRZoomModal(qrImageUrl, badgeCode, userName) {
  const existing = document.getElementById('qr-zoom-modal-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'qr-zoom-modal-container';
  container.innerHTML = `
    <div class="qr-zoom-backdrop" id="qr-zoom-backdrop">
      <div class="qr-zoom-card">
        <button id="close-qr-zoom-btn" style="position:absolute; top:14px; right:14px; background:#f1f5f9; border:none; border-radius:50%; width:32px; height:32px; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
        
        <div style="font-size:11px; font-weight:800; color:#6366f1; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:4px;">
          BUILDING PRAVARA '26 GATE SCAN
        </div>
        <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:12px;">
          ${userName || 'Participant'}
        </div>

        <div style="background:#ffffff; padding:14px; border-radius:16px; border:2px solid #0f172a; display:inline-block; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
          <img src="${qrImageUrl}" alt="Enlarged QR" style="width:260px; height:260px; display:block;" />
        </div>

        <div style="font-family:var(--font-mono); font-size:15px; font-weight:800; color:#0f172a; letter-spacing:0.15em; margin-top:12px;">
          ${badgeCode}
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:4px;">
          Optimized high-contrast barcode for long-range optical scanners
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const closeZoom = () => container.remove();
  document.getElementById('close-qr-zoom-btn')?.addEventListener('click', closeZoom);
  document.getElementById('qr-zoom-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'qr-zoom-backdrop') closeZoom();
  });
}

/**
 * Display User's Unique QR Badge Credential Modal (Full Dynamic 3D E-Badge)
 */
export async function showQRModal(user) {
  if (!user) return;

  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  // Show quick skeleton while loading badge from server
  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="qr-modal-backdrop">
      <div class="modal-card" style="max-width: 820px; padding: 0; background: transparent; border: none; box-shadow: none;">
        <div style="background:var(--bg-surface); padding:36px; border-radius:var(--radius-xl); text-align:center; box-shadow:0 25px 50px rgba(0,0,0,0.25);">
          <div style="font-size:32px; margin-bottom:12px; color:var(--primary);"><i data-lucide="sparkles"></i></div>
          <div style="font-size:18px; font-weight:800; color:var(--text-primary);">Rendering Dynamic Vertex E-Badge...</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Fetching encrypted cryptographic QR credential...</div>
        </div>
      </div>
    </div>
  `;
  window.renderIcons?.();

  let badgeData = null;
  try {
    badgeData = await api.getQRBadge(user.id);
  } catch (err) {
    console.warn('Failed to fetch remote QR badge, falling back to local user state:', err);
  }

  const badgeHTML = generateVertexBadgeHTML(user, badgeData, { isModal: true });
  const activeTheme = localStorage.getItem('vertex_badge_theme') || (user.role === 'admin' ? 'theme-cyber' : (user.role === 'coordinator' ? 'theme-gold' : 'theme-cobalt'));

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="qr-modal-backdrop">
      <div class="modal-card" style="max-width: 820px; padding: 0; background: transparent; border: none; box-shadow: none;">
        
        <!-- Action Control Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:#4f46e5; color:white; font-size:11px; padding:4px 10px; font-weight:800;">
              <i data-lucide="shield-check"></i> OFFICIAL PASS
            </span>
            <span style="font-size:12px; color:white; opacity:0.9;">Move cursor to 3D tilt • Tap QR to zoom • Flip for NFC back</span>
          </div>
          <button class="modal-close-btn" id="close-qr-btn" style="color:white; background:rgba(255,255,255,0.2); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;"><i data-lucide="x"></i></button>
        </div>

        <!-- Rendered 3D Badge -->
        ${badgeHTML}

        <!-- Dynamic Theme Swatch Switcher -->
        <div class="ebadge-theme-selector">
          <span style="font-size:11px; font-weight:700; color:white; margin-right:4px;">THEME SKIN:</span>
          <button class="theme-swatch-btn cyber ${activeTheme === 'theme-cyber' ? 'active' : ''}" data-theme="theme-cyber" title="Obsidian Cyber (Dark VIP)"></button>
          <button class="theme-swatch-btn holo ${activeTheme === 'theme-holo' ? 'active' : ''}" data-theme="theme-holo" title="Prism Holo (Iridescent)"></button>
          <button class="theme-swatch-btn gold ${activeTheme === 'theme-gold' ? 'active' : ''}" data-theme="theme-gold" title="Solar Gold (Executive)"></button>
          <button class="theme-swatch-btn cobalt ${activeTheme === 'theme-cobalt' ? 'active' : ''}" data-theme="theme-cobalt" title="Cobalt Tech (PREC Sapphire)"></button>
        </div>

        <!-- Interactive Control Toolbar -->
        <div style="display:flex; justify-content:center; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn btn-outline" id="btn-flip-badge" style="background:white; color:#0f172a; font-size:13px; font-weight:700; padding:8px 18px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
            <i data-lucide="rotate-cw"></i> Flip Badge (Back View)
          </button>
          <button class="btn btn-outline" id="btn-toggle-lanyard" style="background:rgba(255,255,255,0.2); color:white; font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; border-color:rgba(255,255,255,0.4);">
            <i data-lucide="tag"></i> Toggle Lanyard Strap
          </button>
          <button class="btn btn-outline" id="btn-print-badge" style="background:rgba(255,255,255,0.2); color:white; font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; border-color:rgba(255,255,255,0.4);">
            <i data-lucide="printer"></i> Print Lanyard Pass
          </button>
          <button class="btn btn-outline" id="btn-copy-badge-id" style="background:rgba(255,255,255,0.2); color:white; font-size:13px; font-weight:700; padding:8px 16px; border-radius:10px; border-color:rgba(255,255,255,0.4);">
            <i data-lucide="copy"></i> Copy Pass ID
          </button>
        </div>

      </div>
    </div>
  `;
  window.renderIcons?.();

  // Attach Close handlers
  document.getElementById('close-qr-btn')?.addEventListener('click', () => modalContainer.innerHTML = '');
  document.getElementById('qr-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal-backdrop') modalContainer.innerHTML = '';
  });

  // Attach interactivity
  initBadgeInteractivity(modalContainer, user, badgeData);
}

/**
 * Live Camera & Manual Badge QR Scanner Modal
 */
let html5QrCodeScanner = null;

export function showQRScannerModal({ onScanSuccess, title = 'Scan Participant Badge QR', hint = 'Point camera at member or coordinator badge QR' } = {}) {
  const modalContainer = document.getElementById('qr-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="scanner-modal-backdrop">
      <div class="modal-card" style="max-width: 480px; padding: 22px;">
        <div class="modal-header" style="margin-bottom:12px;">
          <h3 style="font-size:18px;"><i data-lucide="scan"></i> ${title}</h3>
          <button class="modal-close-btn" id="close-scanner-btn"><i data-lucide="x"></i></button>
        </div>

        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:14px;">
          ${hint}
        </div>

        <!-- Camera Scanner Viewport -->
        <div id="qr-reader" style="width:100%; min-height:250px; background:#0f172a; border-radius:var(--radius-md); overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">
          <div style="color:white; font-size:13px; text-align:center; padding:20px;" id="camera-loading-msg">
            <i data-lucide="camera" style="margin-bottom:6px;"></i><br>
            Initializing Camera Feed...<br>
            <span style="font-size:11px; opacity:0.7;">Please allow camera permissions if prompted.</span>
          </div>
        </div>

        <!-- Manual Fallback Entry -->
        <div style="margin-top:16px; border-top:1px solid var(--border-subtle); padding-top:14px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:6px; color:var(--text-secondary);">OR Enter Badge / QR Code Manually:</div>
          <form id="manual-scan-form" style="display:flex; gap:8px;">
            <input type="text" id="manual-badge-input" class="pos-input" placeholder="e.g. MBR-1234 / COORD-5678 / VERTEX:..." style="flex:1;" required />
            <button type="submit" class="btn btn-admin" style="padding:0 16px;">
              <i data-lucide="check-circle-2"></i> Verify
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
  window.renderIcons?.();

  const stopScanner = async () => {
    if (html5QrCodeScanner) {
      try {
        await html5QrCodeScanner.stop();
        html5QrCodeScanner.clear();
      } catch (_) {}
      html5QrCodeScanner = null;
    }
    modalContainer.innerHTML = '';
  };

  document.getElementById('close-scanner-btn')?.addEventListener('click', stopScanner);
  document.getElementById('scanner-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'scanner-modal-backdrop') stopScanner();
  });

  const handleScanResult = async (decodedText) => {
    await stopScanner();
    try {
      const res = await api.scanConfirmAttendance(decodedText);
      window.showToast(res.message || 'Attendance verified & confirmed!', 'success');
      await state.refreshAll();
      if (onScanSuccess) onScanSuccess(res);
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  };

  // Manual input form submission
  document.getElementById('manual-scan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('manual-badge-input').value;
    if (input) {
      await handleScanResult(input);
    }
  });

  // Start Html5Qrcode if available in browser
  if (window.Html5Qrcode) {
    try {
      html5QrCodeScanner = new window.Html5Qrcode("qr-reader");
      const config = { fps: 10, qrbox: { width: 220, height: 220 } };

      html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanResult(decodedText);
        },
        () => {
          // Frame error (silent)
        }
      ).catch(err => {
        console.warn('Camera stream error:', err);
        const readerElem = document.getElementById('qr-reader');
        if (readerElem) {
          readerElem.innerHTML = `
            <div style="color:#f87171; font-size:12px; text-align:center; padding:24px;">
              📷 Camera access unavailable or blocked.<br>
              <span style="color:var(--text-tertiary); font-size:11px;">Please use the manual badge entry below.</span>
            </div>
          `;
        }
      });
    } catch (err) {
      console.warn('Could not launch Html5Qrcode:', err);
    }
  } else {
    const readerElem = document.getElementById('qr-reader');
    if (readerElem) {
      readerElem.innerHTML = `
        <div style="color:white; font-size:12px; text-align:center; padding:24px;">
          📷 Live camera scanner ready.<br>
          <span style="color:var(--text-tertiary); font-size:11px;">Type or paste the badge code below to verify attendance.</span>
        </div>
      `;
    }
  }
}
