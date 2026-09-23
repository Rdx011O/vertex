/**
 * Firebase Admin SDK Initializer
 * Used server-side to verify Firebase ID tokens.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

// Only initialize once (guard for hot-reload scenarios)
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const isPlaceholder = !privateKey ||
    privateKey.includes('PASTE_YOUR_FULL_PRIVATE_KEY_HERE') ||
    privateKey.includes('YOUR_PRIVATE_KEY_HERE');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || isPlaceholder) {
    console.error('========================================================');
    console.error('❌ FIREBASE ADMIN SDK: Missing or incomplete credentials!');
    console.error('');
    console.error('   Open .env and fill in FIREBASE_PRIVATE_KEY.');
    console.error('   → Open your downloaded service account JSON file');
    console.error('   → Find the "private_key" field (not "private_key_id")');
    console.error('   → It starts with: -----BEGIN PRIVATE KEY-----');
    console.error('   → Copy its entire value into FIREBASE_PRIVATE_KEY in .env');
    console.error('   → Restart the server after saving .env');
    console.error('========================================================');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });

  console.log(`🔥 Firebase Admin SDK initialized (Project: ${process.env.FIREBASE_PROJECT_ID})`);
}

export const firebaseAuth = getAuth();
export default firebaseAuth;
