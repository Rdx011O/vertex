/**
 * Login / Sign-up / Forgot-Password View Component
 * Handles email/password auth via Firebase SDK.
 * Sign-up collects role-specific details for admin to review.
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
  { value: 'food', label: '🍕 Food' },
  { value: 'game', label: '🎮 Game' },
  { value: 'business', label: '💼 Business' },
  { value: 'business_with_sponsorship', label: '🤝 Business with Sponsorship' }
];

export function renderLoginView(container, firebaseAuth, onSuccess) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card" id="auth-card">
        
        <!-- Brand -->
        <div class="login-brand">
          <div class="login-logo">V</div>
          <div class="login-brand-text">
            <div class="login-title">VERTEX</div>
            <div class="login-subtitle">Building Pravara 2026 · PREC Loni</div>
          </div>
        </div>

        <!-- Tab switcher -->
        <div class="login-tabs" id="auth-tabs">
          <button class="login-tab active" id="tab-signin" data-tab="signin">Sign In</button>
          <button class="login-tab" id="tab-signup" data-tab="signup">Sign Up</button>
        </div>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Sign In Form                                           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <form id="signin-form" class="auth-form active">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="signin-email" class="form-input" placeholder="you@prec.ac.in" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="signin-password" class="form-input" placeholder="••••••••" autocomplete="current-password" required />
          </div>
          <div id="signin-error" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="signin-btn">
            <span id="signin-btn-text">Sign In →</span>
          </button>
          <p class="auth-note" style="text-align:right; margin-top:10px;">
            <a href="#" id="forgot-password-link" style="color:var(--accent-primary); font-size:13px; text-decoration:none;">Forgot Password?</a>
          </p>
        </form>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Sign Up Form                                           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <form id="signup-form" class="auth-form">
          
          <!-- Step 1: Basic Info -->
          <div class="signup-section-title">👤 Personal Info</div>

          <div class="form-group">
            <label class="form-label">Username <span class="required">*</span></label>
            <input type="text" id="signup-username" class="form-input" placeholder="e.g. aarav_d" required />
            <span class="form-hint">Unique handle — no spaces, use underscores</span>
          </div>
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input type="text" id="signup-name" class="form-input" placeholder="Aarav Deshmukh" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <input type="email" id="signup-email" class="form-input" placeholder="you@prec.ac.in" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Phone (optional)</label>
            <input type="tel" id="signup-phone" class="form-input" placeholder="+91 98000 00000" />
          </div>
          <div class="form-group">
            <label class="form-label">College <span class="required">*</span></label>
            <select id="signup-college" class="form-input" required>
              <option value="">— Select your college —</option>
              ${COLLEGE_LIST.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Role <span class="required">*</span></label>
            <select id="signup-role" class="form-input" required>
              <option value="">— Select your role —</option>
              <option value="admin">👑 Event Admin / Administrator</option>
              <option value="coordinator">👔 Stall Coordinator</option>
              <option value="member">👤 Stall Member</option>
            </select>
          </div>

          <!-- Step 3: Member-only Stall Code (optional) -->
          <div id="member-stall-code-field" style="display:none;">
            <div class="signup-section-title" style="margin-top:20px;">🔑 Stall Join Code</div>
            <div class="form-group">
              <label class="form-label">Stall Invite Code <span style="font-weight:400;color:var(--text-secondary);font-size:12px;">(optional — paste 12-char code to join instantly)</span></label>
              <input type="text" id="signup-member-code" class="form-input" placeholder="e.g. Vk9$mX2#pL8Q" style="font-family:monospace;letter-spacing:1px;" />
            </div>
          </div>

          <!-- Step 3: Coordinator-only stall info (shown/hidden by JS) -->
          <div id="coordinator-stall-fields" style="display:none;">
            <div class="signup-section-title" style="margin-top:20px;">🏪 Stall Information</div>
            <div class="form-group">
              <label class="form-label">Stall Name <span class="required">*</span></label>
              <input type="text" id="signup-stall-name" class="form-input" placeholder="e.g. Food Fiesta, Tech Zone" />
              <span class="form-hint">As pre-allotted by the event organizers</span>
            </div>
            <div class="form-group">
              <label class="form-label">Stall Category <span class="required">*</span></label>
              <select id="signup-stall-category" class="form-input">
                <option value="">— Select category —</option>
                ${STALL_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Stall Allotted Number <span class="required">*</span></label>
              <input type="text" id="signup-stall-number" class="form-input" placeholder="e.g. S-07, A-12" />
              <span class="form-hint">The stall number given to you by the organizers</span>
            </div>
          </div>

          <!-- Step 4: Password -->
          <div class="signup-section-title" style="margin-top:20px;">🔑 Set Password</div>
          <div class="form-group">
            <label class="form-label">Password <span class="required">*</span> <span style="font-weight:400;color:var(--text-secondary);font-size:12px;">(min 6 characters)</span></label>
            <input type="password" id="signup-password" class="form-input" placeholder="••••••••" autocomplete="new-password" required />
          </div>

          <div id="signup-error" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="signup-btn">
            <span id="signup-btn-text">Create Account →</span>
          </button>
          <p class="auth-note">
            🚀 Direct instant access for Admin & Coordinator. Members can join with stall invite code instantly.
          </p>
        </form>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- Forgot Password View (shown by JS)                     -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <div id="forgot-password-view" style="display:none;">
          <div class="signup-section-title" style="margin-bottom:16px;">🔑 Reset Password</div>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
            Enter your registered email address and we'll send you a link to reset your password.
          </p>
          <div class="form-group">
            <label class="form-label">Registered Email</label>
            <input type="email" id="forgot-email" class="form-input" placeholder="you@prec.ac.in" autocomplete="email" />
          </div>
          <div id="forgot-error" class="auth-error" style="display:none;"></div>
          <div id="forgot-success" class="auth-success" style="display:none;"></div>
          <div style="display:flex; gap:10px; margin-top:4px;">
            <button type="button" class="btn btn-primary" id="forgot-send-btn" style="flex:1;">
              <span id="forgot-btn-text">Send Reset Link</span>
            </button>
            <button type="button" class="btn btn-outline" id="forgot-back-btn">← Back</button>
          </div>
        </div>

        <div class="login-footer">
          <span>🔒 Secured with Firebase Authentication</span>
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
      document.getElementById(`${tab}-form`).classList.add('active');
      document.getElementById('forgot-password-view').style.display = 'none';
      document.getElementById('auth-tabs').style.display = '';
    });
  });

  // ── Show/hide coordinator stall fields / member code ───────────────
  const roleSelect = document.getElementById('signup-role');
  roleSelect?.addEventListener('change', () => {
    const stallFields = document.getElementById('coordinator-stall-fields');
    const memberCodeField = document.getElementById('member-stall-code-field');
    if (stallFields) {
      stallFields.style.display = roleSelect.value === 'coordinator' ? 'block' : 'none';
    }
    if (memberCodeField) {
      memberCodeField.style.display = roleSelect.value === 'member' ? 'block' : 'none';
    }
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
    btn.disabled = true;
    document.getElementById('signin-btn-text').textContent = 'Signing in…';

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // onAuthStateChanged in app.js will handle the rest
    } catch (err) {
      errorEl.textContent = friendlyFirebaseError(err.code);
      errorEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('signin-btn-text').textContent = 'Sign In →';
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
    const desiredRole  = document.getElementById('signup-role')?.value;
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
    if (!username)    { showError(errorEl, 'Please enter a username.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError(errorEl, 'Username can only contain letters, numbers and underscores.'); return; }
    if (!name)        { showError(errorEl, 'Please enter your full name.'); return; }
    if (!email)       { showError(errorEl, 'Please enter your email.'); return; }
    if (!college)     { showError(errorEl, 'Please select your college.'); return; }
    if (!desiredRole) { showError(errorEl, 'Please select your role.'); return; }
    if (desiredRole === 'coordinator') {
      if (!stallName)     { showError(errorEl, 'Please enter your stall name.'); return; }
      if (!stallCategory) { showError(errorEl, 'Please select your stall category.'); return; }
      if (!stallNumber)   { showError(errorEl, 'Please enter your stall allotted number.'); return; }
    }
    if (password.length < 6) { showError(errorEl, 'Password must be at least 6 characters.'); return; }

    btn.disabled = true;
    document.getElementById('signup-btn-text').textContent = 'Creating account…';

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      // 2. Set display name in Firebase Auth
      await updateProfile(userCredential.user, { displayName: name });

      // 3. Register profile in our DB (need fresh token)
      api.setTokenProvider(() => userCredential.user.getIdToken(false));

      await api.registerProfile(name, phone, desiredRole, {
        username,
        college_name: college,
        stall_name_desired: stallName || null,
        stall_category_desired: stallCategory || null,
        stall_alloted_number: stallNumber || null,
        invite_code: memberCode || null,
        stall_code: memberCode || null
      });

      // onAuthStateChanged in app.js handles the rest
    } catch (err) {
      showError(errorEl, friendlyFirebaseError(err.code) || err.message);
      btn.disabled = false;
      document.getElementById('signup-btn-text').textContent = 'Create Account →';
    }
  });
}

/** "Awaiting role assignment / Enter Stall Code" screen shown to pending users */
export function renderPendingApprovalView(container, user, onSignOut) {
  const isMember = !user?.role || user?.role === 'pending_member' || user?.role === 'pending' || user?.role === 'member';

  container.innerHTML = `
    <div class="login-page">
      <div class="login-card pending-card" style="max-width:500px;">
        <div class="pending-icon">🔑</div>
        <h2 class="pending-title">Welcome, ${user?.displayName || user?.name || 'Member'}!</h2>
        
        <p class="pending-desc" style="margin-bottom:20px;font-size:14px;line-height:1.5;">
          Paste the <strong>12-character Stall Invite Code</strong> provided by your Stall Coordinator below to join your stall immediately:
        </p>

        <form id="pending-join-form" style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px; text-align:left;">
          <div>
            <label class="form-label" style="font-weight:600;">Stall Invite Code</label>
            <input type="text" id="join-invite-code" class="form-input" placeholder="e.g. Vk9$mX2#pL8Q" required style="font-family:monospace; font-size:17px; font-weight:700; text-align:center; letter-spacing:1.5px; padding:12px;" />
            <span class="form-hint" style="text-align:center; display:block; margin-top:4px;">Copy the 12-digit code from your Stall Coordinator</span>
          </div>
          <div id="join-code-error" class="auth-error" style="display:none;"></div>
          <div id="join-code-success" class="auth-success" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-join-code" style="padding:12px;font-size:15px;font-weight:600;">
            Join Stall Now →
          </button>
        </form>

        <div class="pending-info" style="margin-top:10px;text-align:left;">
          <div>📧 <strong>${user?.email || 'N/A'}</strong></div>
          ${user?.college_name ? `<div>🏫 ${user.college_name}</div>` : ''}
          ${user?.stall_name_desired ? `<div>🏪 Requested Stall: <strong>${user.stall_name_desired}</strong></div>` : ''}
          <div>🆔 Status: <span class="badge badge-pending">${(user?.role || 'pending_member').toUpperCase()}</span></div>
        </div>

        <div style="display:flex;gap:12px;margin-top:20px;">
          <button class="btn btn-outline" id="pending-refresh-btn" style="flex:1;">🔄 Check Status</button>
          <button class="btn btn-outline" id="pending-signout-btn">Sign Out</button>
        </div>
      </div>
    </div>
  `;

  // Submit Stall Code
  document.getElementById('pending-join-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('join-invite-code')?.value.trim();
    const errEl = document.getElementById('join-code-error');
    const succEl = document.getElementById('join-code-success');
    const btn = document.getElementById('btn-submit-join-code');

    errEl.style.display = 'none';
    succEl.style.display = 'none';

    if (!code) {
      showError(errEl, 'Please enter the 12-character stall invite code.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Joining stall…';

    try {
      const res = await api.submitStallJoinRequest(code);
      succEl.textContent = `✅ ${res.message || 'Successfully joined stall!'}`;
      succEl.style.display = 'block';
      window.showToast?.(res.message || 'Joined stall successfully!', 'success');
      btn.textContent = 'Joined Successfully ✓';
      
      // Immediately refresh state store to load user & active stall and switch to Member View
      if (window.vertexApp) {
        await state.refreshAll();
      } else {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      showError(errEl, err.message || 'Invalid stall invite code. Please check with your coordinator.');
      btn.disabled = false;
      btn.textContent = 'Join Stall Now →';
    }
  });

  document.getElementById('pending-refresh-btn')?.addEventListener('click', async () => {
    await state.refreshAll();
  });

  document.getElementById('pending-signout-btn')?.addEventListener('click', onSignOut);
}

function showError(el, msg) {
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
