/**
 * Vertex Database - Firestore-backed (with JSON file fallback for local dev)
 * Primary store: Firebase Firestore (persists across Vercel serverless cold starts)
 * Fallback:      Flat JSON file (for local dev without Firebase service account)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local JSON file paths
let DATA_DIR = path.join(__dirname, '..', 'data');
let DB_FILE  = path.join(DATA_DIR, 'vertex_db.json');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (_) {
  DATA_DIR = path.join('/tmp', 'vertex_data');
  DB_FILE  = path.join(DATA_DIR, 'vertex_db.json');
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (__) {}
}

// Firestore client (lazy-imported)
let _firestoreDb = null;
async function getFirestoreDb() {
  if (_firestoreDb) return _firestoreDb;
  try {
    const { firestore } = await import('./firebase-admin.js');
    if (firestore) {
      _firestoreDb = firestore;
      return _firestoreDb;
    }
  } catch (_) {}
  return null;
}

// Invite code generator
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ALL collections that routes reference - must stay in sync with routes!
function getEmptyDatabase() {
  return {
    events: [
      {
        id: 'ev-bp-2026',
        name: 'Building Pravara 2026',
        venue: 'Pravara Rural Engineering College, Loni',
        start_date: '2026-10-01',
        end_date: '2026-10-04',
        status: 'active',
        description: 'The flagship annual technology, entrepreneurship and innovation festival.'
      }
    ],
    users: [],
    stalls: [],
    // Sales & POS
    sales_submissions: [],
    pos_catalog: [],
    // Attendance
    attendance_records: [],
    // Stall management
    stall_expenses: [],
    stall_join_requests: [],
    // Notifications & audit
    notifications: [],
    audit_logs: [],
    // Legacy / other
    pending_sales: [],
    join_requests: []
  };
}

// Firestore helpers
const FS_COLLECTION = 'vertex_db';
const FS_META_DOC   = 'vertex_meta';

async function fsRead() {
  const fsDb = await getFirestoreDb();
  if (!fsDb) return null;
  try {
    const snap = await fsDb.collection(FS_COLLECTION).doc(FS_META_DOC).get();
    if (snap.exists) return snap.data();
  } catch (err) {
    console.warn('[DB] Firestore read error:', err.message);
  }
  return null;
}

async function fsWrite(data) {
  const fsDb = await getFirestoreDb();
  if (!fsDb) return false;
  try {
    // Exclude large log collections to stay under Firestore 1MB doc limit
    const { audit_logs, sales_submissions, attendance_records, ...essentialData } = data;
    await fsDb.collection(FS_COLLECTION).doc(FS_META_DOC).set(essentialData, { merge: false });
    return true;
  } catch (err) {
    console.warn('[DB] Firestore write error:', err.message);
    return false;
  }
}

// Local JSON helpers
function localRead() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const hasOldSeed = parsed.users && parsed.users.some(u => u.id && u.id.startsWith('usr-'));
      if (hasOldSeed) {
        console.log('Old seed data detected - wiping and starting clean.');
        return null;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('[DB] Local JSON read error:', err.message);
  }
  return null;
}

function localWrite(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[DB] Local JSON write error:', err.message);
  }
}

// Database class
class Database {
  constructor() {
    this.data = null;
    this._useFirestore = false;
    this._initPromise = null;

    // Synchronous bootstrap from local JSON so routes work immediately on boot
    const local = localRead();
    this.data = local || getEmptyDatabase();
    if (!local) localWrite(this.data);
    this._ensureCollections();

    // Kick off async Firestore sync in background
    this._initPromise = this._initFirestore();
  }

  async _initFirestore() {
    const fsDb = await getFirestoreDb();
    if (!fsDb) {
      console.log('[DB] Firestore not available - using local JSON storage.');
      return;
    }

    const remote = await fsRead();
    if (remote && remote.users) {
      // Firestore has data - use it as source of truth
      this.data = remote;
      this._ensureCollections();
      localWrite(this.data);
      console.log('[DB] Loaded from Firestore: ' + this.data.users.length + ' users, ' + this.data.stalls.length + ' stalls.');
    } else {
      // Firestore is empty - push local data to it
      await fsWrite(this.data);
      console.log('[DB] Initialized Firestore with local data.');
    }
    this._useFirestore = true;
  }

  _ensureCollections() {
    const empty = getEmptyDatabase();
    for (const key of Object.keys(empty)) {
      if (!this.data[key]) {
        this.data[key] = empty[key];
      }
    }
    // Ensure all stalls have a permanent invite_code
    if (Array.isArray(this.data.stalls)) {
      let updated = false;
      for (const stall of this.data.stalls) {
        if (!stall.invite_code) {
          stall.invite_code = generateInviteCode();
          updated = true;
        }
      }
      if (updated) this.save();
    }
  }

  save() {
    localWrite(this.data);
    if (this._useFirestore) {
      fsWrite(this.data).catch(err => console.warn('[DB] Async Firestore save error:', err.message));
    }
  }

  getUserByUid(firebaseUid) {
    return this.data.users.find(u => u.id === firebaseUid) || null;
  }

  getUserByEmail(email) {
    const e = (email || '').toLowerCase();
    return this.data.users.find(u => (u.email || '').toLowerCase() === e) || null;
  }

  createUser({ id, name, email, role = 'pending', phone = null, designation = null,
               username = null, college_name = null,
               stall_name_desired = null, stall_category_desired = null,
               stall_alloted_number = null, badge_code = null }) {
    const existingUser = this.getUserByUid(id);
    if (existingUser) return existingUser;

    const prefix = role === 'admin' ? 'ADM' : role === 'coordinator' ? 'CRD' : 'MBR';
    const user = {
      id,
      name,
      email,
      role,
      stall_id: null,
      phone,
      designation,
      username,
      college_name,
      stall_name_desired,
      stall_category_desired,
      stall_alloted_number,
      badge_code: badge_code || ('BP-' + prefix + '-' + id.slice(0, 4).toUpperCase()),
      created_at: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(uid, updates) {
    const user = this.getUserByUid(uid);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  logAudit(actorUserId, actorName, action, targetType, targetId, details) {
    const entry = {
      id: 'aud-' + uuidv4().slice(0, 8),
      actor_user_id: actorUserId,
      actor_name: actorName,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      timestamp: new Date().toISOString()
    };
    if (!Array.isArray(this.data.audit_logs)) this.data.audit_logs = [];
    this.data.audit_logs.unshift(entry);
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
    return entry;
  }

  // Wait for Firestore init to finish before serving data
  async ready() {
    if (this._initPromise) await this._initPromise;
  }
}

export const db = new Database();
export default db;
