# Vertex — Event Operations System
### Building Pravara 2026 (Oct 1–4, 2026 • Pravara Rural Engineering College, Loni)

Vertex is the real-time event operations system that replaces paper attendance registers, notebook cash tallies, and WhatsApp coordination with a single verified, real-time ledger of stalls, attendance, sales, and money.

---

## ⚡ Core Principles

- **One Accountable Person Rule:**
  - Attendance is confirmed **only** by a member's own Stall Coordinator.
  - Sales count toward official gross earnings **only** when Admin verifies the log.
  - Zero self-approval across all roles; no intermediate college/principal layer.
- **Offline-First POS Terminal:**
  - Mobile thumb-friendly checkout interface for rush hours.
  - Queues sales locally with idempotency keys (`UUID-v4`) during dead spots; auto-syncs on reconnect with zero duplicate transactions.
- **Exact Financial Mathematics:**
  - Indian digit grouping (`₹1,62,500`), zero-expense division safety, 100% recovery cap.
- **Live Real-time Sync & Audit Ledger:**
  - WebSocket hub instantly broadcasts verification events across connected screens.
  - Immutable append-only audit trail logging actor timestamps and action details.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, WebSockets (`ws`), CORS, UUID
- **Database:** File-backed relational ledger with UUID primary keys and transactional integrity
- **Frontend:** Semantic HTML5, Vanilla JavaScript (ES modules), Bespoke CSS design system tokens
- **Design System:** Strict adherence to role accents (Admin Indigo `#4F46E5`, Coordinator Amber `#D97706`, Member Rose `#E11D48`), high-contrast Dark/Light themes, and authentic Lanyard Event Badges with QR credentials.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open in Browser
Visit [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
vertex/
├── 00-PROJECT_CONTEXT.md          # High-level architecture context
├── 01-ROLES_AND_PERMISSIONS.md     # Permission matrix & workflow rules
├── 02-DATA_MODEL.md               # Relational entity schema & foreign keys
├── 03-ARCHITECTURE.md             # Production scaling & offline POS spec
├── 04-FINANCIAL_LOGIC.md          # Exact formulas & worked examples
├── 05-UI_UX_GUIDELINES.md         # Design system & aesthetic rules
├── 06-ROADMAP.md                  # Staged roadmap to event rollout
├── package.json                   # Project metadata & dependencies
├── server/
│   ├── db.js                      # Database engine & seed ledger
│   ├── financials.js              # Pure calculation engine (INR formatted)
│   ├── rbac.js                    # Server-side role enforcement
│   ├── ws.js                      # WebSocket real-time hub
│   ├── index.js                   # Express server entry point
│   └── routes/
│       ├── auth.js                # Users and profile management
│       ├── stalls.js              # Stall operations and expenses
│       ├── sales.js               # POS batch submit & verification queue
│       ├── attendance.js          # Arrival check-ins & coordinator approval
│       ├── notifications.js       # Event announcements & alerts
│       └── audit.js               # Immutable audit log stream
└── public/
    ├── index.html                 # Semantic application shell
    ├── css/
    │   ├── tokens.css             # Color tokens, themes, typography
    │   ├── main.css               # Main components and layout
    │   ├── pos.css                # Mobile one-handed POS keypad styles
    │   └── badge.css              # Lanyard event badge & QR card styles
    └── js/
        ├── api.js                 # API client with offline queue & sync
        ├── state.js               # Reactive application store
        ├── app.js                 # App controller and role switcher
        └── components/
            ├── admin-view.js      # Command center & verification queue
            ├── coordinator-view.js# Analytics, POS terminal & attendance desk
            ├── member-view.js     # Transparent financials & QR badge
            ├── qr-modal.js        # Vector QR badge modal
            └── notifications-drawer.js # Alerts center
```

---

## 📜 License
Developed for **Building Pravara 2026**, Pravara Rural Engineering College, Loni.
