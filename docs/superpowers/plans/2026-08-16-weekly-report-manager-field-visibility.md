# Weekly Report manager field visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide Division Issues, Company Issues, Milestones, Next Week Plan, and Team Summary from Weekly Report create/edit/detail views for `SECTION_MANAGER`, `DIVISION_LEADER`, and `ADMIN`.

**Architecture:** Add a small role predicate in `src/lib/permissions.ts`, backed by the existing `isManager` role set. The client form and server-rendered detail page both consume that predicate; nested sub-project editors/renderers receive the same boolean so their Milestone and Next Week Plan blocks follow the top-level rule. Persisted values and server action payloads remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Keep `PM` and `MEMBER` behavior unchanged.
- Hide fields in both create/edit forms and the detail page.
- Hide nested sub-project Milestone and Next Week Plan blocks for manager roles.
- Do not delete or rewrite hidden persisted values when a manager saves a report.
- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before writing framework code; if the dependency is unavailable, record that verification limitation.
- Follow TDD: the visibility test must fail before the predicate is implemented.

---

### Task 1: Add and verify the shared role predicate

**Files:**
- Create: `tests/weekly-report-visibility.test.ts`
- Modify: `src/lib/permissions.ts`

**Interfaces:**
- Produces `shouldHideWeeklyReportFields(role: Role): boolean` for the form and detail tasks.

- [ ] **Step 1: Write the failing role-matrix test**

Create `tests/weekly-report-visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldHideWeeklyReportFields } from "@/lib/permissions";

describe("shouldHideWeeklyReportFields", () => {
  it.each([
    ["ADMIN", true],
    ["DIVISION_LEADER", true],
    ["SECTION_MANAGER", true],
    ["PM", false],
    ["MEMBER", false],
  ] as const)("returns %s for %s", (role, expected) => {
    expect(shouldHideWeeklyReportFields(role)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
npm test -- tests/weekly-report-visibility.test.ts
```

Expected: Vitest fails because `shouldHideWeeklyReportFields` is not exported from `src/lib/permissions.ts`. Do not modify production code before observing this failure.

- [ ] **Step 3: Implement the minimal predicate**

Append this function to `src/lib/permissions.ts`, after `isManager`:

```ts
export function shouldHideWeeklyReportFields(role: Role): boolean {
  return isManager(role);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm test -- tests/weekly-report-visibility.test.ts
```

Expected: all five role cases pass.

### Task 2: Apply visibility to create/edit forms

**Files:**
- Modify: `src/app/(portal)/meetings/meeting-form.tsx`

**Interfaces:**
- Consumes `shouldHideWeeklyReportFields(role)` from Task 1.
- Extends `GroupsEditor` with `hideMilestonesAndNextWeekPlans: boolean`.

- [ ] **Step 1: Add the predicate import and local visibility flag**

Import `shouldHideWeeklyReportFields` from `@/lib/permissions` and define:

```ts
const hideManagerFields = shouldHideWeeklyReportFields(role);
```

Keep the existing `isPm` checks for EE and current PM-specific behavior.

- [ ] **Step 2: Hide the requested top-level form fields**

Change the existing render guards so Division Issues and Company Issues use
`!isPm && !hideManagerFields`. Wrap the flat Milestone editor, Next Week Plan
editor, and Team Summary editor in `!hideManagerFields`; leave Risk and
Opportunities rendering unchanged.

- [ ] **Step 3: Thread the flag into grouped sub-project editing**

Pass `hideMilestonesAndNextWeekPlans={hideManagerFields}` to `GroupsEditor`.
Add the boolean prop to its parameter type. In each group, keep Progress and
Risk / Issue visible, but conditionally render the Milestone and Next Week Plan
blocks only when the prop is false. Renumber the Risk / Issue heading to `2.`
when those two blocks are hidden and keep `3.` otherwise.

- [ ] **Step 4: Type-check the changed form**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0 with no TypeScript errors from the new prop or predicate import.

### Task 3: Apply visibility to the detail page

**Files:**
- Modify: `src/app/(portal)/meetings/[id]/page.tsx`

**Interfaces:**
- Consumes `shouldHideWeeklyReportFields(role)` from Task 1.
- Uses the existing persisted meeting/group data without changing the Prisma query.

- [ ] **Step 1: Add the predicate import and local visibility flag**

Import `shouldHideWeeklyReportFields` from `@/lib/permissions` and define:

```ts
const hideManagerFields = shouldHideWeeklyReportFields(role);
```

- [ ] **Step 2: Hide top-level detail panels**

Change the Division Issues / Company Issues guard to `!isPm && !hideManagerFields`.
When `m.groups` is empty, render the Milestone and Next Week Plan cards only
when `hideManagerFields` is false; keep Issues/Risks visible. Render Team
Summary only when `hideManagerFields` is false.

- [ ] **Step 3: Hide nested detail blocks**

When rendering each group, conditionally omit the Milestone and Next Week Plan
blocks for manager roles, keep Progress and Risk / Issue, and use `2.` for
Risk / Issue when hidden or `3.` otherwise.

### Task 4: Run full verification and inspect the diff

**Files:**
- Verify: `tests/weekly-report-visibility.test.ts`, existing `tests/permissions.test.ts`, and the full test suite.
- Verify: `src/lib/permissions.ts`, `src/app/(portal)/meetings/meeting-form.tsx`, `src/app/(portal)/meetings/[id]/page.tsx`.

- [ ] **Step 1: Run focused and existing permission tests**

Run:

```bash
npm test -- tests/weekly-report-visibility.test.ts tests/permissions.test.ts
```

Expected: both files pass with zero failures.

- [ ] **Step 2: Run the complete unit test suite**

Run:

```bash
npm test
```

Expected: Vitest exits 0 with zero failed tests.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: Prisma generation and `next build` exit 0. If dependencies or environment prevent the command, report the exact failure instead of claiming completion.

- [ ] **Step 4: Inspect the final diff and status**

Run:

```bash
git diff --check
git diff -- src/lib/permissions.ts 'src/app/(portal)/meetings/meeting-form.tsx' 'src/app/(portal)/meetings/[id]/page.tsx' tests/weekly-report-visibility.test.ts
git status --short
```

Confirm only the intended source/test files changed, and preserve the existing untracked `.claude/settings.local.json`.
