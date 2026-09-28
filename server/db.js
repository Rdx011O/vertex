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
const isVercel = Boolean(process.env.VERCEL);
let DATA_DIR = isVercel ? path.join('/tmp', 'vertex_data') : path.join(__dirname, '..', 'data');
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
    sale_line_items: [],
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
    // Only cap audit_logs to 100 entries so document never exceeds Firestore doc size limits
    const safeData = {
      ...data,
      audit_logs: Array.isArray(data.audit_logs) ? data.audit_logs.slice(0, 100) : []
    };
    await fsDb.collection(FS_COLLECTION).doc(FS_META_DOC).set(safeData, { merge: false });
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

// Asynchronous, debounced local JSON persistence
let _localWriteTimeout = null;
let _isWritingLocal = false;
let _pendingLocalWrite = false;

async function executeLocalWrite(data) {
  if (_isWritingLocal) {
    _pendingLocalWrite = true;
    return;
  }
  _isWritingLocal = true;
  try {
    const serialized = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(DB_FILE, serialized, 'utf-8');
  } catch (err) {
    console.warn('[DB] Local JSON write error:', err.message);
  } finally {
    _isWritingLocal = false;
    if (_pendingLocalWrite) {
      _pendingLocalWrite = false;
      scheduleLocalWrite(data);
    }
  }
}

function scheduleLocalWrite(data, delay = 100) {
  if (_localWriteTimeout) clearTimeout(_localWriteTimeout);
  _localWriteTimeout = setTimeout(() => {
    executeLocalWrite(data);
  }, delay);
}

function localWrite(data) {
  scheduleLocalWrite(data, 100);
}

// Database class
class Database {
  constructor() {
    this.data = null;
    this._useFirestore = false;
    this._initPromise = null;
    this._changeListeners = new Set();

    // Firestore debounced write queue & mutex
    this._fsWriteTimeout = null;
    this._fsWriting = false;
    this._fsNeedsWrite = false;

    // Synchronous bootstrap from local JSON so routes work immediately on boot
    const local = localRead();
    this.data = local || getEmptyDatabase();
    if (!local) localWrite(this.data);
    this._ensureCollections();

    // Kick off async Firestore sync in background
    this._initPromise = this._initFirestore();
  }

  onChange(listener) {
    this._changeListeners.add(listener);
    return () => this._changeListeners.delete(listener);
  }

  _notifyChange() {
    for (const fn of this._changeListeners) {
      try { fn(this.data); } catch (_) {}
    }
  }

  async _initFirestore() {
    try {
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
        console.log('[DB] Loaded from Firestore: ' + (this.data.users?.length || 0) + ' users, ' + (this.data.stalls?.length || 0) + ' stalls.');
        this._useFirestore = true;
        this._notifyChange();
      } else {
        // Firestore is empty or first run - push initial data to it
        const writeOk = await fsWrite(this.data);
        if (writeOk) {
          console.log('[DB] Initialized Firestore with initial data.');
          this._useFirestore = true;
        } else {
          console.warn('[DB] Could not write to Firestore; continuing in local mode.');
        }
      }
    } catch (err) {
      console.warn('[DB] Firestore init error:', err.message);
    }
  }

  _ensureCollections() {
    const empty = getEmptyDatabase();
    for (const key of Object.keys(empty)) {
      if (!this.data[key] || (Array.isArray(empty[key]) && !Array.isArray(this.data[key]))) {
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

  // Trigger Firestore write safely using a coalescing queue (respects 1 write/sec limit)
  _scheduleFirestoreSync() {
    if (!this._useFirestore) return;

    if (this._fsWriteTimeout) clearTimeout(this._fsWriteTimeout);

    this._fsWriteTimeout = setTimeout(async () => {
      if (this._fsWriting) {
        this._fsNeedsWrite = true;
        return;
      }
      this._fsWriting = true;
      try {
        await fsWrite(this.data);
      } catch (err) {
        console.warn('[DB] Debounced Firestore save error:', err.message);
      } finally {
        this._fsWriting = false;
        if (this._fsNeedsWrite) {
          this._fsNeedsWrite = false;
          this._scheduleFirestoreSync();
        }
      }
    }, 400); // 400ms debounce batches rapid concurrent bursts cleanly
  }

  save() {
    // Notify in-process route caches to invalidate instantly
    this._notifyChange();

    // Debounced async local write (non-blocking)
    scheduleLocalWrite(this.data, 100);

    // Debounced coalesced Firestore write
    this._scheduleFirestoreSync();
  }

  getUserByUid(firebaseUid) {
    if (!firebaseUid || !Array.isArray(this.data?.users)) return null;
    return this.data.users.find(u => u.id === firebaseUid) || null;
  }

  getUserByEmail(email) {
    if (!email || !Array.isArray(this.data?.users)) return null;
    const e = email.trim().toLowerCase();
    return this.data.users.find(u => (u.email || '').trim().toLowerCase() === e) || null;
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
