# Data Model

The prototype held everything in one in-memory JS object, reset on refresh. This is the relational shape that object already implied — one level flatter than a college-based design would need, because every stall reports straight to Admin.

## Entities

```
users
  id (PK, UUID)
  name
  role            enum: admin / coordinator / member
  stall_id        FK → stalls, nullable
  auth_credential
  phone / email   unique, not null

events
  id (PK, UUID)
  name
  start_date
  end_date
  status

stalls
  id (PK, UUID)
  name
  event_id                FK → events
  coordinator_user_id     FK → users
  status                  enum: active / discontinued
  gross_earnings          derived, not stored — see 04-FINANCIAL_LOGIC.md

stall_expenses
  id (PK, UUID)
  stall_id (FK)
  category
  name
  amount

attendance_records
  id (PK, UUID)
  member_user_id (FK)
  stall_id (FK)
  status
  confirmed_by_user_id (FK)   -- must be that stall's coordinator, enforced server-side
  timestamp

sales_submissions
  id (PK, UUID)
  stall_id (FK)
  submitted_by_user_id (FK)
  online_total
  offline_total
  status                       enum: pending / verified / rejected
  verified_by_user_id (FK)     -- must be an admin, enforced server-side
  idempotency_key              -- prevents duplicate submission on offline-sync retry

sale_line_items
  id (PK, UUID)
  submission_id (FK)
  item_name
  unit_price
  qty
  payment_mode

notifications
  id (PK, UUID)
  target_role
  target_scope_id
  title
  message
  created_at
```

## Key relationships

| Relationship | Why it matters |
|---|---|
| One event → many stalls, each with one coordinator | No intermediate college record to join through — every stall reports straight to Admin. |
| One stall → many expenses | Powers the break-even chart and category cost breakdown, visible to every member of that stall. |
| One stall → many sales_submissions → many sale_line_items | Preserves the full online/offline, item-level trail behind every verified rupee. |
| `attendance_records.confirmed_by_user_id` must be the stall's coordinator; `sales_submissions.verified_by_user_id` must be an admin | Enforced server-side, not just in the UI. With no college layer, Admin is structurally the only role that can verify a sale. |

## Changes from prototype scale to ~10,000-user scale

- **UUID primary keys, not sequential integers** — multiple app instances will be inserting concurrently; don't rely on a single auto-increment sequence as a bottleneck or an implicit ordering guarantee.
- **Index `sales_submissions(stall_id, status, submitted_at)`** and **`attendance_records(stall_id, timestamp)`** — these are the two tables the live dashboards hammer on read.
- **Idempotency key on `sales_submissions`** — the offline-first POS (see `03-ARCHITECTURE.md`) will retry a "Finish my day" submit if the network drops mid-request. Without a dedupe key, a retry becomes a duplicate sale.
- **Don't store `gross_earnings` on `stalls`** — derive it from verified `sales_submissions` on read (cached, see architecture doc). A stored, manually-updated total is exactly the kind of number that drifts from the ledger and becomes unauditable.
- **`notifications` needs a fan-out strategy, not a per-user row at write time** — at 10,000 users, an event-wide announcement writing one row per recipient is a write storm. Store the notification once with its `target_role`/`target_scope_id`, and resolve "who should see this" at read time or via a lightweight read-state table.
- **Append-only audit log, separate from these tables** — every state change (who verified what, when, what it changed) writes to an immutable log. This is the actual foundation of the "one accountable signature" principle, not just the foreign keys above.
