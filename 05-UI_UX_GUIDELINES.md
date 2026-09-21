# UI/UX Guidelines

One consistent design system across all three roles, so a Coordinator's phone and Admin's laptop never feel like different products. This file is also a direct answer to the thing that's easy to get wrong when a system like this gets rebuilt fast: it starts looking like every other AI-generated dashboard. The fix is specific choices, not a vague "make it nicer."

## What to avoid

These are the tells of a generic, ungrounded build — avoid them on purpose, not by accident:

- **The default purple-to-indigo (or blue-to-violet) gradient background on every card and hero section.** It's the single most recognizable "AI made this" signal. If a gradient is used at all, it should come from the role accent colors below and be used sparingly — an accent, not the base layer.
- **Glassmorphism everywhere** — frosted, translucent cards stacked on top of each other with no real reason. A stat card doesn't need to look like frosted glass to be legible.
- **Uniform rounded-everything with the same soft drop shadow on every element.** If every card, button, and modal has identical 16px corners and the same shadow, nothing has visual weight or hierarchy — everything looks equally important, which means nothing does.
- **One typeface (usually Inter) doing every job** — headings, numbers, body text, labels all at the same weight with only size changing. Pick a real pairing (below) and let it carry hierarchy.
- **Generic SaaS marketing copy tone** ("Unlock real-time insights," "Empower your team") on a tool that people will actually use standing at a stall table. Say what the button does: "Verify or reject," not "Take action."
- **Emoji as a substitute for iconography.** Fine sparingly for warmth; not as the entire icon system.
- **Stock "futuristic dashboard" illustration or generic 3D blob art** on empty states or login screens. If there's no real event photography or branding to use, prefer simple, specific line icons over decorative filler.

## What to do instead

- **Let role color do the work, not gradients.** Admin indigo, Stall Coordinator amber, Member rose — solid, confident use in badges, avatars, and nav is enough to make the role instantly legible at a glance. This is already load-bearing in the spec; don't dilute it by also gradient-washing every background.
- **Pick a type pairing with real contrast.** A sturdier, slightly condensed display face for the big numbers on stat cards (gross sales, break-even %) paired with a plain, highly legible workhorse face for body copy and labels. The numbers are the product here — let them look like numbers that matter, not like a placeholder.
- **Design for the actual physical conditions.** Stat cards get read on a phone screen in a bright registration hall at noon and in a dim backstage ops corner at night — that's why dark/light theming is already in scope. High contrast and large, thumb-reachable touch targets aren't a nice-to-have, they're the actual usage condition.
- **Ground it in the event, not in generic dashboard tropes.** If Pravara/Building Pravara has existing branding, colors, or a mascot, pull from that instead of a default design-system palette. A QR identity card should look like an event badge someone would actually clip on, not like a floating UI mockup.
- **Restrained motion.** A verified sale updating a leaderboard should feel like a ledger updating — a number changing, maybe a brief highlight — not a confetti burst or a bouncing animation. This is a tool people trust with money and attendance; the interface should read as sober and dependable, with warmth in the color and type choices, not in flashy transitions.

## Core components (carried over from the prototype, keep consistent)

- **Stat cards** — label, value, short note. First thing every dashboard shows, Member and Admin alike.
- **Segmented tabs** — e.g. "Business Analytics" vs "POS," keeping related views one tap apart.
- **Progress metrics** — labelled progress bars for attendance %, break-even recovery %, team-present % — same visual language for every percentage in the app.
- **Leaderboard & medals** — gold/silver/bronze for top three, recalculated live on verification.
- **QR identity modal** — a verified, scannable identity card per user; the basis of the attendance workflow.
- **Notification center** — per-role inbox for warnings, verification requests, announcements, with unread counts.
- **Dark/light theme toggle** — full theme switch, not just a color inversion; check contrast in both explicitly rather than assuming it holds.

## Screen-specific notes

- **POS fast entry (Coordinator):** single-hand, thumb-reachable, large touch targets. This runs at a crowded stall table, not a desk — no interaction should depend on hover or a precise tap target.
- **Login/role selection:** three tiles only — Admin, Stall Coordinator, Member. No college or principal tile; that layer doesn't exist in this system (see `00-PROJECT_CONTEXT.md`).
- **Member's stall dashboard:** identical financial view to what the coordinator sees, not a stripped-down "personal earnings" version — the whole point is business literacy, not just staff tracking.
