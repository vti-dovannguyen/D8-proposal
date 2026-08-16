# Unit Billable/RA Dashboard Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tình hình Billable / RA" section to `/dashboard` showing 3 rolling months of unit EE/PO and a per-project breakdown computed from Phase 1 `ProjectMonthlyDetail`, plus three manager-editable headcount rows.

**Architecture:** New `UnitMonthly` model stores only the manual headcounts (LB+QA+OT / Intern / Chính thức). Pure helpers in `src/lib/unit-report.ts` derive the rolling month window and aggregate per-project rows into EE/PO/per-project numbers (reusing `eeDenominator` from `monthly-detail.ts`). A manager-gated server action upserts headcounts; the dashboard server component fetches + aggregates and passes data to a client section with inline-editable headcount cells.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 7 (pg adapter, client at `src/generated/prisma`), React 19, Tailwind v4, Vitest.

## Global Constraints

- UI text is Vietnamese.
- View gated by existing `dashboard:view` (the page already redirects non-viewers). Headcount **edit** gated by `project:manage` (MANAGERS — ADMIN / DIVISION_LEADER / SECTION_MANAGER; NOT PM).
- Headcounts are non-negative integers. EE/PO/per-project are computed, never stored.
- `PO = Σ billableProject` across projects per month. `EE = Σ billableProject / Σ eeDenominator × 100`, `0` when `Σ eeDenominator ≤ 0`. `eeDenominator = calendarMember + calendarIntern + otMemberEffort − absent` (reuse `eeDenominator` from `@/lib/monthly-detail`).
- EE color reuses `eeStatus` from `@/lib/monthly-detail` (≥90 green / 80–90 amber / <80 red).
- Month window = current month + next 2 (rolling), derived from `new Date()` on the server; no picker. Month key format `"YYYY-MM"`.
- Month label = `Tháng {M}`, with `/{YYYY}` appended only when the 3-month window spans more than one calendar year.
- Project rows = all active projects (0 where a month has no `ProjectMonthlyDetail`).
- Tests are `tests/**/*.test.ts`, run with `npm test` (Vitest). Action tests mock `@/lib/auth`, `@/lib/db`, `next/cache`.
- Prisma migrations: `npm run db:migrate` (regenerates the client).
- Conventional Commits; commit at the end of each task.

---

### Task 1: UnitMonthly model + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `UnitMonthly { id, month (String @unique), lbQaOt Int, intern Int, official Int, createdAt, updatedAt }`; client property `db.unitMonthly`.

- [ ] **Step 1: Add the model**

Append after the `ProjectMonthlyDetail` model in `prisma/schema.prisma`:

```prisma
model UnitMonthly {
  id        String   @id @default(cuid())
  month     String   @unique // "YYYY-MM"
  lbQaOt    Int      @default(0)
  intern    Int      @default(0)
  official  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Create + apply the migration and regenerate the client**

Run: `npm run db:migrate -- --name unit_monthly`
Expected: a new `prisma/migrations/*_unit_monthly/` folder, "Your database is now in sync with your schema.", client regenerated. A live dev DB is configured in this environment.

If `npm run db:migrate` fails for a reason you cannot resolve (no DB connection, interactive prompt), STOP and report BLOCKED with the exact error — do not hand-write migration SQL.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add UnitMonthly model"
```

---

### Task 2: Pure aggregation helpers

**Files:**
- Create: `src/lib/unit-report.ts`
- Test: `tests/unit-report.test.ts`

**Interfaces:**
- Consumes: `eeDenominator`, `EFFORT_FIELDS`, `type EffortFields` from `@/lib/monthly-detail`.
- Produces:
  - `type ProjMonthRow = { project: string; month: string; billableProject: number; calendarMember: number; calendarIntern: number; otMemberEffort: number; absent: number }`
  - `function rollingMonths(from: Date): string[]`
  - `function aggregateUnitReport(rows: ProjMonthRow[], months: string[], projectNames: string[]): { projectRows: { project: string; values: number[] }[]; po: number[]; ee: number[] }`
  - `function monthLabel(month: string, months: string[]): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit-report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rollingMonths, aggregateUnitReport, monthLabel, type ProjMonthRow } from "@/lib/unit-report";

describe("rollingMonths", () => {
  it("returns the month of `from` plus the next two", () => {
    // Month is 0-based in the Date constructor: 5 = June.
    expect(rollingMonths(new Date(2026, 5, 27))).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
  it("rolls across the year boundary", () => {
    expect(rollingMonths(new Date(2026, 10, 1))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

const months = ["2026-06", "2026-07", "2026-08"];
const row = (o: Partial<ProjMonthRow>): ProjMonthRow => ({
  project: "P", month: "2026-06", billableProject: 0,
  calendarMember: 0, calendarIntern: 0, otMemberEffort: 0, absent: 0, ...o,
});

describe("aggregateUnitReport", () => {
  it("sums PO (billableProject) per month across projects", () => {
    const rows = [
      row({ project: "A", month: "2026-06", billableProject: 7 }),
      row({ project: "B", month: "2026-06", billableProject: 9 }),
      row({ project: "A", month: "2026-07", billableProject: 8 }),
    ];
    const { po } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(po).toEqual([16, 8, 0]);
  });
  it("computes EE = sum(billable) / sum(denominator) * 100", () => {
    const rows = [
      row({ project: "A", month: "2026-06", billableProject: 9, calendarMember: 10 }),
      row({ project: "B", month: "2026-06", billableProject: 9, calendarMember: 10 }),
    ];
    const { ee } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(ee[0]).toBeCloseTo(90, 5); // 18 / 20 * 100
  });
  it("returns EE 0 when the month's denominator is <= 0", () => {
    const rows = [row({ project: "A", month: "2026-06", billableProject: 5, absent: 4 })];
    const { ee } = aggregateUnitReport(rows, months, ["A"]);
    expect(ee[0]).toBe(0);
  });
  it("lists every project in order, 0 where a month has no row", () => {
    const rows = [row({ project: "A", month: "2026-07", billableProject: 8 })];
    const { projectRows } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(projectRows).toEqual([
      { project: "A", values: [0, 8, 0] },
      { project: "B", values: [0, 0, 0] },
    ]);
  });
});

describe("monthLabel", () => {
  it("is 'Tháng M' within a single year", () => {
    expect(monthLabel("2026-06", months)).toBe("Tháng 6");
  });
  it("appends the year when the window spans two years", () => {
    const span = ["2026-12", "2027-01", "2027-02"];
    expect(monthLabel("2027-01", span)).toBe("Tháng 1/2027");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- unit-report`
Expected: FAIL — `Cannot find module '@/lib/unit-report'`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/unit-report.ts`:

```ts
import { eeDenominator, EFFORT_FIELDS, type EffortFields } from "@/lib/monthly-detail";

export type ProjMonthRow = {
  project: string;
  month: string;
  billableProject: number;
  calendarMember: number;
  calendarIntern: number;
  otMemberEffort: number;
  absent: number;
};

const EMPTY_EFFORT = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;

export function rollingMonths(from: Date): string[] {
  const year = from.getFullYear();
  const month = from.getMonth(); // 0-based
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(year, month + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function aggregateUnitReport(
  rows: ProjMonthRow[],
  months: string[],
  projectNames: string[],
): { projectRows: { project: string; values: number[] }[]; po: number[]; ee: number[] } {
  const po = months.map(() => 0);
  const den = months.map(() => 0);
  const billableByKey = new Map<string, number>(); // `${project}|${month}` -> billableProject

  for (const r of rows) {
    const mi = months.indexOf(r.month);
    if (mi < 0) continue;
    po[mi] += r.billableProject;
    den[mi] += eeDenominator({
      ...EMPTY_EFFORT,
      calendarMember: r.calendarMember,
      calendarIntern: r.calendarIntern,
      otMemberEffort: r.otMemberEffort,
      absent: r.absent,
    });
    const key = `${r.project}|${r.month}`;
    billableByKey.set(key, (billableByKey.get(key) ?? 0) + r.billableProject);
  }

  const ee = months.map((_, i) => (den[i] <= 0 ? 0 : (po[i] / den[i]) * 100));
  const projectRows = projectNames.map((project) => ({
    project,
    values: months.map((mo) => billableByKey.get(`${project}|${mo}`) ?? 0),
  }));
  return { projectRows, po, ee };
}

export function monthLabel(month: string, months: string[]): string {
  const [year, m] = month.split("-");
  const multiYear = new Set(months.map((mo) => mo.slice(0, 4))).size > 1;
  const n = Number(m);
  return multiYear ? `Tháng ${n}/${year}` : `Tháng ${n}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- unit-report`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/unit-report.ts tests/unit-report.test.ts
git commit -m "feat: add unit-report aggregation helpers"
```

---

### Task 3: setUnitHeadcount server action

**Files:**
- Create: `src/app/(portal)/dashboard/actions.ts`
- Test: `tests/dashboard-actions.test.ts`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`), `db` (`@/lib/db`), `can` (`@/lib/permissions`), `MONTH_RE` (`@/lib/monthly-detail`), `revalidatePath` (`next/cache`).
- Produces: `setUnitHeadcount(month: string, field: "lbQaOt" | "intern" | "official", value: number): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/dashboard-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { unitMonthly: { upsert: (...a: unknown[]) => upsert(...a) } } }));

import { setUnitHeadcount } from "../src/app/(portal)/dashboard/actions";

beforeEach(() => { authMock.mockReset(); upsert.mockReset(); });

describe("setUnitHeadcount auth", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(setUnitHeadcount("2026-06", "intern", 5)).rejects.toThrow("Forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("blocks a PM (managers only)", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "PM" } });
    await expect(setUnitHeadcount("2026-06", "intern", 5)).rejects.toThrow("Forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("setUnitHeadcount validation + upsert", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("rejects a bad month", async () => {
    await expect(setUnitHeadcount("2026/06", "intern", 5)).rejects.toThrow(/tháng/i);
  });
  it("rejects an unknown field", async () => {
    // @ts-expect-error testing runtime guard on an invalid field
    await expect(setUnitHeadcount("2026-06", "bogus", 5)).rejects.toThrow(/trường/i);
  });
  it("coerces negatives and fractions to a non-negative integer and upserts by month", async () => {
    await setUnitHeadcount("2026-06", "official", 136.6);
    expect(upsert).toHaveBeenCalledWith({
      where: { month: "2026-06" },
      create: { month: "2026-06", official: 137 },
      update: { official: 137 },
    });
    await setUnitHeadcount("2026-06", "lbQaOt", -3);
    expect(upsert).toHaveBeenLastCalledWith({
      where: { month: "2026-06" },
      create: { month: "2026-06", lbQaOt: 0 },
      update: { lbQaOt: 0 },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- dashboard-actions`
Expected: FAIL — `setUnitHeadcount` not found.

- [ ] **Step 3: Implement the action**

Create `src/app/(portal)/dashboard/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MONTH_RE } from "@/lib/monthly-detail";

const HEADCOUNT_FIELDS = ["lbQaOt", "intern", "official"] as const;
export type HeadcountField = (typeof HEADCOUNT_FIELDS)[number];

export async function setUnitHeadcount(month: string, field: HeadcountField, value: number) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "project:manage")) throw new Error("Forbidden");
  if (!MONTH_RE.test(month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  if (!HEADCOUNT_FIELDS.includes(field)) throw new Error("Validation: trường không hợp lệ");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Validation: giá trị không hợp lệ");
  const intVal = Math.max(0, Math.round(n));
  await db.unitMonthly.upsert({
    where: { month },
    create: { month, [field]: intVal },
    update: { [field]: intVal },
  });
  revalidatePath("/dashboard");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- dashboard-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/dashboard/actions.ts" tests/dashboard-actions.test.ts
git commit -m "feat: add setUnitHeadcount dashboard action"
```

---

### Task 4: Billable/RA dashboard section + page wiring

**Files:**
- Create: `src/app/(portal)/dashboard/billable-ra-section.tsx`
- Modify: `src/app/(portal)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `rollingMonths`, `aggregateUnitReport`, `monthLabel`, `type ProjMonthRow` (Task 2); `setUnitHeadcount` (Task 3); `eeStatus` (`@/lib/monthly-detail`); `db`, `can`, `auth` (existing in page).
- Produces: `BillableRaSection` client component.

- [ ] **Step 1: Create the section component**

Create `src/app/(portal)/dashboard/billable-ra-section.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { eeStatus } from "@/lib/monthly-detail";
import { setUnitHeadcount } from "./actions";

type Overview = { ee: number[]; po: number[] };
type ProjectRow = { project: string; values: number[] };
type HeadcountRow = { lbQaOt: number; intern: number; official: number };
type HeadcountField = "lbQaOt" | "intern" | "official";

const DOT: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500",
};

const HEADCOUNT_ROWS: { field: HeadcountField; label: string }[] = [
  { field: "lbQaOt", label: "LB+QA+OT" },
  { field: "intern", label: "Intern" },
  { field: "official", label: "Chính thức" },
];

export function BillableRaSection({ months, monthLabels, overview, projectRows, headcounts, canEdit }: {
  months: string[];
  monthLabels: string[];
  overview: Overview;
  projectRows: ProjectRow[];
  headcounts: Record<string, HeadcountRow>;
  canEdit: boolean;
}) {
  const [, start] = useTransition();

  // Local copy so inline edits feel instant; resync when the server re-passes props.
  const [hc, setHc] = useState(headcounts);
  const [synced, setSynced] = useState(headcounts);
  if (synced !== headcounts) { setSynced(headcounts); setHc(headcounts); }
  const valueOf = (month: string, field: HeadcountField) => hc[month]?.[field] ?? 0;

  const [editBuf, setEditBuf] = useState<Record<string, string>>({});
  const bufKey = (month: string, field: string) => `${month}:${field}`;
  const getBuf = (month: string, field: HeadcountField) => {
    const k = bufKey(month, field);
    return k in editBuf ? editBuf[k] : String(valueOf(month, field));
  };
  const setBuf = (month: string, field: string, val: string) =>
    setEditBuf((b) => ({ ...b, [bufKey(month, field)]: val }));
  const flushBuf = (month: string, field: HeadcountField) => {
    const k = bufKey(month, field);
    if (!(k in editBuf)) return;
    const parsed = editBuf[k] === "" ? 0 : Number(editBuf[k]);
    const num = isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
    setEditBuf((b) => { const next = { ...b }; delete next[k]; return next; });
    setHc((cur) => ({ ...cur, [month]: { lbQaOt: 0, intern: 0, official: 0, ...cur[month], [field]: num } }));
    start(() => setUnitHeadcount(month, field, num));
  };

  const cellInput = "w-20 rounded border px-1 py-0.5 text-right text-sm";

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/85 p-5 shadow-[var(--sh-1)] backdrop-blur">
      <h2 className="mb-4 text-base font-semibold text-slate-950">Tình hình Billable / RA</h2>

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Tổng quan</p>
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[560px]">
          <thead>
            <tr><th>Chỉ số</th>{monthLabels.map((l) => <th key={l} className="text-right">{l}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-slate-900">EE</td>
              {overview.ee.map((v, i) => (
                <td key={i} className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-slate-900">
                    <span className={`inline-block h-2 w-2 rounded-full ${DOT[eeStatus(v)]}`} />
                    {v.toFixed(2)}
                  </span>
                </td>
              ))}
            </tr>
            {HEADCOUNT_ROWS.map((rowDef) => (
              <tr key={rowDef.field}>
                <td className="font-semibold text-slate-900">{rowDef.label}</td>
                {months.map((mo) => (
                  <td key={mo} className="text-right">
                    {canEdit
                      ? <input type="number" min="0" step="1" className={cellInput}
                          value={getBuf(mo, rowDef.field)}
                          onChange={(e) => setBuf(mo, rowDef.field, e.target.value)}
                          onBlur={() => flushBuf(mo, rowDef.field)} />
                      : <span>{valueOf(mo, rowDef.field)}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="font-semibold text-slate-900">PO</td>
              {overview.po.map((v, i) => <td key={i} className="text-right font-semibold text-slate-900">{v.toFixed(2)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Chi tiết theo dự án</p>
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[560px]">
          <thead>
            <tr><th>Dự án</th>{monthLabels.map((l) => <th key={l} className="text-right">{l}</th>)}</tr>
          </thead>
          <tbody>
            {projectRows.map((r) => (
              <tr key={r.project}>
                <td className="font-semibold text-slate-900">{r.project}</td>
                {r.values.map((v, i) => <td key={i} className="text-right">{v}</td>)}
              </tr>
            ))}
            {projectRows.length === 0 && (
              <tr><td colSpan={1 + months.length} className="px-4 py-8 text-center text-slate-400">Chưa có dự án</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into the dashboard page**

Replace the body of `src/app/(portal)/dashboard/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { rollingMonths, aggregateUnitReport, monthLabel, type ProjMonthRow } from "@/lib/unit-report";
import { MeetingStatusWidget } from "./meeting-status-widget";
import { BillableRaSection } from "./billable-ra-section";

export default async function DashboardPage() {
  const session = await auth();
  if (!can(session!.user.role, "dashboard:view")) redirect("/");

  const months = rollingMonths(new Date());
  const [details, projects, units] = await Promise.all([
    db.projectMonthlyDetail.findMany({
      where: { month: { in: months } },
      select: {
        month: true, billableProject: true, calendarMember: true,
        calendarIntern: true, otMemberEffort: true, absent: true,
        project: { select: { name: true } },
      },
    }),
    db.project.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
    db.unitMonthly.findMany({ where: { month: { in: months } } }),
  ]);

  const rows: ProjMonthRow[] = details.map((d) => ({
    project: d.project.name, month: d.month, billableProject: d.billableProject,
    calendarMember: d.calendarMember, calendarIntern: d.calendarIntern,
    otMemberEffort: d.otMemberEffort, absent: d.absent,
  }));
  const { projectRows, po, ee } = aggregateUnitReport(rows, months, projects.map((p) => p.name));
  const headcounts: Record<string, { lbQaOt: number; intern: number; official: number }> = {};
  for (const u of units) headcounts[u.month] = { lbQaOt: u.lbQaOt, intern: u.intern, official: u.official };
  const monthLabels = months.map((m) => monthLabel(m, months));
  const canEdit = can(session!.user.role, "project:manage");

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/82 p-6 shadow-[var(--sh-1)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vti-sepia,#8A5A32)]">Operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Monitor weekly meeting flow and recent activity from a cleaner control surface.
        </p>
      </section>
      <BillableRaSection
        months={months}
        monthLabels={monthLabels}
        overview={{ ee, po }}
        projectRows={projectRows}
        headcounts={headcounts}
        canEdit={canEdit}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <MeetingStatusWidget />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no type errors in `dashboard`.

- [ ] **Step 4: Manual smoke check (managers)**

Run `npm run dev`, open `/dashboard` as a manager.
Expected: a "Tình hình Billable / RA" section with 3 rolling month columns, EE & PO rows (EE color-dotted), the three headcount rows as editable integer cells (typing a value and clicking away persists after reload), and a per-project breakdown listing all active projects.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/dashboard/billable-ra-section.tsx" "src/app/(portal)/dashboard/page.tsx"
git commit -m "feat: add unit Billable/RA section to dashboard"
```

---

### Task 5: Documentation + full verification

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: updated system map; green `npm test` / `npm run build`.

- [ ] **Step 1: Update `CLAUDE.md`**

Edit `E:\PROJECTS\ACE\D8Portal\d8-portal\CLAUDE.md`:

(a) In **Data model**, append to the Master Data / models area (or the Meetings bullet that lists `ProjectMonthlyDetail`):

```
, `UnitMonthly` (unit-level manual monthly headcounts: lbQaOt/intern/official, unique `month` "YYYY-MM"; feeds the dashboard Billable/RA overview)
```

(b) In the **`src/lib` function reference**, add a bullet:

```
- **unit-report.ts** — pure helpers for the dashboard Billable/RA section: `rollingMonths(from)` (current month + next 2, "YYYY-MM"), `aggregateUnitReport(rows, months, projectNames)` (→ per-project `billableProject` rows + unit `po` = Σ billableProject + `ee` = Σ billableProject / Σ eeDenominator × 100), `monthLabel`. Reuses `eeDenominator` from `monthly-detail.ts`.
```

(c) In **Server actions**, add a `dashboard` bullet:

```
- **dashboard**: `setUnitHeadcount(month, field, value)` — upsert unit monthly headcount (lbQaOt|intern|official), non-negative int, guards `project:manage`.
```

(d) In the **Directory layout** dashboard note (or wherever the dashboard is described), mention the new section: the `/dashboard` page renders a unit "Tình hình Billable / RA" section (3 rolling months, computed EE/PO + per-project breakdown, manager-editable headcounts) above the meeting-status widget.

- [ ] **Step 2: Run the full unit suite**

Run: `npm test`
Expected: all suites pass, including `unit-report` and `dashboard-actions`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: no errors. (Note: `npm run lint` has a known pre-existing Windows `next lint` path-parse failure unrelated to this work — the build's type-check is the gate.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document unit Billable/RA dashboard section"
```

---

## Self-Review Notes

- **Spec coverage:** model (Task 1), rolling window + EE/PO/per-project aggregation + month label (Task 2), manager-gated headcount upsert with int coercion (Task 3), dashboard section with computed rows + editable headcounts + page wiring (Task 4), tests (Tasks 2–3), docs (Task 5). Acceptance criteria 1–6 map to Task 4 manual check + Task 2/3 tests.
- **Type consistency:** `ProjMonthRow`, the `{ projectRows, po, ee }` shape, `HeadcountField`, and the `headcounts` `Record<string, {lbQaOt,intern,official}>` shape are identical across Tasks 2–4.
- **Reuse:** `eeDenominator` / `eeStatus` / `MONTH_RE` are imported from Phase 1's `monthly-detail.ts`, not re-derived.
- **Out of scope:** editing Phase 1 per-project data; report export/snapshot.
```
