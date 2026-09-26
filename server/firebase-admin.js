/**
 * Firebase Admin SDK Initializer
 * Used server-side to verify Firebase ID tokens.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
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
export const firestore = getFirestore();

let firestoreDisabledWarned = false;

/**
 * Save user QR badge record to Firebase Firestore
 */
export async function saveQRBadgeToFirebase(badgeData) {
  try {
    if (!firestore || !badgeData.user_id) return;
    await firestore.collection('qr_badges').doc(badgeData.user_id).set(badgeData, { merge: true });
    // Also save to users collection
    await firestore.collection('users').doc(badgeData.user_id).set({
      badge_code: badgeData.badge_code,
      qr_payload: badgeData.qr_payload,
      qr_image_url: badgeData.qr_image_url,
      role: badgeData.role,
      stall_id: badgeData.stall_id || null,
      updated_at: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    if (!firestoreDisabledWarned && err.message?.includes('Cloud Firestore API has not been')) {
      firestoreDisabledWarned = true;
      console.log('ℹ️  [Firebase Firestore] Firestore Database is not yet created in project aadix001.');
      console.log('   Local database (vertex_db.json) is handling all QR and attendance data.');
      console.log('   To enable cloud sync: Create Firestore at https://console.firebase.google.com/project/aadix001/firestore');
    }
  }
}

/**
 * Save attendance record to Firebase Firestore
 */
export async function saveAttendanceToFirebase(recordData) {
  try {
    if (!firestore || !recordData.id) return;
    await firestore.collection('attendance_records').doc(recordData.id).set(recordData, { merge: true });
  } catch (err) {
    if (!firestoreDisabledWarned && err.message?.includes('Cloud Firestore API has not been')) {
      firestoreDisabledWarned = true;
      console.log('ℹ️  [Firebase Firestore] Firestore Database is not yet created in project aadix001.');
      console.log('   Local database (vertex_db.json) is handling all QR and attendance data.');
      console.log('   To enable cloud sync: Create Firestore at https://console.firebase.google.com/project/aadix001/firestore');
    }
  }
}

export default firebaseAuth;

