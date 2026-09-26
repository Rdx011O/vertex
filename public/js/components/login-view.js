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
              <span class="label-icon">✉️</span> Registered Email
            </label>
            <div class="input-with-icon">
              <input type="email" id="signin-email" class="form-input" placeholder="name@example.com" autocomplete="email" required />
            </div>
          </div>

          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="signin-password">
                <span class="label-icon">🔒</span> Password
              </label>
              <a href="#" id="forgot-password-link" class="forgot-link">Forgot?</a>
            </div>
            <div class="input-with-toggle">
              <input type="password" id="signin-password" class="form-input" placeholder="Enter your password" autocomplete="current-password" required />
              <button type="button" class="password-toggle-btn" data-target="signin-password" title="Toggle password visibility">
                👁️
              </button>
            </div>
          </div>

          <div id="signin-error" class="auth-error" style="display:none;"></div>

          <button type="submit" class="btn btn-primary btn-full auth-submit-btn" id="signin-btn">
            <span id="signin-btn-text">Sign In to Vertex →</span>
          </button>

          <div class="auth-helper-cards">
            <div class="helper-mini-badge">
              <span>👑 Admins: Central Control</span>
            </div>
            <div class="helper-mini-badge">
              <span>👔 Coordinators: Live Stall POS</span>
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
              <span class="label-icon">🎯</span> Select Your Role <span class="required">*</span>
            </label>
            <div class="role-selector-grid" id="role-selector-cards">
              <div class="role-card-opt" data-role="coordinator">
                <div class="role-card-icon">👔</div>
                <div class="role-card-title">Coordinator</div>
                <div class="role-card-desc">Lead a Stall & Team</div>
              </div>
              <div class="role-card-opt" data-role="member">
                <div class="role-card-icon">👤</div>
                <div class="role-card-title">Member</div>
                <div class="role-card-desc">POS Counter & Sales</div>
              </div>
              <div class="role-card-opt" data-role="admin">
                <div class="role-card-icon">👑</div>
                <div class="role-card-title">Admin</div>
                <div class="role-card-desc">Event Operations</div>
              </div>
            </div>
            <input type="hidden" id="signup-role" value="coordinator" />
          </div>

          <!-- Personal Info Group -->
          <div class="signup-section-header">
            <span>👤 Personal Details</span>
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
              <span>🏪 Stall Information</span>
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

          <!-- Member Invite Code Field (Dynamic) -->
          <div id="member-stall-code-field" class="dynamic-role-box" style="display:none;">
            <div class="signup-section-header">
              <span>🔑 Stall Join Code</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="signup-member-code">
                Stall Invite Code <span class="form-hint-inline">(12 characters, from your Coordinator)</span>
              </label>
              <input type="text" id="signup-member-code" class="form-input invite-code-input" placeholder="e.g. Vk9$mX2#pL8Q" maxlength="16" />
              <span class="form-hint">Leave blank if you will join or be approved later</span>
            </div>
          </div>

          <!-- Admin Info Box (Dynamic) -->
          <div id="admin-info-field" class="dynamic-role-box" style="display:none;">
            <div class="admin-notice-pill">
              👑 <strong>Event Admin Operations:</strong> Direct access for organizing committee and operations leads.
            </div>
          </div>

          <!-- Password Group -->
          <div class="signup-section-header">
            <span>🔒 Security</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-password">Create Password <span class="required">*</span></label>
            <div class="input-with-toggle">
              <input type="password" id="signup-password" class="form-input" placeholder="At least 6 characters" autocomplete="new-password" required minlength="6" />
              <button type="button" class="password-toggle-btn" data-target="signup-password" title="Toggle password visibility">
                👁️
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
            <h3>🔑 Reset Password</h3>
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
          <span class="security-tag">🔒 Secured with Firebase Authentication</span>
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
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // onAuthStateChanged in app.js will handle the rest
    } catch (err) {
      errorEl.textContent = friendlyFirebaseError(err.code);
      errorEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('signin-btn-text').textContent = 'Sign In to Vertex →';
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
    
    if (password.length < 6) { showError(errorEl, 'Password must be at least 6 characters.'); return; }

    state.isRegistering = true;
    btn.disabled = true;
    document.getElementById('signup-btn-text').textContent = 'Creating account…';

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      // 2. Set display name in Firebase Auth
      await updateProfile(userCredential.user, { displayName: name });

      // 3. Register profile in our DB (need fresh token)
      api.setTokenProvider(() => userCredential.user.getIdToken(false));

      const res = await api.registerProfile(name, phone, desiredRole, {
        username,
        college_name: college,
        stall_name_desired: stallName || null,
        stall_category_desired: stallCategory || null,
        stall_alloted_number: stallNumber || null,
        invite_code: memberCode || null,
        stall_code: memberCode || null
      });

      state.isRegistering = false;
      state.currentUser = res.user;
      await state.refreshAll();
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      state.isRegistering = false;
      showError(errorEl, friendlyFirebaseError(err.code) || err.message);
      btn.disabled = false;
      document.getElementById('signup-btn-text').textContent = 'Create Account & Enter →';
    }
  });
}

/** "Role setup / Stall Join" screen shown to pending users */
export function renderPendingApprovalView(container, user, onSignOut) {
  container.innerHTML = `
    <div class="login-page">
      <div class="auth-bg-blob blob-1"></div>
      <div class="auth-bg-blob blob-2"></div>

      <div class="login-card pending-card" style="max-width:540px;">
        <div class="pending-icon-glow">⚡</div>
        <h2 class="pending-title">Welcome, ${user?.displayName || user?.name || 'Participant'}!</h2>
        <p class="pending-subtitle">
          Choose your access pathway into <strong>Building Pravara '26</strong>:
        </p>

        <!-- Role Action Selection Tabs -->
        <div class="login-tabs-container" style="margin-bottom:20px;">
          <div class="login-tabs">
            <button type="button" class="login-tab active" id="tab-opt-coord" data-panel="panel-coord">👔 Coordinator</button>
            <button type="button" class="login-tab" id="tab-opt-member" data-panel="panel-member">🔑 Stall Code</button>
            <button type="button" class="login-tab" id="tab-opt-admin" data-panel="panel-admin">👑 Admin</button>
          </div>
        </div>

        <!-- Panel 1: Setup Stall as Coordinator -->
        <div id="panel-coord" class="pending-panel" style="display:block;">
          <form id="coord-setup-form" class="pending-form">
            <div class="form-group">
              <label class="form-label" for="coord-stall-name">Stall Name <span class="required">*</span></label>
              <input type="text" id="coord-stall-name" class="form-input" placeholder="e.g. RoboWars Zone / Food Fiesta" required />
            </div>
            <div class="grid-2col">
              <div class="form-group">
                <label class="form-label" for="coord-stall-cat">Category <span class="required">*</span></label>
                <select id="coord-stall-cat" class="form-input" required>
                  <option value="Food & Beverage">🍕 Food & Beverage</option>
                  <option value="Tech & Gaming">🎮 Tech & Gaming</option>
                  <option value="Robotics">🤖 Robotics & DIY</option>
                  <option value="Merchandise">👕 Merchandise & Stalls</option>
                  <option value="Rural Tech">🌾 Rural Tech & Projects</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="coord-booth-num">Booth #</label>
                <input type="text" id="coord-booth-num" class="form-input" placeholder="e.g. B-04 / S-12" />
              </div>
            </div>
            <button type="submit" class="btn btn-coordinator btn-full auth-submit-btn" id="btn-setup-coord">
              👔 Launch Stall Coordinator Dashboard →
            </button>
          </form>
        </div>

        <!-- Panel 3: Paste Member Stall Invite Code -->
        <div id="panel-member" class="pending-panel" style="display:none;">
          <form id="pending-join-form" class="pending-form">
            <div class="form-group">
              <label class="form-label" for="join-invite-code">Paste 12-Character Stall Invite Code</label>
              <input type="text" id="join-invite-code" class="form-input invite-code-input" placeholder="e.g. Vk9$mX2#pL8Q" required maxlength="16" />
              <span class="form-hint" style="text-align:center; display:block;">Provided by your Stall Coordinator</span>
            </div>
            <button type="submit" class="btn btn-primary btn-full auth-submit-btn" id="btn-submit-join-code">
              Join Stall as Member →
            </button>
          </form>
        </div>

        <div id="role-action-error" class="auth-error" style="display:none; margin-top:14px;"></div>

        <div class="pending-footer">
          <div>📧 Logged in as: <strong>${user?.email || 'N/A'}</strong></div>
          <button class="btn btn-outline btn-sm" id="pending-signout-btn">⏏ Sign Out</button>
        </div>
      </div>
    </div>
  `;

  // Panel switcher listeners
  container.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.pending-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panelId = tab.dataset.panel;
      const targetPanel = document.getElementById(panelId);
      if (targetPanel) targetPanel.style.display = 'block';
    });
  });

  const errEl = document.getElementById('role-action-error');

  // 1. Claim Admin
  document.getElementById('btn-claim-admin')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-claim-admin');
    btn.disabled = true;
    btn.textContent = 'Entering Admin…';
    try {
      const res = await api.claimRole({ role: 'admin' });
      state.currentUser = res.user;
      window.showToast?.('👑 Admin Command Center accessed!', 'success');
      await state.refreshAll();
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      showError(errEl, err.message || 'Failed to claim admin access.');
      btn.disabled = false;
      btn.textContent = '👑 Enter as Event Admin →';
    }
  });

  // 2. Setup Coordinator Stall
  document.getElementById('coord-setup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const stall_name = document.getElementById('coord-stall-name')?.value.trim();
    const stall_category = document.getElementById('coord-stall-cat')?.value;
    const booth_number = document.getElementById('coord-booth-num')?.value.trim();
    const btn = document.getElementById('btn-setup-coord');

    if (!stall_name) {
      showError(errEl, 'Please enter a stall name.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating Stall…';

    try {
      const res = await api.claimRole({ role: 'coordinator', stall_name, stall_category, booth_number });
      state.currentUser = res.user;
      window.showToast?.(`✅ Stall "${stall_name}" created! Welcome Coordinator.`, 'success');
      await state.refreshAll();
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      showError(errEl, err.message || 'Failed to create stall.');
      btn.disabled = false;
      btn.textContent = '👔 Launch Stall Coordinator Dashboard →';
    }
  });

  // 3. Submit Member Stall Code
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
      window.showToast?.(res.message || 'Joined stall successfully!', 'success');
      await state.refreshAll();
      if (window.vertexApp) window.vertexApp.render();
    } catch (err) {
      showError(errEl, err.message || 'Invalid stall invite code. Please check with your coordinator.');
      btn.disabled = false;
      btn.textContent = 'Join Stall as Member →';
    }
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
    'auth/missing-email':           'Please enter your email address.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}
