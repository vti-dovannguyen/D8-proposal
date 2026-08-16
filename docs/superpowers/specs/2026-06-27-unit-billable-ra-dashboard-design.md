# Unit Billable/RA Dashboard Section — Design Spec

**Date:** 2026-06-27
**Status:** Approved (design), pending spec review
**Phase:** 2 of 2. Phase 1 (`docs/superpowers/specs/2026-06-26-project-monthly-detail-design.md`) built the per-project `ProjectMonthlyDetail` data this section aggregates.

## Background

The unit weekly report (`report-ra.webp`) shows a *Billable / RA* view over 3 months:
a **Tổng quan** block (EE, LB+QA+OT, Intern, Chính thức, PO per month) and a
**Chi tiết theo dự án** block (per-project value per month). Phase 1 captured per-project
monthly man-months. Phase 2 renders the unit report on the dashboard by **computing**
EE / PO / per-project figures from Phase 1, and storing only the three **headcount** rows
(which are people-counts, absent from the system) as manual unit-level monthly data.

## Scope

In scope:
- New `UnitMonthly` model (manual headcounts: LB+QA+OT, Intern, Chính thức).
- Pure aggregation helpers computing EE, PO, and per-project breakdown from `ProjectMonthlyDetail`.
- A manager-editable Billable/RA section on the existing `/dashboard` page.
- Unit tests + `CLAUDE.md` update.

Out of scope: editing Phase 1 per-project data (done in Phase 1); any export/print of the report.

## Decisions (locked)

- **Headcount source:** new manual `UnitMonthly` record. EE, PO, per-project breakdown computed.
- **PO formula:** `PO = Σ billableProject` across all projects, per month.
- **EE formula (unit):** `Σ billableProject / Σ eeDenominator × 100`, 0 when `Σ eeDenominator ≤ 0`,
  where `eeDenominator = calendarMember + calendarIntern + otMemberEffort − absent` (reused from
  `monthly-detail.ts`). Status colors reuse Phase 1 `eeStatus` (≥90 green / 80–90 amber / <80 red).
- **Month window:** current month + next 2 (rolling forecast), derived from today; no picker.
- **Placement:** a section on `/dashboard`.
- **Project rows:** all active projects (0 where a month has no `ProjectMonthlyDetail`).
- **Edit gating:** `project:manage` (MANAGERS — ADMIN / DIVISION_LEADER / SECTION_MANAGER; not PM).
  View via the existing `dashboard:view` (all non-MEMBER roles).

## 1. Data model — `UnitMonthly`

```prisma
model UnitMonthly {
  id        String   @id @default(cuid())
  month     String   @unique   // "YYYY-MM"
  lbQaOt    Int      @default(0)
  intern    Int      @default(0)
  official  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
Integers (people counts). No relation to `Project` — this is unit-level. Months with no row
are treated as all-zero.

## 2. Pure aggregation — `src/lib/unit-report.ts` (unit-tested)

- `rollingMonths(from: Date): string[]` → 3 `"YYYY-MM"` strings: the month of `from` plus the
  next two, rolling across year boundaries (e.g. `2026-11` → `["2026-11","2026-12","2027-01"]`).
  `from` is injected (the server component passes `new Date()`), keeping the helper testable.
- Input row type (subset of Phase 1 fields needed):
  `type ProjMonthRow = { project: string; month: string; billableProject: number; calendarMember: number; calendarIntern: number; otMemberEffort: number; absent: number }`
- `aggregateUnitReport(rows: ProjMonthRow[], months: string[], projectNames: string[])`:
  returns `{ projectRows: { project: string; values: number[] }[]; po: number[]; ee: number[] }`.
  - `projectRows`: one entry per name in `projectNames` (preserving input order), `values[i]` =
    `billableProject` for `months[i]` (0 if absent).
  - `po[i]` = Σ `billableProject` over all rows in `months[i]`.
  - `ee[i]` = `den <= 0 ? 0 : (Σ billableProject / den) * 100`, where
    `den = Σ (calendarMember + calendarIntern + otMemberEffort − absent)` over rows in `months[i]`.
  - Rounding: EE/PO formatted to 2 decimals at display; helper returns raw numbers.
- Month label: `monthLabel(month: string, months: string[])` → `Tháng {M}`; appends `/{YYYY}` only
  when the 3-month window spans more than one calendar year.
- Reuses `eeDenominator` from `monthly-detail.ts` (no re-derivation).

## 3. Server action — `src/app/(portal)/dashboard/actions.ts` (new file)

- `setUnitHeadcount(month: string, field: "lbQaOt" | "intern" | "official", value: number)`:
  - Guards `project:manage` (throws `"Forbidden"` otherwise).
  - Validates `month` against `/^\d{4}-(0[1-9]|1[0-2])$/`; rejects unknown `field`.
  - Coerces `value` to a non-negative integer (`Math.max(0, Math.round(n))`; rejects NaN).
  - Upserts `UnitMonthly` by `month` (creates with the other two fields defaulting to 0).
  - `revalidatePath("/dashboard")`.

## 4. Dashboard section

- `src/app/(portal)/dashboard/page.tsx` (existing server component):
  - `const months = rollingMonths(new Date())`.
  - Query in parallel: `ProjectMonthlyDetail` where `month ∈ months` (select project name + the 5
    `ProjMonthRow` fields), all active `Project` (select `name`, ordered), `UnitMonthly` where
    `month ∈ months`.
  - Map Phase 1 rows to `ProjMonthRow[]`, call `aggregateUnitReport`, build a headcount lookup
    (`{ [month]: { lbQaOt, intern, official } }`, defaulting missing months to 0).
  - Render `<BillableRaSection months overview projectRows headcounts canEdit />` where
    `canEdit = can(role, "project:manage")`, alongside the existing `MeetingStatusWidget`.
- `src/app/(portal)/dashboard/billable-ra-section.tsx` (new client component):
  - **Tổng quan** table: columns = the 3 month labels; rows:
    - `EE` — computed, read-only, with `eeStatus` color dot + `toFixed(2)`.
    - `LB+QA+OT`, `Intern`, `Chính thức` — manager: inline editable integer cells (persist on blur
      via `setUnitHeadcount`, using the Phase 1 edit-buffer pattern so partial typing isn't
      clobbered); viewer: read-only.
    - `PO` — computed, read-only, `toFixed(2)`.
  - **Chi tiết theo dự án** table: one row per active project, `billableProject` per month.
  - Empty state when there are no active projects.

## 5. Tests & docs

- `tests/unit-report.test.ts`:
  - `rollingMonths`: mid-year window, year-boundary roll (Nov, Dec).
  - `aggregateUnitReport`: po sum, ee aggregation, Σdenominator ≤ 0 → ee 0, project with no row in a
    month → 0, project ordering preserved.
  - `monthLabel`: same-year vs cross-year window.
- `tests/dashboard-actions.test.ts`:
  - `setUnitHeadcount`: blocks MEMBER/PM (non-manager), rejects bad month / unknown field,
    coerces negative/fractional to a non-negative integer, upserts by month.
- Update `CLAUDE.md`: `UnitMonthly` under Data model; `unit-report.ts` under lib reference;
  `setUnitHeadcount` + the dashboard section under the dashboard/route description.

## Acceptance criteria

1. On `/dashboard`, a manager sees the Billable/RA section with 3 rolling months, EE & PO computed
   from Phase 1 data (color-dotted EE), the per-project breakdown for all active projects, and the
   three headcount rows as editable cells.
2. Editing a headcount cell and blurring persists it (integer, ≥ 0); reload shows it.
3. A non-manager (e.g. PM or MEMBER-but-viewer) sees the section read-only — no editable headcount cells.
4. EE/PO/per-project values match `Σ`/formula over the underlying `ProjectMonthlyDetail` rows;
   months with no data show 0.
5. The month window auto-advances with the current date (no picker).
6. All unit tests pass; `npm run build` is clean.

## Open / deferred

- Thresholds for EE color are shared with Phase 1 (90/80); the middle sample month renders amber,
  not red as in the raw screenshot — adjust thresholds later if the unit wants a 2-color scheme.
- No export/print of the report in this phase.
