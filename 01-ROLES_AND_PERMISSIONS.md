# Roles & Permissions

Three logins, no college layer between them. See `00-PROJECT_CONTEXT.md` for why that flattening matters structurally.

```
Admin
 ├── Stall Coordinator A ── Member, Member
 ├── Stall Coordinator B ── Member, Member
 └── More stalls...
```

## Permission matrix

| Role | Primary screens | Can do | Cannot do |
|---|---|---|---|
| **Admin** | Event Command Center, Operations (Stalls/People), Sales Verification, Updates & Leaderboard | Create stalls, issue warnings, discontinue a stall, publish event-wide announcements, verify or reject every stall's daily sales log | Cannot directly mark a member's attendance — that stays with the stall's own Coordinator |
| **Stall Coordinator** | Business Analytics (break-even), POS entry, Team & Attendance, Leaderboard | Log online/offline sales, add/edit stall expenses, submit the day's sales for verification, confirm attendance for their own members | Cannot self-approve their own sales log — every submission goes to Admin |
| **Member** | Stall Business Dashboard, My QR / Attendance, Leaderboard | View their stall's full financials (gross sales, expenses, net profit, break-even) and rank, notify the coordinator on arrival | Cannot check themselves in; cannot edit sales or expenses — view-only |

Enforce every row of the "cannot do" column server-side, not just by hiding UI. A client that can call the API directly must hit the same wall a hidden button would have.

## Workflow A — Attendance confirmation

1. Member arrives at their assigned stall, opens **My QR**.
2. Taps "I'm at my stall" — raises a live request.
3. Stall Coordinator sees the request, or scans the member's QR directly.
4. Coordinator approves — the only role that can.
5. Member, stall, and event-wide attendance % update live.

One accountable signature behind every "present" mark. This is what eliminates proxy check-ins — a friend can't check someone in, because only the coordinator's action writes an `attendance_records` row.

## Workflow B — Daily sales verification (POS)

1. Stall Coordinator taps items in POS as they sell, tagged Online or Offline.
2. Taps "Finish my day" — submission goes to Admin.
3. Admin reviews the online/offline split and full item breakdown.
4. Verifies or rejects. Verified totals add to the stall's official earnings; rejected logs don't count.
5. Leaderboard, break-even, and net profit recompute instantly on verification.

This submit-then-verify pattern is the audit trail: a stall's number never becomes the official number without a second person confirming it. A sale sitting in `sales_submissions` with `status = pending` must never show up in any gross-sales total — only `status = verified` counts.

## Per-role workflow loops

- **Admin — governance loop:** monitor live sales/attendance/risk across every stall → verify or reject each submission → intervene (warning, discontinue a stall) or broadcast an announcement.
- **Stall Coordinator — operations loop:** confirm attendance for arrivals → run the stall (POS + expenses through the day) → submit to Admin at close.
- **Stall Member — literacy loop:** notify on arrival → read the stall's live numbers (not just personal earnings) → track leaderboard rank as verified sales grow.

All three loops write to and read from the same underlying ledger — Admin and every Coordinator are looking at different views of one identical, live truth, and every Member gets that same truth, not a filtered version of it.
