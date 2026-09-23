/**
 * Firebase Client SDK Initializer
 * Uses Firebase JS SDK via CDN (compat with the npm firebase@10 package version).
 * Config is loaded from the server at /api/firebase-config — never hardcoded here.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

let _app = null;
let _auth = null;

/**
 * Initialize Firebase once, fetching config securely from the server.
 * Returns { app, auth }.
 */
export async function initFirebase() {
  if (_app) return { app: _app, auth: _auth };

  // Fetch config from server (keeps API keys out of the git repo)
  const res = await fetch('/api/firebase-config');
  if (!res.ok) throw new Error('Failed to fetch Firebase config from server.');

  const config = await res.json();

  if (!config.apiKey || config.apiKey === 'undefined' || config.apiKey.includes('AIzaSy...')) {
    throw new Error(
      'Firebase is not configured yet. ' +
      'Please fill in FIREBASE_PRIVATE_KEY in your .env file and restart the server.'
    );
  }

  _app = initializeApp(config);
  _auth = getAuth(_app);

  return { app: _app, auth: _auth };
}

// Re-export auth helpers so other modules can import from here
export {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
};
