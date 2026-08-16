# Project Monthly Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Chi tiết theo tháng" tab to the project detail page where managers enter monthly billable/effort man-months per project, with computed EE % and a paste-from-Excel import.

**Architecture:** New `ProjectMonthlyDetail` Prisma model (one row per project per month) → pure computation/parse helpers in `src/lib/monthly-detail.ts` → manager-gated server actions in `projects/[id]/actions.ts` → editable client tab mirroring `allocations-tab.tsx`. EE % is computed on read; EE To Month % is a stored manual input.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7 (pg adapter, client generated to `src/generated/prisma`), React 19, Tailwind v4, Vitest.

## Global Constraints

- UI text is Vietnamese.
- All edit/write paths guard the `project:manage` capability via the existing `requireManager()` in `projects/[id]/actions.ts`. View is allowed for all authenticated users.
- Effort columns are `Float` man-months (decimals, e.g. 28.43), `>= 0`.
- Month key format is `"YYYY-MM"` (e.g. `"2026-01"`), validated by `/^\d{4}-(0[1-9]|1[0-2])$/`.
- EE thresholds: `>= 90` green, `80 <= x < 90` amber, `< 90` (i.e. `< 80`) red. Constant `EE_THRESHOLDS = { green: 90, amber: 80 }`.
- Canonical column order (table + import): `month · billableProject · billableDevelop · warrantyEffort · calendarMember · calendarIntern · calendarCollaborator · otMemberEffort · otInternEffort · otCollaboratorEffort · absent · ee · eeToMonth`. On import the `ee` column is ignored (recomputed); `eeToMonth` is stored.
- Tests are `tests/**/*.test.ts`, run with `npm test` (Vitest). Pure-helper tests need no mocks; action tests mock `@/lib/auth`, `@/lib/db`, `next/cache`.
- Prisma migrations: `npm run db:migrate` (regenerates the client too).
- Commit frequently with Conventional Commits (`feat:` / `test:` / `docs:`).

---

### Task 1: Data model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model + relation on `Project`)

**Interfaces:**
- Produces: Prisma model `ProjectMonthlyDetail` with fields `id, projectId, month, billableProject, billableDevelop, warrantyEffort, calendarMember, calendarIntern, calendarCollaborator, otMemberEffort, otInternEffort, otCollaboratorEffort, absent, eeToMonth, createdAt, updatedAt`; unique `[projectId, month]` (Prisma compound key name `projectId_month`). `Project.monthlyDetails` relation. Generated client at `src/generated/prisma`.

- [ ] **Step 1: Add the relation field to `Project`**

In `prisma/schema.prisma`, inside `model Project`, next to the existing `allocations` / `environments` relations, add:

```prisma
  monthlyDetails ProjectMonthlyDetail[]
```

- [ ] **Step 2: Add the model**

Append after the `ProjectEnvironment` model in `prisma/schema.prisma`:

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

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Create + apply the migration and regenerate the client**

Run: `npm run db:migrate -- --name project_monthly_detail`
Expected: a new folder under `prisma/migrations/*_project_monthly_detail/`, "Your database is now in sync with your schema.", and the Prisma client regenerates into `src/generated/prisma`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ProjectMonthlyDetail model"
```

---

### Task 2: Pure computation + parse helpers

**Files:**
- Create: `src/lib/monthly-detail.ts`
- Test: `tests/monthly-detail-lib.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `type EffortFields = { billableProject: number; billableDevelop: number; warrantyEffort: number; calendarMember: number; calendarIntern: number; calendarCollaborator: number; otMemberEffort: number; otInternEffort: number; otCollaboratorEffort: number; absent: number }`
  - `const EFFORT_FIELDS: (keyof EffortFields)[]`
  - `const EE_THRESHOLDS = { green: 90, amber: 80 }`
  - `function eeDenominator(row: EffortFields): number`
  - `function ee(row: EffortFields): number`
  - `function eeStatus(value: number): "green" | "amber" | "red"`
  - `function monthlyTotals(rows: EffortFields[]): EffortFields`
  - `type ParsedMonthlyRow = EffortFields & { month: string; eeToMonth: number }`
  - `function parseMonthlyPaste(text: string): { rows: ParsedMonthlyRow[]; errors: string[] }`
  - `const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/`

- [ ] **Step 1: Write the failing tests**

Create `tests/monthly-detail-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ee, eeDenominator, eeStatus, monthlyTotals, parseMonthlyPaste, EFFORT_FIELDS, type EffortFields,
} from "@/lib/monthly-detail";

const base: EffortFields = {
  billableProject: 0, billableDevelop: 0, warrantyEffort: 0,
  calendarMember: 0, calendarIntern: 0, calendarCollaborator: 0,
  otMemberEffort: 0, otInternEffort: 0, otCollaboratorEffort: 0, absent: 0,
};
const row = (o: Partial<EffortFields>): EffortFields => ({ ...base, ...o });

describe("eeDenominator", () => {
  it("is calendarMember + calendarIntern + otMemberEffort - absent", () => {
    expect(eeDenominator(row({ calendarMember: 10, calendarIntern: 2, otMemberEffort: 1, absent: 3 }))).toBe(10);
  });
});

describe("ee", () => {
  it("is billableProject / denominator * 100", () => {
    expect(ee(row({ billableProject: 9, calendarMember: 10 }))).toBe(90);
  });
  it("returns 0 when denominator is zero", () => {
    expect(ee(row({ billableProject: 5 }))).toBe(0);
  });
  it("returns 0 when denominator is negative", () => {
    expect(ee(row({ billableProject: 5, absent: 4 }))).toBe(0);
  });
});

describe("eeStatus", () => {
  it("green at >= 90, amber in [80,90), red below 80", () => {
    expect(eeStatus(90)).toBe("green");
    expect(eeStatus(89.99)).toBe("amber");
    expect(eeStatus(80)).toBe("amber");
    expect(eeStatus(79.99)).toBe("red");
  });
});

describe("monthlyTotals", () => {
  it("sums each effort field", () => {
    const t = monthlyTotals([row({ calendarMember: 28.43 }), row({ calendarMember: 26.69 })]);
    expect(t.calendarMember).toBeCloseTo(55.12, 5);
    for (const f of EFFORT_FIELDS) if (f !== "calendarMember") expect(t[f]).toBe(0);
  });
  it("returns all-zero totals for an empty list", () => {
    expect(monthlyTotals([]).calendarMember).toBe(0);
  });
});

describe("parseMonthlyPaste", () => {
  const line = (cells: (string | number)[]) => cells.join("\t");
  // month, bp, bd, we, cm, ci, cc, otm, oti, otc, absent, ee(ignored), eeToMonth
  const valid = line(["2026-01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 999, 42]);

  it("parses a valid tab-separated row, ignoring the ee column", () => {
    const { rows, errors } = parseMonthlyPaste(valid);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe("2026-01");
    expect(rows[0].billableProject).toBe(5);
    expect(rows[0].calendarMember).toBe(10);
    expect(rows[0].eeToMonth).toBe(42); // stored
  });
  it("skips a header line and blank lines", () => {
    const text = ["Months\tBillable Project", "", valid, "   "].join("\n");
    const { rows, errors } = parseMonthlyPaste(text);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
  it("reports a malformed month and drops that row", () => {
    const { rows, errors } = parseMonthlyPaste(line(["2026/01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/2026\/01/);
  });
  it("reports a non-numeric cell and drops that row", () => {
    const { rows, errors } = parseMonthlyPaste(line(["2026-01", "abc", 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
  it("treats empty cells as 0", () => {
    const { rows } = parseMonthlyPaste(line(["2026-01", "", "", "", 10, "", "", "", "", "", "", "", ""]));
    expect(rows[0].billableProject).toBe(0);
    expect(rows[0].eeToMonth).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- monthly-detail-lib`
Expected: FAIL — `Cannot find module '@/lib/monthly-detail'` (or undefined exports).

- [ ] **Step 3: Implement the helper module**

Create `src/lib/monthly-detail.ts`:

```ts
export type EffortFields = {
  billableProject: number;
  billableDevelop: number;
  warrantyEffort: number;
  calendarMember: number;
  calendarIntern: number;
  calendarCollaborator: number;
  otMemberEffort: number;
  otInternEffort: number;
  otCollaboratorEffort: number;
  absent: number;
};

export const EFFORT_FIELDS: (keyof EffortFields)[] = [
  "billableProject", "billableDevelop", "warrantyEffort",
  "calendarMember", "calendarIntern", "calendarCollaborator",
  "otMemberEffort", "otInternEffort", "otCollaboratorEffort", "absent",
];

export const EE_THRESHOLDS = { green: 90, amber: 80 } as const;

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function eeDenominator(row: EffortFields): number {
  return row.calendarMember + row.calendarIntern + row.otMemberEffort - row.absent;
}

export function ee(row: EffortFields): number {
  const den = eeDenominator(row);
  return den <= 0 ? 0 : (row.billableProject / den) * 100;
}

export function eeStatus(value: number): "green" | "amber" | "red" {
  if (value >= EE_THRESHOLDS.green) return "green";
  if (value >= EE_THRESHOLDS.amber) return "amber";
  return "red";
}

export function monthlyTotals(rows: EffortFields[]): EffortFields {
  const total = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;
  for (const r of rows) for (const f of EFFORT_FIELDS) total[f] += r[f];
  return total;
}

export type ParsedMonthlyRow = EffortFields & { month: string; eeToMonth: number };

// Cell layout, tab-separated, matching the WR sheet:
// 0 month | 1..10 effort (EFFORT_FIELDS order) | 11 ee (ignored) | 12 eeToMonth
export function parseMonthlyPaste(text: string): { rows: ParsedMonthlyRow[]; errors: string[] } {
  const rows: ParsedMonthlyRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  for (const line of lines) {
    const cells = line.split("\t").map((c) => c.trim());
    const month = cells[0];
    if (!MONTH_RE.test(month)) {
      // Skip a header row silently; report anything else that looks like data.
      if (cells.length > 1 && cells.slice(1).some((c) => c !== "" && !Number.isNaN(Number(c)))) {
        errors.push(`Tháng không hợp lệ: "${month}"`);
      } else if (!/^months?$/i.test(month)) {
        errors.push(`Tháng không hợp lệ: "${month}"`);
      }
      continue;
    }
    const num = (i: number): number | null => {
      const raw = cells[i] ?? "";
      if (raw === "") return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const parsed = {} as ParsedMonthlyRow;
    let bad = false;
    EFFORT_FIELDS.forEach((f, idx) => {
      const n = num(idx + 1); // cells[1..10]
      if (n === null) bad = true;
      else parsed[f] = n;
    });
    const eeToMonth = num(12); // cells[12]; cells[11] (ee) ignored
    if (eeToMonth === null) bad = true;
    if (bad) {
      errors.push(`Giá trị không hợp lệ tại tháng "${month}"`);
      continue;
    }
    parsed.month = month;
    parsed.eeToMonth = eeToMonth as number;
    rows.push(parsed);
  }
  return { rows, errors };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- monthly-detail-lib`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/monthly-detail.ts tests/monthly-detail-lib.test.ts
git commit -m "feat: add monthly-detail EE + paste-parse helpers"
```

---

### Task 3: Server actions

**Files:**
- Modify: `src/app/(portal)/projects/[id]/actions.ts`
- Test: `tests/monthly-detail-actions.test.ts`

**Interfaces:**
- Consumes: `requireManager()` (existing, in same file); `db.projectMonthlyDetail` (Task 1); `parseMonthlyPaste`, `EFFORT_FIELDS`, `MONTH_RE` (Task 2).
- Produces:
  - `type MonthlyFormData = { month: string } & EffortFields & { eeToMonth: number }`
  - `addMonthlyDetail(projectId: string, form: MonthlyFormData): Promise<void>`
  - `updateMonthlyDetail(id: string, projectId: string, form: MonthlyFormData): Promise<void>`
  - `deleteMonthlyDetail(id: string, projectId: string): Promise<void>`
  - `importMonthlyDetails(projectId: string, text: string): Promise<{ imported: number; errors: string[] }>`

- [ ] **Step 1: Write the failing tests**

Create `tests/monthly-detail-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const mdCreate = vi.fn(), mdUpdate = vi.fn(), mdDelete = vi.fn(), mdUpsert = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  projectMonthlyDetail: {
    create: (...a: unknown[]) => mdCreate(...a),
    update: (...a: unknown[]) => mdUpdate(...a),
    delete: (...a: unknown[]) => mdDelete(...a),
    upsert: (...a: unknown[]) => mdUpsert(...a),
  },
} }));

import {
  addMonthlyDetail, updateMonthlyDetail, deleteMonthlyDetail, importMonthlyDetails,
  type MonthlyFormData,
} from "../src/app/(portal)/projects/[id]/actions";

const form = (o: Partial<MonthlyFormData> = {}): MonthlyFormData => ({
  month: "2026-01", billableProject: 5, billableDevelop: 0, warrantyEffort: 0,
  calendarMember: 10, calendarIntern: 0, calendarCollaborator: 0,
  otMemberEffort: 0, otInternEffort: 0, otCollaboratorEffort: 0, absent: 0, eeToMonth: 0, ...o,
});

beforeEach(() => { authMock.mockReset(); mdCreate.mockReset(); mdUpdate.mockReset(); mdDelete.mockReset(); mdUpsert.mockReset(); });

describe("monthly-detail actions auth", () => {
  it("blocks a MEMBER from adding a row", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(addMonthlyDetail("p1", form())).rejects.toThrow("Forbidden");
    expect(mdCreate).not.toHaveBeenCalled();
  });
  it("blocks a MEMBER from importing", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(importMonthlyDetails("p1", "2026-01\t5")).rejects.toThrow("Forbidden");
  });
});

describe("addMonthlyDetail", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("rejects an invalid month", async () => {
    await expect(addMonthlyDetail("p1", form({ month: "2026/01" }))).rejects.toThrow(/tháng/i);
    expect(mdCreate).not.toHaveBeenCalled();
  });
  it("rejects a negative value", async () => {
    await expect(addMonthlyDetail("p1", form({ calendarMember: -1 }))).rejects.toThrow(/giá trị/i);
  });
  it("creates a row with projectId and coerced fields", async () => {
    await addMonthlyDetail("p1", form());
    expect(mdCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ projectId: "p1", month: "2026-01", billableProject: 5, calendarMember: 10, eeToMonth: 0 }) });
  });
});

describe("updateMonthlyDetail / deleteMonthlyDetail", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("updates by id", async () => {
    await updateMonthlyDetail("m1", "p1", form({ billableProject: 7 }));
    expect(mdUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: expect.objectContaining({ billableProject: 7 }) });
  });
  it("deletes by id", async () => {
    await deleteMonthlyDetail("m1", "p1");
    expect(mdDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

describe("importMonthlyDetails", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("upserts each valid row by [projectId, month] and returns counts + errors", async () => {
    const text = [
      ["2026-01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 50, 40].join("\t"),
      ["2026/02", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 50, 40].join("\t"),
    ].join("\n");
    const res = await importMonthlyDetails("p1", text);
    expect(res.imported).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(mdUpsert).toHaveBeenCalledTimes(1);
    expect(mdUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_month: { projectId: "p1", month: "2026-01" } },
    }));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- monthly-detail-actions`
Expected: FAIL — exports `addMonthlyDetail` etc. not found.

- [ ] **Step 3: Implement the actions**

In `src/app/(portal)/projects/[id]/actions.ts`, add the import at the top (next to the existing `@/lib/projects` import):

```ts
import { parseMonthlyPaste, EFFORT_FIELDS, MONTH_RE, type EffortFields } from "@/lib/monthly-detail";
```

Append at the end of the file:

```ts
export type MonthlyFormData = { month: string; eeToMonth: number } & EffortFields;

function cleanMonthly(form: MonthlyFormData) {
  const month = form.month.trim();
  if (!MONTH_RE.test(month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  const data: Record<string, number | string> = { month };
  for (const f of [...EFFORT_FIELDS, "eeToMonth" as const]) {
    const n = Number((form as Record<string, unknown>)[f]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Validation: giá trị không hợp lệ ở ${f}`);
    data[f] = n;
  }
  return data as { month: string } & EffortFields & { eeToMonth: number };
}

export async function addMonthlyDetail(projectId: string, form: MonthlyFormData) {
  await requireManager();
  await db.projectMonthlyDetail.create({ data: { projectId, ...cleanMonthly(form) } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateMonthlyDetail(id: string, projectId: string, form: MonthlyFormData) {
  await requireManager();
  await db.projectMonthlyDetail.update({ where: { id }, data: cleanMonthly(form) });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMonthlyDetail(id: string, projectId: string) {
  await requireManager();
  await db.projectMonthlyDetail.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function importMonthlyDetails(projectId: string, text: string): Promise<{ imported: number; errors: string[] }> {
  await requireManager();
  const { rows, errors } = parseMonthlyPaste(text);
  for (const r of rows) {
    const { month, ...rest } = r; // rest = effort fields + eeToMonth
    await db.projectMonthlyDetail.upsert({
      where: { projectId_month: { projectId, month } },
      create: { projectId, month, ...rest },
      update: { ...rest },
    });
  }
  revalidatePath(`/projects/${projectId}`);
  return { imported: rows.length, errors };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- monthly-detail-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/projects/[id]/actions.ts" tests/monthly-detail-actions.test.ts
git commit -m "feat: add monthly-detail server actions"
```

---

### Task 4: Monthly Detail tab UI + page wiring

**Files:**
- Create: `src/app/(portal)/projects/[id]/monthly-detail-tab.tsx`
- Modify: `src/app/(portal)/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `addMonthlyDetail`, `updateMonthlyDetail`, `deleteMonthlyDetail`, `importMonthlyDetails`, `MonthlyFormData` (Task 3); `ee`, `eeStatus`, `monthlyTotals`, `EFFORT_FIELDS`, `type EffortFields` (Task 2); existing `ProjectTabs`.
- Produces: `MonthlyDetailTab` React component; `MonthlyItem` row shape consumed by `page.tsx`.

- [ ] **Step 1: Create the tab component**

Create `src/app/(portal)/projects/[id]/monthly-detail-tab.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { ee, eeStatus, monthlyTotals, EFFORT_FIELDS, type EffortFields } from "@/lib/monthly-detail";
import { addMonthlyDetail, updateMonthlyDetail, deleteMonthlyDetail, importMonthlyDetails, type MonthlyFormData } from "./actions";

export type MonthlyItem = EffortFields & { id: string; month: string; eeToMonth: number };

const COLS: { key: keyof EffortFields; label: string }[] = [
  { key: "billableProject", label: "Billable Project" },
  { key: "billableDevelop", label: "Billable Develop" },
  { key: "warrantyEffort", label: "Warranty Effort" },
  { key: "calendarMember", label: "Calendar Member" },
  { key: "calendarIntern", label: "Calendar Intern" },
  { key: "calendarCollaborator", label: "Calendar Collaborator" },
  { key: "otMemberEffort", label: "OT Member Effort" },
  { key: "otInternEffort", label: "OT Intern Effort" },
  { key: "otCollaboratorEffort", label: "OT Collaborator Effort" },
  { key: "absent", label: "Absent" },
];

const ZERO: EffortFields = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;
const EMPTY_DRAFT = (): MonthlyFormData => ({ month: "", eeToMonth: 0, ...ZERO });

const DOT: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500",
};

function StatusCell({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[eeStatus(value)]}`} />
      {value.toFixed(2)}
    </span>
  );
}

export function MonthlyDetailTab({ projectId, details, canEdit }: {
  projectId: string; details: MonthlyItem[]; canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<MonthlyFormData>(EMPTY_DRAFT());
  const setD = <K extends keyof MonthlyFormData>(k: K, v: MonthlyFormData[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const [rows, setRows] = useState(details);
  const [synced, setSynced] = useState(details);
  if (synced !== details) { setSynced(details); setRows(details); }
  const patch = (id: string, p: Partial<MonthlyItem>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const persist = (r: MonthlyItem, over: Partial<MonthlyItem> = {}) => {
    const m = { ...r, ...over };
    const form: MonthlyFormData = { month: m.month, eeToMonth: m.eeToMonth, ...(Object.fromEntries(EFFORT_FIELDS.map((f) => [f, m[f]])) as EffortFields) };
    start(() => updateMonthlyDetail(m.id, projectId, form));
  };

  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const runImport = () => start(async () => {
    const res = await importMonthlyDetails(projectId, importText);
    setImportMsg(`Đã nhập ${res.imported} dòng.${res.errors.length ? " Lỗi: " + res.errors.join("; ") : ""}`);
    if (res.errors.length === 0) { setImportText(""); }
  });

  const totals = monthlyTotals(rows);
  const cellInput = "w-20 rounded border px-1 py-0.5 text-right text-sm";
  const colCount = 1 + COLS.length + 2 + (canEdit ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[1400px]">
          <thead>
            <tr>
              <th>Tháng</th>
              {COLS.map((c) => <th key={c.key} className="text-right">{c.label} (MM)</th>)}
              <th className="text-right">EE (%)</th>
              <th className="text-right">EE To Month (%)</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold text-slate-900">{r.month}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="text-right">
                    {canEdit
                      ? <input type="number" step="0.01" min="0" className={cellInput} value={r[c.key]}
                          onChange={(e) => patch(r.id, { [c.key]: Number(e.target.value) } as Partial<MonthlyItem>)}
                          onBlur={() => persist(r)} />
                      : <span className="portal-table-muted">{r[c.key]}</span>}
                  </td>
                ))}
                <td className="text-right"><StatusCell value={ee(r)} /></td>
                <td className="text-right">
                  {canEdit
                    ? <input type="number" step="0.01" min="0" className={cellInput} value={r.eeToMonth}
                        onChange={(e) => patch(r.id, { eeToMonth: Number(e.target.value) })}
                        onBlur={() => persist(r)} />
                    : <StatusCell value={r.eeToMonth} />}
                </td>
                {canEdit && <td className="text-right"><button type="button" className="text-red-600" onClick={() => start(() => deleteMonthlyDetail(r.id, projectId))}>Xóa</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu tháng nào</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td>Tổng</td>
                {COLS.map((c) => <td key={c.key} className="text-right">{totals[c.key].toFixed(2)}</td>)}
                <td></td><td></td>{canEdit && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!draft.month) return; start(async () => { await addMonthlyDetail(projectId, draft); setDraft(EMPTY_DRAFT()); }); }}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]"
        >
          <label className="text-sm">Tháng
            <input type="month" required className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.month} onChange={(e) => setD("month", e.target.value)} />
          </label>
          {COLS.map((c) => (
            <label key={c.key} className="text-sm">{c.label}
              <input type="number" step="0.01" min="0" className="mt-1 block w-24 rounded border px-2 py-1 text-sm" value={draft[c.key]} onChange={(e) => setD(c.key, Number(e.target.value))} />
            </label>
          ))}
          <label className="text-sm">EE To Month (%)
            <input type="number" step="0.01" min="0" className="mt-1 block w-24 rounded border px-2 py-1 text-sm" value={draft.eeToMonth} onChange={(e) => setD("eeToMonth", Number(e.target.value))} />
          </label>
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">+ Thêm</button>
        </form>
      )}

      {canEdit && (
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]">
          <button type="button" className="text-sm font-semibold text-[var(--vti-deep,#0A3CA8)]" onClick={() => setImportOpen((v) => !v)}>
            {importOpen ? "▾" : "▸"} Nhập từ Excel
          </button>
          {importOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">Dán các dòng từ file WR (cách nhau bằng Tab). Thứ tự cột: Tháng, Billable Project, Billable Develop, Warranty Effort, Calendar Member, Calendar Intern, Calendar Collaborator, OT Member Effort, OT Intern Effort, OT Collaborator Effort, Absent, EE, EE To Month.</p>
              <textarea className="h-32 w-full rounded border p-2 font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="2026-01&#9;5&#9;0&#9;..." />
              <div className="flex items-center gap-3">
                <button type="button" disabled={pending || !importText.trim()} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" onClick={runImport}>Nhập</button>
                {importMsg && <span className="text-xs text-slate-600">{importMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab into the page**

In `src/app/(portal)/projects/[id]/page.tsx`:

(a) Add the import after the other tab imports:

```tsx
import { MonthlyDetailTab } from "./monthly-detail-tab";
```

(b) Add `monthlyDetails` to the project query `include` (alongside `environments`/`allocations`):

```tsx
      monthlyDetails: { orderBy: { month: "asc" } },
```

(c) After the `environments` mapping (around line 57), build the rows:

```tsx
  const monthlyDetails = project.monthlyDetails.map((d) => ({
    id: d.id, month: d.month,
    billableProject: d.billableProject, billableDevelop: d.billableDevelop, warrantyEffort: d.warrantyEffort,
    calendarMember: d.calendarMember, calendarIntern: d.calendarIntern, calendarCollaborator: d.calendarCollaborator,
    otMemberEffort: d.otMemberEffort, otInternEffort: d.otInternEffort, otCollaboratorEffort: d.otCollaboratorEffort,
    absent: d.absent, eeToMonth: d.eeToMonth,
  }));
```

(d) Add the tab to the `tabs` array, after the "alloc" tab:

```tsx
    { id: "monthly", label: "Chi tiết theo tháng", content: <MonthlyDetailTab projectId={project.id} details={monthlyDetails} canEdit={canEdit} /> },
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no type errors in `projects/[id]`.

- [ ] **Step 4: Manual smoke check (managers only)**

Run: `npm run dev`, open a project at `/projects/<id>`, click "Chi tiết theo tháng".
Expected: empty-state row; add a month (e.g. Billable Project 9, Calendar Member 10) → EE shows `90.00` with a green dot; editing a cell and clicking away persists after reload; the import panel accepts a pasted TSV row.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/projects/[id]/monthly-detail-tab.tsx" "src/app/(portal)/projects/[id]/page.tsx"
git commit -m "feat: add Project Monthly Detail tab"
```

---

### Task 5: Documentation + full verification

**Files:**
- Modify: `CLAUDE.md` (project system map at `d8-portal/CLAUDE.md`)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: updated system map; green `npm test` / `npm run lint` / `npm run build`.

- [ ] **Step 1: Update `CLAUDE.md`**

Make these edits in `E:\PROJECTS\ACE\D8Portal\d8-portal\CLAUDE.md`:

(a) In the **Data model** section, append to the Meetings/Project bullet (after `ProjectEnvironment (...)`):

```
, `ProjectMonthlyDetail` (per-project monthly billable/effort man-months: billable/develop/warranty, calendar member/intern/collaborator, OT member/intern/collaborator, absent, plus manual `eeToMonth`; unique `[projectId, month]`)
```

(b) In the **`src/lib` function reference**, add a bullet:

```
- **monthly-detail.ts** — pure helpers for the Project Monthly Detail tab: `ee(row)` (= billableProject / (calendarMember + calendarIntern + otMemberEffort − absent) × 100, 0 when denominator ≤ 0), `eeStatus` (green ≥90 / amber ≥80 / red), `EE_THRESHOLDS`, `eeDenominator`, `monthlyTotals`, `EFFORT_FIELDS`, `parseMonthlyPaste(text)` (TSV paste → rows + errors; `ee` column ignored, `eeToMonth` stored).
```

(c) In **Server actions**, under the `projects/[id]` bullet, append:

```
`addMonthlyDetail`/`updateMonthlyDetail`/`deleteMonthlyDetail`/`importMonthlyDetails` (monthly billable/RA rows; all guard `project:manage`).
```

(d) In the `projects/[id]` route description, add the tab name to the tab list: `Chi tiết theo tháng`.

- [ ] **Step 2: Run the full unit suite**

Run: `npm test`
Expected: all suites pass, including `monthly-detail-lib` and `monthly-detail-actions`.

- [ ] **Step 3: Run lint and build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Project Monthly Detail in system map"
```

---

## Self-Review Notes

- **Spec coverage:** model (Task 1), EE compute + thresholds + parse (Task 2), actions incl. import upsert (Task 3), tab UI with computed EE / manual EE-To-Month / totals / import (Task 4), tests across Tasks 2–3, docs (Task 5). Acceptance criteria 1–6 all map to Task 4 manual check + Task 2/3 tests.
- **Type consistency:** `EffortFields`, `EFFORT_FIELDS`, `MonthlyFormData`, `MonthlyItem`, and the `projectId_month` compound key name are used identically across tasks.
- **Out of scope (Phase 2):** unit `report-ra.webp` dashboard aggregation — not in this plan.
