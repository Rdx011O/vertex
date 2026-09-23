/**
 * Vertex Flat-File JSON Database
 * No seed data — clean production slate.
 * All users are keyed by Firebase UID.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'vertex_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Returns a fresh empty database — no fake data. */
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
        description: 'The flagship annual technology, entrepreneurship & innovation festival.'
      }
    ],
    /**
     * User schema:
     * {
     *   id: string           (Firebase UID)
     *   name: string
     *   email: string
     *   role: 'admin' | 'coordinator' | 'member' | 'pending'
     *   stall_id: string | null
     *   phone: string | null
     *   designation: string | null
     *   badge_code: string
     *   created_at: ISO string
     * }
     */
    users: [],
    /**
     * Stall schema:
     * {
     *   id: string
     *   name: string
     *   category: string
     *   event_id: string
     *   coordinator_user_id: string (Firebase UID)
     *   status: 'active' | 'warning' | 'discontinued'
     *   banner_color: string
     *   location: string
     *   created_at: ISO string
     * }
     */
    stalls: [],
    stall_expenses: [],
    sales_submissions: [],
    sale_line_items: [],
    attendance_records: [],
    notifications: [],
    audit_logs: [],
    /**
     * POS Catalog item schema:
     * {
     *   id: string
     *   stall_id: string
     *   name: string
     *   price: number
     *   category: string
     * }
     */
    pos_catalog: []
  };
}

class Database {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Migrate: if old seed data detected (hardcoded IDs like 'usr-admin-01'), reset
        const hasOldSeed = parsed.users && parsed.users.some(u => u.id && u.id.startsWith('usr-'));
        if (hasOldSeed) {
          console.log('⚠️  Old seed data detected — wiping and starting clean.');
          this.data = getEmptyDatabase();
          this.save();
        } else {
          this.data = parsed;
          // Ensure all collections exist (forward-compat)
          this._ensureCollections();
        }
      } else {
        console.log('📦 No database found — initializing clean database.');
        this.data = getEmptyDatabase();
        this.save();
      }
    } catch (err) {
      console.error('Failed to load db file, initializing clean:', err);
      this.data = getEmptyDatabase();
      this.save();
    }
  }

  _ensureCollections() {
    const empty = getEmptyDatabase();
    for (const key of Object.keys(empty)) {
      if (this.data[key] === undefined) {
        this.data[key] = empty[key];
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to DB file:', err);
    }
  }

  // ----------------------------------------------------------------
  // User helpers
  // ----------------------------------------------------------------

  getUserByUid(firebaseUid) {
    return this.data.users.find(u => u.id === firebaseUid) || null;
  }

  createUser({ id, name, email, role = 'pending', phone = null, designation = null }) {
    const existingUser = this.getUserByUid(id);
    if (existingUser) return existingUser;

    const user = {
      id,
      name,
      email,
      role,
      stall_id: null,
      phone,
      designation,
      badge_code: 'BP-' + Math.random().toString(36).toUpperCase().slice(2, 8),
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

  // ----------------------------------------------------------------
  // Audit
  // ----------------------------------------------------------------

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
    this.data.audit_logs.unshift(entry);
    this.save();
    return entry;
  }
}

export const db = new Database();
export default db;
