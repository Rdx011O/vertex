# Vertex — Project Context

Read this file first. It exists so nobody — human or AI — has to reconstruct the project from scratch by reading old chat threads or guessing from code. The other files in this folder go deeper on one topic each; none of them repeat what's here.

## What Vertex is

Vertex is the event operations system for **Building Pravara** (Oct 1–4, 2026, Pravara Rural Engineering College, Loni). It replaces paper attendance registers, notebook cash tallies, and WhatsApp coordination with one verified, real-time ledger of stalls, attendance, sales, and money.

It started as a click-through prototype: a single-page app holding everything in one in-memory JS object, reset on refresh, built to prove the workflows — not to survive an event. **We are now past that stage.** This documentation set is for building the real thing: a system that has to stay correct and online for four straight days with real money and real people depending on it.

## The one rule everything else follows

**Every action has exactly one accountable person, enforced by the system, not by trust.**
- Attendance is confirmed only by a member's own Stall Coordinator.
- A sale only counts once Admin verifies it.
- No role can approve its own submission.

If a feature request would blur this — a second approver, a self-verify shortcut, a "just this once" override — it breaks the model. Flag it instead of building it silently.

## Structural decision that shapes the whole schema

**There is no college or principal layer.** Every stall reports directly to Admin. This was a deliberate flattening from an earlier design — it means Admin absorbs sales verification directly (nobody else can be the second signature on money), and attendance moves down to the Stall Coordinator instead. Do not reintroduce an intermediate approval tier without a real reason, since the data model and permission checks in `02-DATA_MODEL.md` are built flat on purpose.

## Scale this now has to hold

The prototype was validated against five sample stalls. The real event needs to handle on the order of **10,000 users** across the four days — stall members checking in, coordinators running POS during rush periods, and a much larger set of attendees hitting the public leaderboard. That changes real decisions: which reads get cached, whether the database sees a write storm or a read storm, how offline POS entries get reconciled without creating duplicate money. `03-ARCHITECTURE.md` is written for that load, not the prototype's.

## Reading order

1. `01-ROLES_AND_PERMISSIONS.md` — who can do what, and the two workflows that carry real accountability (attendance, sales verification).
2. `02-DATA_MODEL.md` — the schema, keyed to the flat no-college hierarchy above.
3. `03-ARCHITECTURE.md` — how this actually runs in production at event scale: persistence, real-time sync, offline POS, security.
4. `04-FINANCIAL_LOGIC.md` — every formula on every dashboard, plus the edge cases the prototype didn't have to handle.
5. `05-UI_UX_GUIDELINES.md` — the design system, and specifically what to avoid so this doesn't read as a generic AI-built dashboard.
6. `06-ROADMAP.md` — the build stages, with a pilot as the go/no-go gate before the full rollout.

## Non-goals

- No college/principal login tier.
- No self-approval path for any role, ever, even as a "trusted user" convenience feature.
- No feature that requires a network connection to complete a POS sale — event Wi-Fi is not reliable, and the coordinator's screen has to keep working through a dead spot.
