# Roadmap to Production

Four stages, scoped to be achievable ahead of Oct 1, 2026.

## 1. Backend & Data
Stand up the database and API described in `03-ARCHITECTURE.md`; migrate the prototype's logic into real, server-enforced business rules. Nothing in `01-ROLES_AND_PERMISSIONS.md`'s "cannot do" column should be enforceable only by the UI at the end of this stage.

## 2. Auth & Roles
Real login for every Admin, Stall Coordinator, and Member; enforce role permissions server-side. This is also where the offline-first POS queue and idempotency handling from `03-ARCHITECTURE.md` need to be working, not deferred — it's a core workflow, not a polish item.

## 3. Pilot with a few stalls
Run five to ten real stalls on Vertex during a smaller event to validate the attendance and sales-verification loop end to end, under real conditions rather than test data.

**Go/no-go criteria before moving to full rollout:**
- Zero duplicate sales across a deliberate offline-sync test (kill connectivity mid-submission, confirm reconnect produces exactly one record).
- Dashboard updates reach a Member's screen within a defined latency budget after Admin verifies a sale — set this number explicitly and measure it, don't eyeball it.
- No attendance record exists without a valid `confirmed_by_user_id` matching that stall's coordinator.
- Break-even and recovered-% figures match a manual recalculation from the raw `sales_submissions` and `stall_expenses` rows for every pilot stall.
- Pilot coordinators can complete a full stall-close (POS entry → submit → verify) on a phone, one-handed, without needing the desktop view.

If any of these fail, fix and re-pilot rather than rolling forward on a fixed calendar date — the four-day live event is not the place to discover a duplicate-sale bug.

## 4. Full Building Pravara rollout
Onboard every stall for Oct 1–4, with the Admin command center live for the whole event.

- Load test at the ~10,000-user scale from `03-ARCHITECTURE.md` before this stage begins, not after.
- Have the audit log and backup/point-in-time recovery from `03-ARCHITECTURE.md` verified working, not just configured.
- Staff a monitoring watch for the event window — dashboards, error rates, WebSocket connection counts — since this is now the single system of record for the event's attendance and money, with no paper fallback running in parallel.

## Why this is worth building out

The prototype already proves every workflow leadership needs to trust: one accountable confirmation for attendance, one accountable verification for money, one live dashboard instead of a dozen disconnected spreadsheets. The financial formulas in `04-FINANCIAL_LOGIC.md` aren't new math — they're the same break-even logic any stall organizer already does by hand. Vertex does it live, for every stall, at once, at the scale the real event actually needs.
