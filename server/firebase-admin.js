/**
 * Firebase Admin SDK Initializer
 * Used server-side to verify Firebase ID tokens and sync with Cloud Firestore.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

let adminAuthInstance = null;
let firestoreInstance = null;

try {
  if (!getApps().length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.trim();
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
          (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || 'aadix001';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (projectId && clientEmail && privateKey && !privateKey.includes('PASTE_YOUR_FULL_PRIVATE_KEY_HERE')) {
      try {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
        console.log(`🔥 Firebase Admin SDK initialized (Project: ${projectId})`);
      } catch (certErr) {
        console.warn('⚠️ Service account cert error, falling back to basic init:', certErr.message);
        initializeApp({ projectId });
      }
    } else {
      // Fallback initialization without service account for basic token decoding
      initializeApp({ projectId });
      console.log(`ℹ️  Firebase Admin SDK running with project ID: ${projectId}`);
    }
  }

  try {
    adminAuthInstance = getAuth();
  } catch (_) {
    adminAuthInstance = null;
  }

  try {
    firestoreInstance = getFirestore();
  } catch (_) {
    firestoreInstance = null;
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin SDK initialization notice:', err.message);
}

export const firebaseAuth = adminAuthInstance;
export const firestore = firestoreInstance;

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
    }
  }
}

export default firebaseAuth;
