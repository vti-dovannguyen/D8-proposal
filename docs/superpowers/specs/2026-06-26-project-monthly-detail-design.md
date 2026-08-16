# Project Monthly Detail — Design Spec

**Date:** 2026-06-26
**Status:** Approved (design), pending spec review
**Phase:** 1 of 2 (per-project data foundation). Phase 2 = unit Billable/RA dashboard aggregation (`report-ra.webp`), separate spec.

## Background

The unit wants a weekly Billable/RA report (`report-ra.webp`) showing monthly EE,
headcount, PO and per-project man-months. None of that data exists in the schema today
(`MeetingEE` is weekly man-hours; `MeetingRA` is ad-hoc requests; `ProjectAllocation` is
hours/day per member). The agreed approach: capture the monthly figures **per project**
in a new "Project Monthly Detail" tab on the project detail page (`project-month.png`),
then aggregate to the unit dashboard in Phase 2.

Data source decision: **new monthly model with manual entry + spreadsheet import** into
the same table (table is source of truth; import is a bulk-fill shortcut).

## Scope

In scope (Phase 1):
- New `ProjectMonthlyDetail` model.
- New tab "Chi tiết theo tháng" on `/projects/[id]`.
- Manual add/edit/delete of monthly rows (manager-only).
- Computed `EE (%)` and `EE To Month (%)` with green/amber/red status.
- Paste-from-Excel import.
- Unit tests + `CLAUDE.md` update.

Out of scope (Phase 2): the unit `report-ra.webp` dashboard aggregation (EE/PO/headcount
overview + per-project breakdown across all projects).

## 1. Data model — `ProjectMonthlyDetail`

One row per project per month. All effort columns are `Float` (man-months, decimals).

```prisma
model ProjectMonthlyDetail {
  id                   String   @id @default(cuid())
  projectId            String
  project              Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  month                String   // "YYYY-MM", e.g. "2026-01"
  billableProject      Float    @default(0)
  billableDevelop      Float    @default(0)
  warrantyEffort       Float    @default(0)
  calendarMember       Float    @default(0)
  calendarIntern       Float    @default(0)
  calendarCollaborator Float    @default(0)
  otMemberEffort       Float    @default(0)
  otInternEffort       Float    @default(0)
  otCollaboratorEffort Float    @default(0)
  absent               Float    @default(0)
  eeToMonth            Float    @default(0) // "EE To Month (%)" — manual entry
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@unique([projectId, month])
  @@index([projectId])
}
```

Add `monthlyDetails ProjectMonthlyDetail[]` to the `Project` model.

`EE (%)` is **computed on read**, never stored (pattern follows `eeTotals` /
`skill-matrix`). `EE To Month (%)` is a **manual input field**, stored as `eeToMonth`.

## 2. EE computation — `src/lib/monthly-detail.ts` (pure, unit-tested)

Column order (canonical, matches the WR sheet; used by table + import parser):

`month · billableProject · billableDevelop · warrantyEffort · calendarMember ·
calendarIntern · calendarCollaborator · otMemberEffort · otInternEffort ·
otCollaboratorEffort · absent · ee · eeToMonth`

`ee` is the computed column (ignored on import — recomputed); `eeToMonth` is stored.

Helpers:

- `eeDenominator(row) = calendarMember + calendarIntern + otMemberEffort − absent`
- `ee(row)` = `denominator <= 0 ? 0 : billableProject / denominator * 100`
- `monthlyTotals(rows)` = per-column sums for the footer row (effort columns only; the
  `EE` / `EE To Month` footer cells stay blank, as in the image).

Note: `eeToMonth` is manual input, not computed — there is no `eeToMonth()` helper.
- `EE_THRESHOLDS = { green: 90, amber: 80 }` and `eeStatus(value)`:
  `value >= 90 → "green"`, `80 <= value < 90 → "amber"`, `value < 80 → "red"`.
  Constant for now; can move to master-data later without changing call sites.

Rounding: display EE to 2 decimals; store raw inputs unrounded.

## 3. Tab UI — `src/app/(portal)/projects/[id]/monthly-detail-tab.tsx`

Client component mirroring `allocations-tab.tsx`:

- Rows sorted ascending by `month`.
- 11 numeric input columns (10 effort fields + `EE To Month %`; `type=number`,
  `step=0.01`, `min=0`), edited locally, persisted on blur via `updateMonthlyDetail`.
- `EE (%)` is a **read-only computed cell**; `EE To Month (%)` is an **editable input**.
  Both show a colored status dot (green/amber/red) from `eeStatus`.
- Footer totals row from `monthlyTotals`.
- Add-row form: month input (`<input type="month">` → "YYYY-MM") + numeric fields →
  `addMonthlyDetail`. Empty state when no rows.
- Non-managers (`canEdit = can(role, "project:manage")` from the page) see read-only
  cells and no add form / import / delete — same gating as sibling tabs.

Registered in `projects/[id]/page.tsx` `tabs` array as
`{ id: "monthly", label: "Chi tiết theo tháng", content: <MonthlyDetailTab … /> }`,
placed after "Phân bổ nguồn lực". The page loads
`project.monthlyDetails` (ordered by `month`) and maps to a serializable shape.

## 4. Spreadsheet import

- A collapsible "Nhập từ Excel" panel (manager-only) with a `<textarea>`.
- User pastes rows copied from the WR sheet (tab-separated, one row per month, columns in
  the canonical order above).
- `parseMonthlyPaste(text)` (pure, in `monthly-detail.ts`):
  - Splits lines, skips blank lines and an optional header line.
  - Splits each line on tab; validates `month` matches `YYYY-MM`; coerces numbers
    (empty → 0, invalid → row error). The `ee` column is ignored (recomputed);
    `eeToMonth` is read and stored.
  - Returns `{ rows: ParsedRow[], errors: string[] }` — never throws on bad input.
- `importMonthlyDetails(projectId, text)` action: parse, then **upsert** each row by
  `[projectId, month]` (paste overwrites that month). Returns the error list so the UI
  can surface malformed lines instead of silently dropping them.

## 5. Server actions — `src/app/(portal)/projects/[id]/actions.ts`

All guard `project:manage` via existing `requireManager()`; all `revalidatePath(`/projects/${projectId}`)`.

- `addMonthlyDetail(projectId, form)` — create; rejects duplicate month (unique constraint).
- `updateMonthlyDetail(id, projectId, form)` — update one row.
- `deleteMonthlyDetail(id, projectId)` — delete one row.
- `importMonthlyDetails(projectId, text)` — bulk upsert from paste.

`cleanMonthly(form)` validator: require valid `YYYY-MM`; coerce each effort field and
`eeToMonth` to a finite number `>= 0` (negatives clamped to 0 / rejected).

## 6. Tests & docs

- `tests/monthly-detail.spec.ts`:
  - `ee`: normal case, zero denominator → 0, negative denominator → 0.
  - `monthlyTotals`: effort column sums.
  - `eeStatus`: boundaries at 90 and 80.
  - `parseMonthlyPaste`: valid TSV, header skipped, malformed month, non-numeric cell,
    `ee` column ignored, `eeToMonth` stored.
- Update `CLAUDE.md`: new model under Data model, `monthly-detail.ts` under lib reference,
  new actions under projects/[id], and the new tab in the route description.

## Acceptance criteria

1. A manager can open a project, see "Chi tiết theo tháng", add a month row; the EE %
   cell computes and colors correctly, and EE To Month % is an editable, colored cell.
2. Editing a numeric cell and blurring persists the value; reload shows it.
3. Pasting WR sheet rows fills/overwrites the matching months; malformed lines are
   reported, valid lines still import.
4. A non-manager sees the data read-only with no edit/add/import/delete controls.
5. Deleting a row removes it; the totals and EE-to-month recompute.
6. All unit tests pass; `npm run lint` and `npm run build` are clean.

## Open / deferred

- Exact green/amber thresholds confirmed at 90/80; revisit if real targets differ.
- Phase 2 dashboard aggregation (unit overview rows EE/LB+QA+OT/Intern/Chính thức/PO and
  per-project breakdown) is a separate spec built on this table.
