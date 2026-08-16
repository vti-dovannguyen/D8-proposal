# Weekly Report Form: Week Select Box

## Context

The Weekly Report create/edit form (`src/app/(portal)/meetings/meeting-form.tsx`) has a free-text "Tuần" input and separate "Từ"/"Đến" `datetime-local` inputs the user fills in manually. This replaces "Tuần" with a select box of pre-generated weeks, each auto-filling its corresponding Từ/Đến date range on selection.

## Week data

Weeks are Saturday-to-Friday spans: week N's "this Friday" is the Friday whose ISO week number is N, and `weekStart` is the Saturday immediately after week (N-1)'s Friday (i.e. `thisFriday - 6 days`, not the previous Friday itself). This was corrected during final review: a Friday-to-Friday design makes adjacent weeks share a calendar date at the boundary (week N's `weekEnd` date = week N+1's `weekStart` date), and the existing Summary Weekly rollup query (`queryWeeklySummaryReport`) matches by date only — so every week's rollup would incorrectly also pull in the adjacent week's meeting on both sides. Starting each week on the Saturday after the previous Friday keeps every week 7 days long while ensuring no two weeks ever share a boundary date. Verified against the calendar:

| Week | Từ (weekStart, Saturday) | Đến (weekEnd, this Friday) |
|------|---------------------------|------------------------------|
| 29 | 2026-07-11 | 2026-07-17 |
| 30 | 2026-07-18 | 2026-07-24 |
| 31 | 2026-07-25 | 2026-07-31 |
| ... | ... | ... |
| 53 | 2026-12-26 | 2027-01-01 |

Week 53 is included (also corrected during final review, so the create screen doesn't run out of valid weeks starting 2026-12-26) even though its "this Friday" (2027-01-01) falls in the next calendar year — it's still ISO week 53 "of 2026" by this feature's numbering.

Từ/Đến datetime-local values use `00:00` / `23:59` (matching the existing convention already used elsewhere in this codebase, e.g. the Summary Weekly report's date-range query).

## New file: `src/lib/meeting-week-options.ts`

```ts
export type MeetingWeekOption = {
  week: string;       // e.g. "Tuần 29" — the MeetingFormData.week value
  label: string;      // e.g. "Tuần 29 (11/07 – 17/07)" — dropdown display text
  weekStart: string;  // "YYYY-MM-DDT00:00"
  weekEnd: string;    // "YYYY-MM-DDT23:59"
};

/**
 * Generates week options from `startWeek` through `endWeek` (inclusive),
 * where week N's "this Friday" is 7 days after week (N-1)'s, and `weekStart`
 * is the Saturday immediately after week (N-1)'s Friday — never the previous
 * Friday itself, so adjacent weeks never share a calendar date.
 */
export function generateWeekOptions(startWeek: number, startWeekFriday: string, endWeek: number): MeetingWeekOption[];

export const MEETING_WEEK_OPTIONS: MeetingWeekOption[]; // generateWeekOptions(29, "2026-07-17", 53)
```

`generateWeekOptions` is a pure function (testable in isolation: correct count, 7-day spacing, correct label format, no two adjacent entries share a boundary date). `MEETING_WEEK_OPTIONS` is the single ready-to-import constant the form uses, computed once at module load — this is a fixed, one-off 2026 dataset, not a general "any year" system.

## Form UI changes (`meeting-form.tsx`)

- Import `MEETING_WEEK_OPTIONS` from `@/lib/meeting-week-options`.
- Replace the "Tuần" `<input>` with a `<select>`:
  - A placeholder option (`value=""`, "Chọn tuần…") always rendered first (not conditionally — this is simpler and also gives a clean, visible validation state if a value is ever cleared).
  - One `<option value={opt.week}>{opt.label}</option>` per `MEETING_WEEK_OPTIONS` entry.
  - **Edit-screen fallback:** if `initial.week` (captured once, not `form.week`, so it doesn't change as the user picks new weeks) is non-empty and not present in `MEETING_WEEK_OPTIONS`, prepend one extra option `{ value: initial.week, label: \`${initial.week} (tuỳ chỉnh)\` }` so the existing value is always selectable and never silently dropped, and reads as distinct from a real generated week (e.g. a cloned meeting's `"Tuần 31 (copy)"` won't look like a near-duplicate of the real `"Tuần 31 (…)"` entry).
- `onChange` handler: look up the selected `week` value in `MEETING_WEEK_OPTIONS`.
  - If found: `setForm(f => ({ ...f, week: opt.week, weekStart: opt.weekStart, weekEnd: opt.weekEnd, weekRange: composeWeekRange(opt.weekStart, opt.weekEnd, f.weekRange) }))` (reuses the existing `composeWeekRange` helper already in this file).
  - If not found (the injected fallback option, or the placeholder): `setForm(f => ({ ...f, week: value }))` only — leave `weekStart`/`weekEnd`/`weekRange` untouched.
- Existing validation (`validationErrors.week` requires `form.week.trim()`) is unchanged and still applies correctly to the select.

## Out of scope

- No change to how `weekStart`/`weekEnd` are validated or persisted server-side (`actions.ts` is untouched).
- No change to the "Từ"/"Đến" `datetime-local` inputs themselves — they still exist and still update `weekRange` live via the existing `setWeekDate` handler, so a user can still hand-adjust a selected week's dates afterward if needed.
- No generalization to other years or a configurable start week — this is a fixed 2026 dataset per the request. (Deferred follow-up: regenerate/extend the dataset for 2027 before the list runs out.)
- No fallback ("Khác…" free-text escape hatch) on the create screen if the generated dataset ever runs out again — deferred; the edit-screen fallback only covers meetings that already exist.
