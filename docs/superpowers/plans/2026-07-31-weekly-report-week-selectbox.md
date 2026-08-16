# Weekly Report Week Select Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "Tuần" input on the Weekly Report create/edit form with a select box of pre-generated Friday-to-Friday weeks (29–52 of 2026), auto-filling Từ/Đến on selection.

**Architecture:** A new pure generator function produces a fixed, testable list of week options (label + datetime-local Từ/Đến strings) in a small new lib file. The shared `MeetingForm` component imports that list, swaps the "Tuần" `<input>` for a `<select>`, and its `onChange` sets `week`/`weekStart`/`weekEnd`/`weekRange` together in one update.

**Tech Stack:** Next.js 16.2 App Router, React 19 (client component), Vitest.

## Global Constraints

- Weeks are Friday-to-Friday spans; week N's "this Friday" is the Friday whose ISO week number is N. Weeks 29–52 of 2026 only (week 53's end date falls in 2027, excluded).
- Từ = `00:00`, Đến = `23:59` on the Friday dates (matches the existing datetime-local convention already used elsewhere in this codebase).
- Dropdown option label format: `"Tuần {N} ({DD/MM prev Friday} – {DD/MM this Friday})"`.
- On the edit screen, if the meeting's current `week` value isn't in the generated list, inject it as an extra option so it's never silently dropped or reset; selecting that injected option must NOT touch `weekStart`/`weekEnd`/`weekRange`.
- No change to `actions.ts`, validation logic, or the Từ/Đến `datetime-local` inputs themselves (they stay, for manual override after a week is picked).

---

### Task 1: Week option generator (`src/lib/meeting-week-options.ts`)

**Files:**
- Create: `src/lib/meeting-week-options.ts`
- Test: `tests/meeting-week-options.test.ts`

**Interfaces:**
- Produces: `MeetingWeekOption` type (`{ week: string; label: string; weekStart: string; weekEnd: string }`), `generateWeekOptions(startWeek: number, startWeekFriday: string): MeetingWeekOption[]`, `MEETING_WEEK_OPTIONS: MeetingWeekOption[]` (= `generateWeekOptions(29, "2026-07-17")`).

- [ ] **Step 1: Write the failing tests**

Create `tests/meeting-week-options.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateWeekOptions, MEETING_WEEK_OPTIONS } from "@/lib/meeting-week-options";

describe("generateWeekOptions()", () => {
  it("generates Friday-to-Friday weeks with 7-day spacing and correct labels", () => {
    const opts = generateWeekOptions(29, "2026-07-17");
    expect(opts[0]).toEqual({
      week: "Tuần 29",
      label: "Tuần 29 (10/07 – 17/07)",
      weekStart: "2026-07-10T00:00",
      weekEnd: "2026-07-17T23:59",
    });
    expect(opts[1]).toEqual({
      week: "Tuần 30",
      label: "Tuần 30 (17/07 – 24/07)",
      weekStart: "2026-07-17T00:00",
      weekEnd: "2026-07-24T23:59",
    });
  });

  it("stops before crossing into the next year", () => {
    const opts = generateWeekOptions(29, "2026-07-17");
    const last = opts[opts.length - 1];
    expect(last).toEqual({
      week: "Tuần 52",
      label: "Tuần 52 (18/12 – 25/12)",
      weekStart: "2026-12-18T00:00",
      weekEnd: "2026-12-25T23:59",
    });
    expect(opts.every((o) => o.weekEnd.startsWith("2026"))).toBe(true);
    expect(opts.length).toBe(24);
  });

  it("MEETING_WEEK_OPTIONS matches generateWeekOptions(29, \"2026-07-17\")", () => {
    expect(MEETING_WEEK_OPTIONS).toEqual(generateWeekOptions(29, "2026-07-17"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/meeting-week-options.test.ts`
Expected: FAIL — `Cannot find module '@/lib/meeting-week-options'` (file doesn't exist yet).

- [ ] **Step 3: Implement the generator**

Create `src/lib/meeting-week-options.ts`:

```ts
export type MeetingWeekOption = {
  week: string;
  label: string;
  weekStart: string;
  weekEnd: string;
};

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDayMonth(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${m}`;
}

/**
 * Generates Friday-to-Friday week options starting at week `startWeek`
 * (whose "this Friday" is `startWeekFriday`, "YYYY-MM-DD"), stepping forward
 * 7 days at a time until the next Friday would fall in a later calendar year.
 */
export function generateWeekOptions(startWeek: number, startWeekFriday: string): MeetingWeekOption[] {
  const options: MeetingWeekOption[] = [];
  const [y, m, d] = startWeekFriday.split("-").map(Number);
  let thisFriday = new Date(y, m - 1, d);
  const year = thisFriday.getFullYear();
  let week = startWeek;
  while (thisFriday.getFullYear() === year) {
    const prevFriday = new Date(thisFriday);
    prevFriday.setDate(prevFriday.getDate() - 7);
    options.push({
      week: `Tuần ${week}`,
      label: `Tuần ${week} (${toDayMonth(prevFriday)} – ${toDayMonth(thisFriday)})`,
      weekStart: `${toDateOnly(prevFriday)}T00:00`,
      weekEnd: `${toDateOnly(thisFriday)}T23:59`,
    });
    week += 1;
    thisFriday = new Date(thisFriday);
    thisFriday.setDate(thisFriday.getDate() + 7);
  }
  return options;
}

export const MEETING_WEEK_OPTIONS: MeetingWeekOption[] = generateWeekOptions(29, "2026-07-17");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/meeting-week-options.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/meeting-week-options.ts tests/meeting-week-options.test.ts
git commit -m "feat: add generated Friday-to-Friday week options for weekly report"
```

---

### Task 2: Wire the select box into `MeetingForm`

**Files:**
- Modify: `src/app/(portal)/meetings/meeting-form.tsx`

**Interfaces:**
- Consumes: `MEETING_WEEK_OPTIONS`, `MeetingWeekOption` from `@/lib/meeting-week-options` (Task 1).

- [ ] **Step 1: Import the week options**

In `src/app/(portal)/meetings/meeting-form.tsx`, add to the import block (after line 9's `@/lib/meetings` import):

```tsx
import { MEETING_WEEK_OPTIONS } from "@/lib/meeting-week-options";
```

- [ ] **Step 2: Compute the effective option list and the select handler**

Right after the `const set = ...` line (currently line 53), add:

```tsx
  const weekOptions = useMemo(() => {
    if (initial.week && !MEETING_WEEK_OPTIONS.some((o) => o.week === initial.week)) {
      return [{ week: initial.week, label: initial.week, weekStart: "", weekEnd: "" }, ...MEETING_WEEK_OPTIONS];
    }
    return MEETING_WEEK_OPTIONS;
  }, [initial.week]);

  function handleWeekSelect(value: string) {
    const generated = MEETING_WEEK_OPTIONS.find((o) => o.week === value);
    if (generated) {
      setForm((f) => ({
        ...f,
        week: generated.week,
        weekStart: generated.weekStart,
        weekEnd: generated.weekEnd,
        weekRange: composeWeekRange(generated.weekStart, generated.weekEnd, f.weekRange),
      }));
    } else {
      set("week", value);
    }
  }
```

- [ ] **Step 3: Replace the "Tuần" input with a select**

Replace the existing "Tuần" `<label>` block (currently lines 135-139):

```tsx
        <label className="text-sm md:col-span-1">
          Tuần <span className="text-red-500">*</span>
          <input className="mt-1 w-full rounded border px-2 py-1" value={form.week} onChange={(e) => set("week", e.target.value)} />
          {validationErrors.week && <p className="mt-1 text-xs text-red-500">{validationErrors.week}</p>}
        </label>
```

with:

```tsx
        <label className="text-sm md:col-span-1">
          Tuần <span className="text-red-500">*</span>
          <select className="mt-1 w-full rounded border px-2 py-1" value={form.week} onChange={(e) => handleWeekSelect(e.target.value)}>
            <option value="">Chọn tuần…</option>
            {weekOptions.map((o) => <option key={o.week} value={o.week}>{o.label}</option>)}
          </select>
          {validationErrors.week && <p className="mt-1 text-xs text-red-500">{validationErrors.week}</p>}
        </label>
```

- [ ] **Step 4: Type-check and run the test suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm test`
Expected: all tests PASS (this file has no dedicated component tests today — Task 1's test covers the underlying data; the rest of the suite must stay green since nothing else changed).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(portal\)/meetings/meeting-form.tsx
git commit -m "feat: replace weekly report Tuan input with a week select box"
```

---

### Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, including Task 1's new `meeting-week-options` tests.

- [ ] **Step 2: Full project build**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in a browser go to `/meetings/new`:
1. Confirm "Tuần" is now a dropdown listing "Tuần 29 (10/07 – 17/07)" through "Tuần 52 (18/12 – 25/12)".
2. Pick a week (e.g. "Tuần 35") and confirm "Từ" auto-fills to that week's Friday-minus-7 date at 00:00, and "Đến" auto-fills to that week's Friday at 23:59.
3. Open an existing meeting in Edit whose "Tuần" value is one of the generated weeks (e.g. an older seeded meeting) and confirm the dropdown shows and keeps that value selected without altering its Từ/Đến on load.

- [ ] **Step 4: Commit** (only if the smoke test surfaced fixes; otherwise skip — nothing to commit)
