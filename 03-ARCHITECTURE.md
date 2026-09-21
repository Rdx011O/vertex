# Architecture — Beyond the Prototype

The prototype is a single HTML/CSS/JS file with sample data for five stalls, holding state in memory. That was correct for proving workflows. None of it survives a real event. This is what has to sit underneath it, sized for roughly 10,000 users across four days rather than a demo.

## Layers

| Layer | What changes for production |
|---|---|
| Persistence | Real relational database (PostgreSQL) so every stall, sale, and attendance record survives restarts and crashes across a 4-day event. |
| Backend API | A stateless server (Node.js/Express or similar) owning every business rule — only it can write an attendance confirmation or a verified sale. No client, however trusted, writes those rows directly. |
| Authentication | Real login (email/OTP or ID-card issued credentials), signed session tokens — not the prototype's one-tap role picker. |
| Real-time sync | WebSockets so a Member's dashboard updates the instant Admin verifies a sale, without a manual refresh. |
| Offline-first POS | The Coordinator's POS screen queues sales locally and syncs when connectivity returns — event Wi-Fi is unreliable by default, not an edge case. |
| Audit trail | Every state change writes to an immutable log — this is the actual mechanism behind "one accountable signature," not the schema alone. |

## Sizing for ~10,000 users

This is a **read-heavy, bursty-write** system, not a steady trickle: dashboards get watched constantly (leaderboard, live sales), while writes cluster around rush periods at each stall.

- **Stateless backend behind a load balancer** — no in-process session state, so any instance can serve any request; scale horizontally by adding instances during peak hours (lunch rushes, event opening).
- **Read replica for dashboard queries** — Event Command Center, leaderboard, and per-stall dashboards read from a replica; writes (attendance confirmations, sales verification) go to the primary. Keeps the money-and-attendance write path from competing with 10,000 people refreshing a leaderboard.
- **Cache the derived numbers, don't recompute them per request** — gross sales, break-even %, and leaderboard rank change only when a sale is verified or an expense is added. Recompute once on that event, cache in Redis, invalidate on the next write. Don't run the break-even formula fresh on every dashboard load.
- **WebSocket layer with a pub/sub adapter (e.g. Redis-backed Socket.io)** — once you have more than one backend instance, a plain in-memory WebSocket broadcast only reaches clients connected to that instance. Pub/sub lets any instance's verification event reach every connected dashboard.
- **Offline queue with idempotency, not just retry** — the POS screen queues submissions in local storage and syncs on reconnect. Every submission carries an idempotency key (see `02-DATA_MODEL.md`) so a retried request after a dropped connection cannot double-count a sale.
- **Rate-limit write-heavy endpoints** — "notify coordinator on arrival" and POS entry are the two endpoints 10,000 real people will hit hardest; rate-limit per user to blunt accidental double-taps and abuse, not just malicious traffic.
- **CDN for static assets**; QR codes generated once and cached, not regenerated per view.

## Security

- RBAC enforced server-side on every endpoint — the permission matrix in `01-ROLES_AND_PERMISSIONS.md` is a spec for middleware, not just for hiding buttons.
- PII (names, IDs, phone numbers) encrypted at rest.
- TLS everywhere, including internal service calls if the backend is split into multiple services.
- Nightly backups during the event window, with point-in-time recovery — a four-day live event is not the moment to discover the last backup was a week old.

## Before Oct 1

- **Load test against the actual expected concurrency**, not the prototype's five stalls — simulate dashboard polling/WebSocket connections and POS submission bursts at the scale you expect during a stall rush.
- **Rehearse the offline-sync path deliberately**: kill connectivity mid-POS-entry in a test, confirm reconnect produces exactly one sale, not zero or two.
- **Confirm the read-replica lag is short enough** that a coordinator doesn't see stale numbers seconds after their own verified sale — if it's not, route the coordinator's own stall dashboard to the primary and leave replicas for the public leaderboard.

This system scales from one Building Pravara stall floor to a multi-city, multi-event deployment without a schema redesign — the roadmap in `06-ROADMAP.md` treats that as a later stage, not a requirement for this event.
