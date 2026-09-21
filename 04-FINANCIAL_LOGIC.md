# Financial Logic

Every number Vertex shows a stall or Admin comes from a small, transparent formula set — the same math any small business uses to know if it's making money. Members see the same numbers a coordinator sees; there is no simplified or hidden version for them.

## Formulas

| Metric | Formula |
|---|---|
| Gross Sales | Online Sales + Offline Sales |
| Total Expenses | Σ (Rent + Banner + Material + …) |
| Net Profit | Gross Sales − Total Expenses |
| Break-even | Reached when Gross Sales ≥ Total Expenses |
| % of Expenses Recovered | min(100, round(Gross Sales ÷ Total Expenses × 100)) |
| Amount Needed to Break Even | Total Expenses − Gross Sales (only while below break-even; 0 once cleared) |

Only **verified** sales_submissions count toward Gross Sales — a `pending` or `rejected` submission is invisible to every one of these formulas until an Admin acts on it.

## Worked examples (from the prototype's sample data)

**AI Playground — profitable**
- Gross Sales: ₹45,600 · Total Expenses: ₹22,500 · Net Profit: ₹23,100 · Recovered: 100% (break-even cleared)

**ByteBazaar — below break-even**
- Gross Sales: ₹19,400 · Total Expenses: ₹21,700 · Net Profit: −₹2,300 · Recovered: 89% · ₹2,300 needed

This is the gap Admin can only see live with Vertex: ByteBazaar is 89% of the way to profitability with the event still running — a signal to intervene (extra footfall, a promo push) before the event ends, not after.

## Edge cases the sample data doesn't cover

- **Total Expenses = 0.** The Recovered % formula divides by expenses — a stall with no logged expenses yet must not throw a divide-by-zero or show a nonsense percentage. Treat it as "Recovered: N/A" or 100% only once a sale exists, and make the empty-expenses state visually distinct from an actual 100%.
- **Rounding.** Standardize on round-half-up for the displayed percentage; don't let two different screens round the same number two different ways.
- **Currency display.** All amounts are ₹ (INR); format with the Indian digit-grouping convention (₹1,62,500, not ₹162,500) since that's the audience reading these dashboards.
- **What counts as "a day."** The event runs four consecutive days. Define the day boundary for "Finish my day" explicitly (event-local midnight, not each device's clock) so two coordinators submitting near midnight don't end up with sales attributed to different days.
- **A rejected submission is not a deletion.** Keep rejected `sales_submissions` rows for the audit trail — a rejected log should be visible to Admin's history and to the coordinator who submitted it, just excluded from every financial total.
- **Editing an already-verified submission.** Don't allow it. If a verified number was wrong, the correction is a new submission (a correcting entry) with its own audit trail — not a silent edit of a number three dashboards already displayed.
