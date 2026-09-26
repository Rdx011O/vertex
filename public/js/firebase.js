/**
 * Firebase Client SDK Initializer
 * Uses Firebase JS SDK via CDN (compat with the npm firebase@10 package version).
 * Config is loaded dynamically from the server at /api/firebase-config with automatic fallback.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

let _app = null;
let _auth = null;

// Default client-side web config for project aadix001
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDwRnL6LDmnl81OwYmhbPpTaWJOv3UQzWU",
  authDomain: "aadix001.firebaseapp.com",
  projectId: "aadix001",
  messagingSenderId: "653439560758",
  appId: "1:653439560758:web:03754bd2a88912cc85fc97"
};

/**
 * Initialize Firebase once, fetching config from server or falling back to default web credentials.
 * Returns { app, auth }.
 */
export async function initFirebase() {
  if (_app) return { app: _app, auth: _auth };

  let config = DEFAULT_FIREBASE_CONFIG;
  try {
    const res = await fetch('/api/firebase-config');
    if (res.ok) {
      const serverConfig = await res.json();
      if (serverConfig && serverConfig.apiKey && serverConfig.apiKey !== 'undefined' && !serverConfig.apiKey.includes('AIzaSy...')) {
        config = serverConfig;
      }
    }
  } catch (err) {
    console.warn('Could not fetch remote Firebase config from /api/firebase-config, using client fallback:', err.message);
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
  updateProfile,
  sendPasswordResetEmail
};
