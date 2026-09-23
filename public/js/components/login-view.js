/**
 * Login / Sign-up View Component
 * Handles email/password auth via Firebase SDK.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from '../firebase.js';
import api from '../api.js';

export function renderLoginView(container, firebaseAuth, onSuccess) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        
        <!-- Brand -->
        <div class="login-brand">
          <div class="login-logo">V</div>
          <div class="login-brand-text">
            <div class="login-title">VERTEX</div>
            <div class="login-subtitle">Building Pravara 2026 · PREC Loni</div>
          </div>
        </div>

        <!-- Tab switcher -->
        <div class="login-tabs">
          <button class="login-tab active" id="tab-signin" data-tab="signin">Sign In</button>
          <button class="login-tab" id="tab-signup" data-tab="signup">Sign Up</button>
        </div>

        <!-- Sign In Form -->
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
        </form>

        <!-- Sign Up Form -->
        <form id="signup-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="signup-name" class="form-input" placeholder="Aarav Deshmukh" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="signup-email" class="form-input" placeholder="you@prec.ac.in" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Phone (optional)</label>
            <input type="tel" id="signup-phone" class="form-input" placeholder="+91 98000 00000" />
          </div>
          <div class="form-group">
            <label class="form-label">I am a</label>
            <div class="role-selector">
              <label class="role-option">
                <input type="radio" name="desired_role" value="coordinator" id="role-coordinator" />
                <div class="role-card">
                  <span class="role-icon">👔</span>
                  <div>
                    <div class="role-name">Stall Coordinator</div>
                    <div class="role-desc">Manage my stall, submit sales, confirm attendance</div>
                  </div>
                </div>
              </label>
              <label class="role-option">
                <input type="radio" name="desired_role" value="member" id="role-member" />
                <div class="role-card">
                  <span class="role-icon">👤</span>
                  <div>
                    <div class="role-name">Stall Member</div>
                    <div class="role-desc">Check in to my stall and view team info</div>
                  </div>
                </div>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password (min 6 characters)</label>
            <input type="password" id="signup-password" class="form-input" placeholder="••••••••" autocomplete="new-password" required />
          </div>
          <div id="signup-error" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="signup-btn">
            <span id="signup-btn-text">Create Account →</span>
          </button>
          <p class="auth-note">
            ⏳ After signing up, Admin will review and assign your role & stall. You'll see your dashboard once assigned.
          </p>
        </form>

        <div class="login-footer">
          <span>🔒 Secured with Firebase Authentication</span>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.login-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`${tab}-form`).classList.add('active');
    });
  });

  // Sign In
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

  // Sign Up
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const desiredRole = document.querySelector('input[name="desired_role"]:checked')?.value;
    const errorEl = document.getElementById('signup-error');
    const btn = document.getElementById('signup-btn');

    errorEl.style.display = 'none';

    if (!name) { showError(errorEl, 'Please enter your full name.'); return; }
    if (!desiredRole) { showError(errorEl, 'Please select your role (Coordinator or Member).'); return; }
    if (password.length < 6) { showError(errorEl, 'Password must be at least 6 characters.'); return; }

    btn.disabled = true;
    document.getElementById('signup-btn-text').textContent = 'Creating account…';

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      // 2. Set display name in Firebase Auth
      await updateProfile(userCredential.user, { displayName: name });

      // 3. Register profile in our DB (need fresh token)
      const token = await userCredential.user.getIdToken(true);
      api.setTokenProvider(() => userCredential.user.getIdToken(false));

      await api.registerProfile(name, phone, desiredRole);

      // onAuthStateChanged in app.js handles the rest
    } catch (err) {
      showError(errorEl, friendlyFirebaseError(err.code) || err.message);
      btn.disabled = false;
      document.getElementById('signup-btn-text').textContent = 'Create Account →';
    }
  });
}

/** "Awaiting role assignment" screen shown to pending users */
export function renderPendingApprovalView(container, user, onSignOut) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card pending-card">
        <div class="pending-icon">⏳</div>
        <h2 class="pending-title">Almost there, ${user?.displayName || 'friend'}!</h2>
        <p class="pending-desc">
          Your account has been created successfully.<br>
          <strong>The Admin will review and assign your stall role shortly.</strong><br><br>
          Once assigned, refresh this page to access your dashboard.
        </p>
        <div class="pending-info">
          <div>📧 <strong>${user?.email}</strong></div>
          <div>🆔 Registration complete — waiting for Admin approval</div>
        </div>
        <div style="display:flex;gap:12px;margin-top:20px;">
          <button class="btn btn-primary" onclick="window.location.reload()">🔄 Refresh</button>
          <button class="btn btn-outline" id="pending-signout-btn">Sign Out</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('pending-signout-btn')?.addEventListener('click', onSignOut);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function friendlyFirebaseError(code) {
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}
