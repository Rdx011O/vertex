/**
 * Login / Sign-up / Forgot-Password View Component
 * Modern, rich glassmorphism UI with interactive role selection and password toggles.
 * Handles email/password auth via Firebase SDK.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from '../firebase.js';
import api from '../api.js';
import state from '../state.js';

// 10 colleges for the dropdown
const COLLEGE_LIST = [
  'Pravara Rural Engineering College, Loni',
  'Pravara Rural College of Architecture, Loni',
  'Pravara Rural Polytechnic, Loni',
  'Amrutvahini College of Engineering, Sangamner',
  'Sanjivani College of Engineering, Kopargaon',
  'Matoshri College of Engineering, Nashik',
  'SVERI\'s College of Engineering, Pandharpur',
  'MAEER\'s MIT College of Engineering, Pune',
  'Government College of Engineering, Aurangabad',
  'Deogiri Institute of Engineering and Management Studies, Aurangabad'
];

const STALL_CATEGORIES = [
  { value: 'food', label: '🍕 Food & Beverage' },
  { value: 'game', label: '🎮 Gaming & Fun Arena' },
  { value: 'business', label: '💼 Commercial & Startup' },
  { value: 'business_with_sponsorship', label: '🤝 Business with Sponsorship' },
  { value: 'robotics', label: '🤖 Robotics & Tech Lab' },
  { value: 'merchandise', label: '👕 Merchandise & Crafts' }
];

export function renderLoginView(container, firebaseAuth, onSuccess) {
  container.innerHTML = `
    <div class="login-page">
      <!-- Ambient background decoration glow -->
      <div class="auth-bg-blob blob-1"></div>
      <div class="auth-bg-blob blob-2"></div>
      <div class="auth-bg-blob blob-3"></div>

      <div class="login-card" id="auth-card">
        
        <!-- Brand Header -->
        <div class="login-brand">
          <div class="login-logo-wrapper">
            <div class="login-logo">V</div>
            <div class="login-logo-glow"></div>
          </div>
          <div class="login-brand-text">
            <div class="login-title">VERTEX <span class="badge-tag-bp">BP'26</span></div>
            <div class="login-subtitle">Building Pravara 2026 · PREC Loni</div>
          </div>
        </div>

        <!-- Segmented Tab Switcher -->
        <div class="login-tabs-container">
          <div class="login-tabs" id="auth-tabs">
            <button type="button" class="login-tab active" id="tab-signin" data-tab="signin">
              <span>Sign In</span>
            </button>
            <button type="button" class="login-tab" id="tab-signup" data-tab="signup">
              <span>Create Account</span>
            </button>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Sign In Form                                           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <form id="signin-form" class="auth-form active" novalidate>
          <div class="auth-form-intro">
            <h3>Welcome Back</h3>
            <p>Access your live festival operations dashboard, stall POS & ledger</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="signin-email">
              <span class="label-icon"><i data-lucide="mail"></i></span> Registered Email
            </label>
            <div class="input-with-icon">
              <input type="email" id="signin-email" class="form-input" placeholder="name@example.com" autocomplete="email" required />
            </div>
          </div>

          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="signin-password">
                <span class="label-icon"><i data-lucide="lock"></i></span> Password
              </label>
              <a href="#" id="forgot-password-link" class="forgot-link">Forgot?</a>
            </div>
            <div class="input-with-toggle">
              <input type="password" id="signin-password" class="form-input" placeholder="Enter your password" autocomplete="current-password" required />
              <button type="button" class="password-toggle-btn" data-target="signin-password" title="Toggle password visibility">
                <i data-lucide="eye"></i>
              </button>
            </div>
          </div>

          <div id="signin-error" class="auth-error" style="display:none;"></div>

          <button type="submit" class="btn btn-primary btn-full auth-submit-btn" id="signin-btn">
            <span id="signin-btn-text">Sign In to Vertex →</span>
          </button>

          <div class="auth-helper-cards">
            <div class="helper-mini-badge">
              <span><i data-lucide="shield-check"></i> Admins: Central Control</span>
            </div>
            <div class="helper-mini-badge">
              <span><i data-lucide="briefcase"></i> Coordinators: Live Stall POS</span>
            </div>
          </div>
        </form>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Sign Up Form                                           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <form id="signup-form" class="auth-form" novalidate>
          <div class="auth-form-intro">
            <h3>Join Building Pravara '26</h3>
            <p>Register as an Admin, Stall Coordinator, or Member</p>
          </div>

          <!-- Step 1: Interactive Role Picker Cards -->
          <div class="form-group">
            <label class="form-label">
              <span class="label-icon"><i data-lucide="user-check"></i></span> Select Your Role <span class="required">*</span>
            </label>
            <div class="role-selector-grid" id="role-selector-cards">
              <div class="role-card-opt" data-role="coordinator">
                <div class="role-card-icon"><i data-lucide="briefcase"></i></div>
                <div class="role-card-title">Coordinator</div>
                <div class="role-card-desc">Lead a Stall & Team</div>
              </div>
              <div class="role-card-opt" data-role="member">
                <div class="role-card-icon"><i data-lucide="user"></i></div>
                <div class="role-card-title">Member</div>
                <div class="role-card-desc">POS Counter & Sales</div>
              </div>
              <div class="role-card-opt" data-role="admin">
                <div class="role-card-icon"><i data-lucide="shield-check"></i></div>
                <div class="role-card-title">Admin</div>
                <div class="role-card-desc">Event Operations</div>
              </div>
            </div>
            <input type="hidden" id="signup-role" value="coordinator" />
          </div>

          <!-- Personal Info Group -->
          <div class="signup-section-header">
            <span><i data-lucide="user"></i> Personal Details</span>
          </div>

          <div class="grid-2col">
            <div class="form-group">
              <label class="form-label" for="signup-name">Full Name <span class="required">*</span></label>
              <input type="text" id="signup-name" class="form-input" placeholder="e.g. Aarav Sharma" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-username">Username <span class="required">*</span></label>
              <input type="text" id="signup-username" class="form-input" placeholder="e.g. aarav_s" required />
            </div>
          </div>

          <div class="grid-2col">
            <div class="form-group">
              <label class="form-label" for="signup-email">Email <span class="required">*</span></label>
              <input type="email" id="signup-email" class="form-input" placeholder="name@example.com" autocomplete="email" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-phone">Phone Number</label>
              <input type="tel" id="signup-phone" class="form-input" placeholder="+91 98000 00000" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-college">College / Institute <span class="required">*</span></label>
            <select id="signup-college" class="form-input" required>
              <option value="">— Select your college —</option>
              ${COLLEGE_LIST.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>

          <!-- Coordinator Stall Fields (Dynamic) -->
          <div id="coordinator-stall-fields" class="dynamic-role-box">
            <div class="signup-section-header">
              <span><i data-lucide="store"></i> Stall Information</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-stall-name">Stall Name <span class="required">*</span></label>
              <input type="text" id="signup-stall-name" class="form-input" placeholder="e.g. Flavors of Pravara / RoboWars" />
              <span class="form-hint">Name of your festival booth</span>
            </div>
            <div class="grid-2col">
              <div class="form-group">
                <label class="form-label" for="signup-stall-category">Category <span class="required">*</span></label>
                <select id="signup-stall-category" class="form-input">
                  <option value="">— Select category —</option>
                  ${STALL_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="signup-stall-number">Booth / Stall # <span class="required">*</span></label>
                <input type="text" id="signup-stall-number" class="form-input" placeholder="e.g. S-07 / A-12" />
              </div>
            </div>
          </div>

          <!-- Member Invite Code Field & Live Verification Widget (Dynamic) -->
          <div id="member-stall-code-field" class="dynamic-role-box" style="display:none;">
            <div class="signup-section-header">
              <span><i data-lucide="key"></i> Stall Member Verification</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-member-code">
                Stall Invite Code <span class="required">*</span>
                <span class="form-hint-inline">(12-character passcode from your Coordinator)</span>
              </label>
              <div class="code-verify-input-group">
                <input type="text" id="signup-member-code" class="form-input invite-code-input" placeholder="e.g. Vk9$mX2#pL8Q" maxlength="20" autocomplete="off" />
                <button type="button" class="btn btn-primary" id="btn-verify-member-code" style="white-space:nowrap; padding:0 18px; font-weight:700;">
                  <span id="btn-verify-code-text">Verify Code</span>
                </button>
              </div>
              <span class="form-hint">Enter your stall's invite code and tap Verify to preview and confirm your stall.</span>
            </div>

            <!-- Dynamic Verification Result / Confirmation Box -->
            <div id="stall-verification-box" style="display:none;"></div>
          </div>

          <!-- Admin Info Box (Dynamic) -->
          <div id="admin-info-field" class="dynamic-role-box" style="display:none;">
            <div class="admin-notice-pill">
              <i data-lucide="shield-check"></i> <strong>Event Admin Operations:</strong> Direct access for organizing committee and operations leads.
            </div>
          </div>

          <!-- Password Group -->
          <div class="signup-section-header">
            <span><i data-lucide="lock"></i> Security</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-password">Create Password <span class="required">*</span></label>
            <div class="input-with-toggle">
              <input type="password" id="signup-password" class="form-input" placeholder="At least 6 characters" autocomplete="new-password" required minlength="6" />
              <button type="button" class="password-toggle-btn" data-target="signup-password" title="Toggle password visibility">
                <i data-lucide="eye"></i>
              </button>
            </div>
          </div>

          <div id="signup-error" class="auth-error" style="display:none;"></div>

          <button type="submit" class="btn btn-primary btn-full auth-submit-btn" id="signup-btn">
            <span id="signup-btn-text">Create Account & Enter →</span>
          </button>
        </form>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Forgot Password View                                   -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <div id="forgot-password-view" style="display:none;">
          <div class="auth-form-intro">
            <h3><i data-lucide="key"></i> Reset Password</h3>
            <p>Enter your email and we'll send you an instant reset link.</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="forgot-email">Registered Email</label>
            <input type="email" id="forgot-email" class="form-input" placeholder="name@example.com" autocomplete="email" />
          </div>

          <div id="forgot-error" class="auth-error" style="display:none;"></div>
          <div id="forgot-success" class="auth-success" style="display:none;"></div>

          <div style="display:flex; gap:10px; margin-top:16px;">
            <button type="button" class="btn btn-primary" id="forgot-send-btn" style="flex:1;">
              <span id="forgot-btn-text">Send Reset Link</span>
            </button>
            <button type="button" class="btn btn-outline" id="forgot-back-btn">← Back</button>
          </div>
        </div>

        <div class="login-footer">
          <span class="security-tag"><i data-lucide="shield"></i> Secured with Firebase Authentication</span>
        </div>
      </div>
    </div>
  `;

  // ── Tab switching ──────────────────────────────────────────────────
  container.querySelectorAll('.login-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const targetForm = document.getElementById(`${tab}-form`);
      if (targetForm) targetForm.classList.add('active');
      document.getElementById('forgot-password-view').style.display = 'none';
      document.getElementById('auth-tabs').style.display = '';
    });
  });

  // ── Password Visibility Toggle ──────────────────────────────────────
  container.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🔒';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      }
    });
  });

  // ── Interactive Role Card Selection ────────────────────────────────
  const roleCards = container.querySelectorAll('.role-card-opt');
  const roleHiddenInput = document.getElementById('signup-role');
  const stallFields = document.getElementById('coordinator-stall-fields');
  const memberCodeField = document.getElementById('member-stall-code-field');
  const adminInfoField = document.getElementById('admin-info-field');

  // Set initial selected state
  if (roleCards.length > 0) {
    roleCards[0].classList.add('active');
  }

  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const selectedRole = card.dataset.role;
      if (roleHiddenInput) roleHiddenInput.value = selectedRole;

      if (stallFields) stallFields.style.display = selectedRole === 'coordinator' ? 'block' : 'none';
      if (memberCodeField) memberCodeField.style.display = selectedRole === 'member' ? 'block' : 'none';
      if (adminInfoField) adminInfoField.style.display = selectedRole === 'admin' ? 'block' : 'none';
    });
  });

  // ── Forgot Password link ───────────────────────────────────────────
  document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signin-form').classList.remove('active');
    document.getElementById('auth-tabs').style.display = 'none';
    document.getElementById('forgot-password-view').style.display = 'block';
  });

  // ── Forgot Password back button ────────────────────────────────────
  document.getElementById('forgot-back-btn')?.addEventListener('click', () => {
    document.getElementById('forgot-password-view').style.display = 'none';
    document.getElementById('auth-tabs').style.display = '';
    document.getElementById('signin-form').classList.add('active');
    document.getElementById('tab-signin').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('signup-form').classList.remove('active');
  });

  // ── Forgot Password submit ─────────────────────────────────────────
  document.getElementById('forgot-send-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    const btn = document.getElementById('forgot-send-btn');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) {
      showError(errorEl, 'Please enter your email address.');
      return;
    }

    btn.disabled = true;
    document.getElementById('forgot-btn-text').textContent = 'Sending…';

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      successEl.textContent = `✅ Password reset email sent to ${email}. Check your inbox (and spam folder).`;
      successEl.style.display = 'block';
      document.getElementById('forgot-email').value = '';
    } catch (err) {
      showError(errorEl, friendlyFirebaseError(err.code) || err.message);
    } finally {
      btn.disabled = false;
      document.getElementById('forgot-btn-text').textContent = 'Send Reset Link';
    }
  });

  // ── Sign In ────────────────────────────────────────────────────────
  document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const errorEl = document.getElementById('signin-error');
    const btn = document.getElementById('signin-btn');

    errorEl.style.display = 'none';

    if (!email || !password) {
      showError(errorEl, 'Please enter both email and password.');
      return;
    }

    btn.disabled = true;
    document.getElementById('signin-btn-text').textContent = 'Signing in…';

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      // Immediately set token provider & bootstrap user profile
      api.setTokenProvider(() => userCredential.user.getIdToken(false));
      await state.onFirebaseAuth(userCredential.user);
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      errorEl.textContent = friendlyFirebaseError(err.code) || err.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('signin-btn-text').textContent = 'Sign In to Vertex →';
    }
  });

  // ── Member Stall Code Live Verification ───────────────────────────
  let confirmedMemberStall = null;
  let confirmedMemberCode = '';

  const memberCodeInput = document.getElementById('signup-member-code');
  const verifyCodeBtn = document.getElementById('btn-verify-member-code');
  const verifyBox = document.getElementById('stall-verification-box');

  async function performStallVerification() {
    const rawCode = memberCodeInput?.value.trim();
    if (!rawCode) {
      if (verifyBox) {
        verifyBox.style.display = 'block';
        verifyBox.innerHTML = `
          <div class="stall-verify-card verified-error-box">
            <div class="error-msg-row">
              <i data-lucide="alert-circle"></i>
              <span>Please enter a 12-character stall invite code.</span>
            </div>
          </div>
        `;
        window.renderIcons?.();
      }
      return null;
    }

    if (verifyCodeBtn) {
      verifyCodeBtn.disabled = true;
      const textSpan = document.getElementById('btn-verify-code-text');
      if (textSpan) textSpan.textContent = 'Verifying…';
    }

    try {
      const res = await api.verifyStallCode(rawCode);
      if (verifyBox && res.valid && res.stall) {
        const stall = res.stall;
        verifyBox.style.display = 'block';
        verifyBox.innerHTML = `
          <div class="stall-verify-card verified-prompt-box">
            <div class="verify-top-row">
              <span class="verify-status-badge success">
                <i data-lucide="check-circle-2"></i> Stall Found
              </span>
              <span class="verify-category-tag">${stall.category || 'Festival Stall'}</span>
            </div>
            
            <div class="verify-stall-name-hero">${stall.name}</div>
            
            <div class="verify-meta-row">
              ${stall.allotted_number ? `<span class="meta-item"><i data-lucide="map-pin"></i> Booth #${stall.allotted_number}</span>` : ''}
              ${stall.location ? `<span class="meta-item"><i data-lucide="compass"></i> ${stall.location}</span>` : ''}
              ${stall.coordinator_name ? `<span class="meta-item"><i data-lucide="user"></i> Lead: <strong>${stall.coordinator_name}</strong></span>` : ''}
            </div>

            <div class="verify-question-box">
              <div class="question-title">Is that your stall?</div>
              <div class="question-actions">
                <button type="button" class="btn btn-success btn-sm" id="btn-confirm-stall-yes">
                  <i data-lucide="check"></i> Yes, This is My Stall
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-change-stall-code">
                  <i data-lucide="refresh-cw"></i> Change Code
                </button>
              </div>
            </div>
          </div>
        `;
        window.renderIcons?.();

        // Bind Yes & Change actions
        document.getElementById('btn-confirm-stall-yes')?.addEventListener('click', () => {
          confirmedMemberStall = stall;
          confirmedMemberCode = rawCode;
          if (memberCodeInput) memberCodeInput.disabled = true;
          if (verifyCodeBtn) verifyCodeBtn.style.display = 'none';

          verifyBox.innerHTML = `
            <div class="stall-verify-card verified-confirmed-box">
              <div class="confirmed-header">
                <div class="confirmed-check-icon"><i data-lucide="shield-check"></i></div>
                <div class="confirmed-info">
                  <div class="confirmed-title">Stall Verified & Connected</div>
                  <div class="confirmed-stall-name">${stall.name}</div>
                </div>
                <button type="button" class="btn btn-outline btn-sm" id="btn-change-stall-code-confirmed" style="font-size:12px; padding:4px 10px;">
                  Change
                </button>
              </div>
              <div class="confirmed-footer-hint">
                <i data-lucide="sparkles"></i> You will directly enter this stall as a verified member upon sign-up.
              </div>
            </div>
          `;
          window.renderIcons?.();

          document.getElementById('btn-change-stall-code-confirmed')?.addEventListener('click', () => {
            resetVerification();
          });
        });

        document.getElementById('btn-change-stall-code')?.addEventListener('click', () => {
          resetVerification();
        });

        return stall;
      }
    } catch (err) {
      if (verifyBox) {
        verifyBox.style.display = 'block';
        verifyBox.innerHTML = `
          <div class="stall-verify-card verified-error-box">
            <div class="error-msg-row">
              <i data-lucide="alert-triangle"></i>
              <span>${err.message || 'Invalid stall invite code. Please check with your Coordinator.'}</span>
            </div>
          </div>
        `;
        window.renderIcons?.();
      }
      return null;
    } finally {
      if (verifyCodeBtn) {
        verifyCodeBtn.disabled = false;
        const textSpan = document.getElementById('btn-verify-code-text');
        if (textSpan) textSpan.textContent = 'Verify Code';
      }
    }
  }

  function resetVerification() {
    confirmedMemberStall = null;
    confirmedMemberCode = '';
    if (memberCodeInput) {
      memberCodeInput.disabled = false;
      memberCodeInput.value = '';
      memberCodeInput.focus();
    }
    if (verifyCodeBtn) {
      verifyCodeBtn.style.display = '';
      verifyCodeBtn.disabled = false;
      const textSpan = document.getElementById('btn-verify-code-text');
      if (textSpan) textSpan.textContent = 'Verify Code';
    }
    if (verifyBox) {
      verifyBox.style.display = 'none';
      verifyBox.innerHTML = '';
    }
  }

  verifyCodeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    performStallVerification();
  });

  memberCodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performStallVerification();
    }
  });

  // ── Sign Up ────────────────────────────────────────────────────────
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username     = document.getElementById('signup-username').value.trim();
    const name         = document.getElementById('signup-name').value.trim();
    const email        = document.getElementById('signup-email').value.trim();
    const phone        = document.getElementById('signup-phone').value.trim();
    const college      = document.getElementById('signup-college').value;
    const desiredRole  = document.getElementById('signup-role')?.value || 'coordinator';
    const password     = document.getElementById('signup-password').value;
    const errorEl      = document.getElementById('signup-error');
    const btn          = document.getElementById('signup-btn');

    // Coordinator-specific fields
    const stallName     = document.getElementById('signup-stall-name')?.value.trim() || '';
    const stallCategory = document.getElementById('signup-stall-category')?.value || '';
    const stallNumber   = document.getElementById('signup-stall-number')?.value.trim() || '';
    // Member-specific fields
    const memberCode    = document.getElementById('signup-member-code')?.value.trim() || '';

    errorEl.style.display = 'none';

    // Validate
    if (!username) { showError(errorEl, 'Please enter a username.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError(errorEl, 'Username can only contain letters, numbers and underscores.'); return; }
    if (!name) { showError(errorEl, 'Please enter your full name.'); return; }
    if (!email) { showError(errorEl, 'Please enter your email.'); return; }
    if (!college) { showError(errorEl, 'Please select your college.'); return; }
    if (!desiredRole) { showError(errorEl, 'Please select your role.'); return; }
    
    if (desiredRole === 'coordinator') {
      if (!stallName) { showError(errorEl, 'Please enter your stall name.'); return; }
      if (!stallCategory) { showError(errorEl, 'Please select your stall category.'); return; }
      if (!stallNumber) { showError(errorEl, 'Please enter your stall booth number.'); return; }
    }

    if (desiredRole === 'member') {
      if (!confirmedMemberStall) {
        const rawCode = memberCodeInput?.value.trim();
        if (rawCode) {
          const verified = await performStallVerification();
          if (!verified) {
            showError(errorEl, 'Please verify your Stall Invite Code before proceeding.');
            return;
          }
          confirmedMemberStall = verified;
          confirmedMemberCode = rawCode;
        } else {
          showError(errorEl, 'Please enter and verify your 12-character Stall Invite Code to join your stall.');
          return;
        }
      }
    }
    
    if (password.length < 6) { showError(errorEl, 'Password must be at least 6 characters.'); return; }

    state.isRegistering = true;
    btn.disabled = true;
    document.getElementById('signup-btn-text').textContent = 'Creating account…';

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      // 2. Set display name in Firebase Auth
      await updateProfile(userCredential.user, { displayName: name });

      // 3. Set token provider
      api.setTokenProvider(() => userCredential.user.getIdToken(true));

      // 4. Register profile in our DB
      const res = await api.registerProfile(name, phone, desiredRole, {
        username,
        college_name: college,
        stall_name_desired: stallName || null,
        stall_category_desired: stallCategory || null,
        stall_alloted_number: stallNumber || null,
        stall_id: confirmedMemberStall ? confirmedMemberStall.id : null,
        invite_code: confirmedMemberCode || memberCode || null,
        stall_code: confirmedMemberCode || memberCode || null
      });

      // 5. Update state and render appropriate dashboard directly
      state.currentUser = res.user;
      api.setTokenProvider(() => userCredential.user.getIdToken(false));
      try { await state.refreshAll(); } catch (_) {}
      state.isRegistering = false;
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      state.isRegistering = false;
      const msg = err.code ? (friendlyFirebaseError(err.code) || err.message) : err.message;
      showError(errorEl, msg || 'Sign up failed. Please try again.');
      btn.disabled = false;
      document.getElementById('signup-btn-text').textContent = 'Create Account & Enter →';
    }
  });
}

/** "Join Stall" screen shown only to Stall Members who need to join their booth */
export function renderPendingApprovalView(container, user, onSignOut) {
  const stalls = state.stalls || [];

  container.innerHTML = `
    <div class="login-page">
      <div class="auth-bg-blob blob-1"></div>
      <div class="auth-bg-blob blob-2"></div>

      <div class="login-card pending-card" style="max-width:520px;">
        <div class="pending-icon-glow">🎪</div>
        <h2 class="pending-title">Join Your Festival Stall</h2>
        <p class="pending-subtitle">
          Welcome, <strong>${user?.displayName || user?.name || 'Team Member'}</strong>! Enter your 12-character Stall Code to open your live member dashboard.
        </p>

        <!-- Form: Enter 12-Character Stall Code -->
        <form id="pending-join-form" class="pending-form" style="margin-top:16px;">
          <div class="form-group">
            <label class="form-label" for="join-invite-code">
              Stall Invite Code <span class="required">*</span>
            </label>
            <input type="text" id="join-invite-code" class="form-input invite-code-input" placeholder="e.g. Vk9$mX2#pL8Q" required maxlength="16" autofocus />
            <span class="form-hint" style="text-align:center; display:block;">Provided by your Stall Coordinator</span>
          </div>

          <div id="role-action-error" class="auth-error" style="display:none; margin-bottom:12px;"></div>

          <button type="submit" class="btn btn-primary btn-full auth-submit-btn" id="btn-submit-join-code">
            🚀 Join Stall & Open Dashboard →
          </button>
        </form>

        ${stalls.length > 0 ? `
          <div style="margin-top:24px; border-top:1px solid var(--border-subtle); padding-top:16px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.04em;">
              Registered Event Stalls (${stalls.length})
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; padding-right:4px;">
              ${stalls.map(s => `
                <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${s.name}</div>
                    <div style="font-size:11px; color:var(--text-tertiary);">${s.category} • ${s.location || 'Courtyard'}</div>
                  </div>
                  <button type="button" class="btn btn-outline btn-sm btn-quick-join-stall" data-stall-id="${s.id}" data-stall-name="${s.name}" style="font-size:11px; font-weight:700; padding:4px 10px;">
                    Request Join
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pending-footer" style="margin-top:20px;">
          <div>📧 Logged in as: <strong>${user?.email || 'N/A'}</strong></div>
          <button class="btn btn-outline btn-sm" id="pending-signout-btn">⏏ Sign Out</button>
        </div>
      </div>
    </div>
  `;

  window.renderIcons?.();
  const errEl = document.getElementById('role-action-error');

  // Submit Member Stall Code
  document.getElementById('pending-join-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('join-invite-code')?.value.trim();
    const btn = document.getElementById('btn-submit-join-code');

    if (!code) {
      showError(errEl, 'Please enter the 12-character stall invite code.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Joining stall…';

    try {
      const res = await api.submitStallJoinRequest(code);
      if (res.user) {
        state.currentUser = res.user;
      }
      window.showToast?.(res.message || `🎉 Successfully joined stall!`, 'success');
      await state.refreshAll();
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      showError(errEl, err.message || 'Invalid stall invite code. Please check with your coordinator.');
      btn.disabled = false;
      btn.textContent = '🚀 Join Stall & Open Dashboard →';
    }
  });

  // Quick join request button
  container.querySelectorAll('.btn-quick-join-stall').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stallId = btn.getAttribute('data-stall-id');
      const stallName = btn.getAttribute('data-stall-name');
      btn.disabled = true;
      btn.textContent = 'Requesting…';
      try {
        await api.requestJoinStall(stallId);
        window.showToast?.(`Join request sent to Coordinator of "${stallName}"!`, 'info');
        await state.refreshAll();
      } catch (err) {
        window.showToast?.(err.message || 'Could not send join request.', 'error');
        btn.disabled = false;
        btn.textContent = 'Request Join';
      }
    });
  });

  document.getElementById('pending-signout-btn')?.addEventListener('click', onSignOut);
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function friendlyFirebaseError(code) {
  const map = {
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/email-already-in-use':    'An account with this email already exists. Try signing in.',
    'auth/weak-password':           'Password is too weak. Use at least 6 characters.',
    'auth/too-many-requests':       'Too many failed attempts. Please wait and try again.',
    'auth/network-request-failed':  'Network error. Please check your connection.',
    'auth/missing-email':           'Please enter your email address.',
    'auth/api-key-not-valid':       'Firebase API key is invalid in Vercel configuration.',
    'auth/invalid-api-key':         'Firebase API key is invalid in Vercel configuration.'
  };
  return map[code] || (code ? `Authentication error (${code})` : 'Something went wrong. Please try again.');
}
