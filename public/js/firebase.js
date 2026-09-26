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

export async function initFirebase() {
  if (_app) return { app: _app, auth: _auth };

  _app = initializeApp(DEFAULT_FIREBASE_CONFIG);
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
