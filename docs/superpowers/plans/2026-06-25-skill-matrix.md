# Skill Matrix Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Manager-only Employee × Skill matrix at `/master-data/skill-matrix` with color-coded 0–5 cells (inline-editable), Department/Role/employee/skill filters, and a charts block (bar + line) computed live from the filtered data.

**Architecture:** A server component fetches users, active skills, and all `UserSkill` rows, builds a `userId→skillId→level` lookup, and hands it to a client component that does instant client-side filtering, renders the legend + two dependency-free inline-SVG charts + the matrix table (sticky header row & first column), and edits cells via a `setSkillLevel` server action. Pure aggregation/label helpers live in `src/lib/skill-matrix.ts`. No new Prisma models.

**Tech Stack:** Next.js 16.2 (App Router, RSC + Server Actions), Prisma 7 (`db` singleton, client at `src/generated/prisma`), Tailwind v4, lucide-react, Vitest.

## Global Constraints

- UI text is Vietnamese; match existing copy tone.
- Access: `master-data:manage` capability = MANAGERS (ADMIN/DIVISION_LEADER/SECTION_MANAGER). Pages redirect non-managers to `/`; every mutating action guards it.
- Proficiency levels are integers 0–5; labels: 0 None, 1 Basic, 2 Working, 3 Proficient, 4 Expert, 5 Can Train Others.
- A missing `UserSkill` row = level 0.
- No new dependencies (charts are inline SVG); no new Prisma models.
- `UserSkill` unique key is `[userId, skillId]` → Prisma composite `userId_skillId`.
- Run `npx tsc --noEmit` and the relevant `npx vitest run` green before each commit. Conventional Commits; end messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Tests use the `server-only` stub already configured in `vitest.config.ts`.

---

## File Structure

**Create:**
- `src/lib/skill-matrix.ts` — pure: `levelMeta`, `LEVELS`, `LEVEL_HEX`, `levelDistribution`, `avgPerSkill`, types.
- `src/app/(portal)/master-data/skill-matrix/actions.ts` — `setSkillLevel`.
- `src/app/(portal)/master-data/skill-matrix/bar-chart.tsx` — SVG bar chart.
- `src/app/(portal)/master-data/skill-matrix/line-chart.tsx` — SVG line chart.
- `src/app/(portal)/master-data/skill-matrix/skill-matrix.tsx` — client: filters, legend, charts, matrix.
- `src/app/(portal)/master-data/skill-matrix/page.tsx` — server: guard, fetch, build lookup.
- Tests: `tests/skill-matrix-lib.test.ts`, `tests/skill-matrix-actions.test.ts`.

**Modify:** `src/lib/nav.ts`, `src/components/layout/sidebar.tsx`, `tests/nav.test.ts`, `CLAUDE.md`.

---

## Task 1: Pure helpers (`skill-matrix.ts`)

**Files:**
- Create: `src/lib/skill-matrix.ts`
- Test: `tests/skill-matrix-lib.test.ts`

**Interfaces:**
- Produces:
  - `LEVELS: readonly [0,1,2,3,4,5]`
  - `LEVEL_HEX: Record<number, string>`
  - `type LevelMeta = { label: string; cellClass: string; swatchClass: string }`
  - `levelMeta(level: number): LevelMeta` (out-of-range → level-0 meta)
  - `type LevelLookup = Record<string, Record<string, number>>`
  - `levelDistribution(rows: {id:string}[], skills: {id:string}[], levels: LevelLookup): { level:number; label:string; count:number }[]` (levels 1–5 only)
  - `avgPerSkill(rows: {id:string}[], skills: {id:string;name:string}[], levels: LevelLookup): { skillId:string; name:string; avg:number }[]`

- [ ] **Step 1: Write the failing test** — create `tests/skill-matrix-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { levelMeta, levelDistribution, avgPerSkill } from "@/lib/skill-matrix";

describe("levelMeta", () => {
  it("labels levels 0..5", () => {
    expect(levelMeta(0).label).toBe("None");
    expect(levelMeta(1).label).toBe("Basic");
    expect(levelMeta(5).label).toBe("Can Train Others");
  });
  it("falls back to level-0 meta for out-of-range / NaN", () => {
    expect(levelMeta(9).label).toBe("None");
    expect(levelMeta(NaN).label).toBe("None");
  });
});

const rows = [{ id: "u1" }, { id: "u2" }];
const skills = [{ id: "s1", name: "AWS" }, { id: "s2", name: "React" }];
const levels = { u1: { s1: 3, s2: 5 }, u2: { s1: 3 } }; // u2.s2 missing = 0

describe("levelDistribution", () => {
  it("counts assignments per level 1..5, excluding 0/missing", () => {
    const d = levelDistribution(rows, skills, levels);
    expect(d).toHaveLength(5);
    const at = (lvl: number) => d.find((x) => x.level === lvl)!.count;
    expect(at(3)).toBe(2); // u1.s1 + u2.s1
    expect(at(5)).toBe(1); // u1.s2
    expect(at(1)).toBe(0);
  });
});

describe("avgPerSkill", () => {
  it("averages over all rows treating missing as 0, preserves order, rounds to 1 decimal", () => {
    const a = avgPerSkill(rows, skills, levels);
    expect(a.map((x) => x.skillId)).toEqual(["s1", "s2"]);
    expect(a[0].avg).toBe(3);   // (3+3)/2
    expect(a[1].avg).toBe(2.5); // (5+0)/2
  });
  it("returns 0 avg when there are no rows", () => {
    expect(avgPerSkill([], skills, levels)[0].avg).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/skill-matrix-lib.test.ts`
Expected: FAIL (module `@/lib/skill-matrix` not found).

- [ ] **Step 3: Implement** — create `src/lib/skill-matrix.ts`:

```ts
export type LevelMeta = { label: string; cellClass: string; swatchClass: string };

const META: Record<number, LevelMeta> = {
  0: { label: "None", cellClass: "bg-slate-100 text-slate-400", swatchClass: "bg-slate-200" },
  1: { label: "Basic", cellClass: "bg-red-400 text-white", swatchClass: "bg-red-400" },
  2: { label: "Working", cellClass: "bg-orange-400 text-white", swatchClass: "bg-orange-400" },
  3: { label: "Proficient", cellClass: "bg-amber-400 text-slate-900", swatchClass: "bg-amber-400" },
  4: { label: "Expert", cellClass: "bg-emerald-200 text-emerald-900", swatchClass: "bg-emerald-200" },
  5: { label: "Can Train Others", cellClass: "bg-emerald-500 text-white", swatchClass: "bg-emerald-500" },
};

export const LEVELS = [0, 1, 2, 3, 4, 5] as const;

export const LEVEL_HEX: Record<number, string> = {
  0: "#e2e8f0", 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#a7f3d0", 5: "#10b981",
};

export function levelMeta(level: number): LevelMeta {
  return META[level] ?? META[0];
}

export type LevelLookup = Record<string, Record<string, number>>;

export function levelDistribution(
  rows: { id: string }[],
  skills: { id: string }[],
  levels: LevelLookup,
): { level: number; label: string; count: number }[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const bySkill = levels[r.id] ?? {};
    for (const s of skills) {
      const lvl = bySkill[s.id] ?? 0;
      if (lvl >= 1 && lvl <= 5) counts[lvl]++;
    }
  }
  return [1, 2, 3, 4, 5].map((level) => ({ level, label: levelMeta(level).label, count: counts[level] }));
}

export function avgPerSkill(
  rows: { id: string }[],
  skills: { id: string; name: string }[],
  levels: LevelLookup,
): { skillId: string; name: string; avg: number }[] {
  return skills.map((s) => {
    if (rows.length === 0) return { skillId: s.id, name: s.name, avg: 0 };
    let sum = 0;
    for (const r of rows) sum += levels[r.id]?.[s.id] ?? 0;
    return { skillId: s.id, name: s.name, avg: Math.round((sum / rows.length) * 10) / 10 };
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/skill-matrix-lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skill-matrix.ts tests/skill-matrix-lib.test.ts
git commit -m "feat: add skill matrix level + aggregation helpers"
```

---

## Task 2: `setSkillLevel` server action

**Files:**
- Create: `src/app/(portal)/master-data/skill-matrix/actions.ts`
- Test: `tests/skill-matrix-actions.test.ts`

**Interfaces:**
- Produces: `setSkillLevel(userId: string, skillId: string, level: number): Promise<void>`.

- [ ] **Step 1: Write the failing test** — create `tests/skill-matrix-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { userSkill: {
  upsert: (...a: unknown[]) => upsertMock(...a),
  deleteMany: (...a: unknown[]) => deleteManyMock(...a),
} } }));

import { setSkillLevel } from "../src/app/(portal)/master-data/skill-matrix/actions";

beforeEach(() => { authMock.mockReset(); upsertMock.mockReset(); deleteManyMock.mockReset(); });

describe("setSkillLevel", () => {
  it("blocks a MEMBER and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(setSkillLevel("u1", "s1", 3)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("blocks a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "PM" } });
    await expect(setSkillLevel("u1", "s1", 3)).rejects.toThrow("Forbidden");
  });
  it("rejects out-of-range / non-integer levels", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(setSkillLevel("u1", "s1", 6)).rejects.toThrow(/level/i);
    await expect(setSkillLevel("u1", "s1", -1)).rejects.toThrow(/level/i);
    await expect(setSkillLevel("u1", "s1", 1.5)).rejects.toThrow(/level/i);
  });
  it("deletes when level is 0", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "SECTION_MANAGER" } });
    await setSkillLevel("u1", "s1", 0);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { userId: "u1", skillId: "s1" } });
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("upserts when level is 1..5", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await setSkillLevel("u1", "s1", 3);
    const arg = upsertMock.mock.calls[0][0] as { create: { level: number }; update: { level: number } };
    expect(arg.create.level).toBe(3);
    expect(arg.update.level).toBe(3);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/skill-matrix-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/app/(portal)/master-data/skill-matrix/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export async function setSkillLevel(userId: string, skillId: string, level: number) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
  if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error("Validation: level must be an integer 0..5");

  if (level === 0) {
    await db.userSkill.deleteMany({ where: { userId, skillId } });
  } else {
    await db.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, level },
      update: { level },
    });
  }
  revalidatePath("/master-data/skill-matrix");
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/skill-matrix-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/master-data/skill-matrix/actions.ts" tests/skill-matrix-actions.test.ts
git commit -m "feat: add setSkillLevel action for the skill matrix"
```

---

## Task 3: Navigation entry

**Files:**
- Modify: `src/lib/nav.ts`, `src/components/layout/sidebar.tsx`
- Test: `tests/nav.test.ts`

**Interfaces:**
- Consumes: `MANAGER_ONLY` (nav.ts), `managerOnly` (sidebar.tsx).
- Produces: nav entry href `/master-data/skill-matrix`.

- [ ] **Step 1: Add the failing test** — append inside `describe("navForRole()")` in `tests/nav.test.ts`:

```ts
  it("shows Skill Matrix to managers, hides from PM and Member", () => {
    expect(navForRole("SECTION_MANAGER").map((i) => i.href)).toContain("/master-data/skill-matrix");
    expect(navForRole("PM").map((i) => i.href)).not.toContain("/master-data/skill-matrix");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/master-data/skill-matrix");
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/nav.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add nav item** — in `src/lib/nav.ts`, add immediately after the `"Hồ sơ thành viên"` line in `NAV_ITEMS`:

```ts
  { label: "Skill Matrix", href: "/master-data/skill-matrix", icon: "Grid3x3", visible: MANAGER_ONLY },
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Add sidebar item** — in `src/components/layout/sidebar.tsx`, add `Grid3x3` to the `lucide-react` import block, then add to the `"Master Data"` group's `items` array (after the `"Hồ sơ thành viên"` item):

```tsx
      { label: "Skill Matrix", href: "/master-data/skill-matrix", icon: Grid3x3, visible: managerOnly },
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add src/lib/nav.ts src/components/layout/sidebar.tsx tests/nav.test.ts
git commit -m "feat: add Skill Matrix nav entry"
```

---

## Task 4: Chart components

**Files:**
- Create: `src/app/(portal)/master-data/skill-matrix/bar-chart.tsx`, `.../line-chart.tsx`

**Interfaces:**
- Consumes: `LEVEL_HEX` from `@/lib/skill-matrix`.
- Produces:
  - `BarChart({ data }: { data: { level: number; label: string; count: number }[] })`
  - `LineChart({ data }: { data: { skillId: string; name: string; avg: number }[] })`

- [ ] **Step 1: Create the bar chart** — create `src/app/(portal)/master-data/skill-matrix/bar-chart.tsx`:

```tsx
import { LEVEL_HEX } from "@/lib/skill-matrix";

export function BarChart({ data }: { data: { level: number; label: string; count: number }[] }) {
  const W = 360, H = 170, padX = 20, padTop = 16, padBottom = 28;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const gap = 14;
  const barW = (W - padX * 2 - gap * (n - 1)) / n;
  const plotH = H - padTop - padBottom;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Số lượng đánh giá theo level">
      {data.map((d, i) => {
        const h = (plotH * d.count) / max;
        const x = padX + i * (barW + gap);
        const y = H - padBottom - h;
        return (
          <g key={d.level}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={LEVEL_HEX[d.level]} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="11" fill="#334155">{d.count}</text>
            <text x={x + barW / 2} y={H - padBottom + 13} textAnchor="middle" fontSize="9" fill="#64748b">{d.level}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Create the line chart** — create `src/app/(portal)/master-data/skill-matrix/line-chart.tsx`:

```tsx
export function LineChart({ data }: { data: { skillId: string; name: string; avg: number }[] }) {
  const W = 520, H = 180, padX = 30, padY = 18, maxLevel = 5;
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : padX + ((W - padX * 2) * i) / (n - 1));
  const y = (v: number) => H - padY - ((H - padY * 2) * v) / maxLevel;
  const points = data.map((d, i) => `${x(i)},${y(d.avg)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Độ thành thạo trung bình theo skill">
      {[0, 1, 2, 3, 4, 5].map((g) => (
        <g key={g}>
          <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#eef2f7" strokeWidth="1" />
          <text x={padX - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{g}</text>
        </g>
      ))}
      {n > 1 && <polyline points={points} fill="none" stroke="#0A3CA8" strokeWidth="2" />}
      {data.map((d, i) => (
        <circle key={d.skillId} cx={x(i)} cy={y(d.avg)} r="3" fill="#0A3CA8">
          <title>{d.name}: {d.avg}</title>
        </circle>
      ))}
      {n === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="#94a3b8">Không có dữ liệu</text>}
    </svg>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add "src/app/(portal)/master-data/skill-matrix/bar-chart.tsx" "src/app/(portal)/master-data/skill-matrix/line-chart.tsx"
git commit -m "feat: add skill matrix bar and line chart components"
```

---

## Task 5: Matrix client component + page

**Files:**
- Create: `src/app/(portal)/master-data/skill-matrix/skill-matrix.tsx`, `.../page.tsx`

**Interfaces:**
- Consumes: `ROLES`, `Role` from `@/types`; `levelMeta`, `LEVELS`, `levelDistribution`, `avgPerSkill`, `LevelLookup` from `@/lib/skill-matrix`; `BarChart`, `LineChart`; `setSkillLevel`.
- Produces: `SkillMatrix({ rows, skills, levels })` where `rows: { id:string; name:string; title:string|null; section:string|null; role:string }[]`, `skills: { id:string; name:string }[]`, `levels: LevelLookup`.

- [ ] **Step 1: Create the client component** — create `src/app/(portal)/master-data/skill-matrix/skill-matrix.tsx`:

```tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import { ROLES } from "@/types";
import { levelMeta, LEVELS, levelDistribution, avgPerSkill, type LevelLookup } from "@/lib/skill-matrix";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";
import { setSkillLevel } from "./actions";

type Row = { id: string; name: string; title: string | null; section: string | null; role: string };
type Skill = { id: string; name: string };

export function SkillMatrix({ rows, skills, levels }: { rows: Row[]; skills: Skill[]; levels: LevelLookup }) {
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [pending, start] = useTransition();

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.section).filter((s): s is string => !!s))].sort(),
    [rows],
  );

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!department || r.section === department) &&
          (!role || r.role === role) &&
          (!employeeQuery || r.name.toLowerCase().includes(employeeQuery.toLowerCase())),
      ),
    [rows, department, role, employeeQuery],
  );

  const visibleSkills = useMemo(
    () => skills.filter((s) => !skillQuery || s.name.toLowerCase().includes(skillQuery.toLowerCase())),
    [skills, skillQuery],
  );

  const dist = useMemo(() => levelDistribution(visibleRows, visibleSkills, levels), [visibleRows, visibleSkills, levels]);
  const avg = useMemo(() => avgPerSkill(visibleRows, visibleSkills, levels), [visibleRows, visibleSkills, levels]);

  const cellLevel = (userId: string, skillId: string) => levels[userId]?.[skillId] ?? 0;

  const selectClass = "h-8 w-14 rounded border-0 text-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" placeholder="Search employee..." value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} />
        <input className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" placeholder="Search skill..." value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="font-semibold">Proficiency:</span>
        {LEVELS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className={"inline-block h-3 w-3 rounded " + levelMeta(l).swatchClass} />
            {l} {levelMeta(l).label}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Số đánh giá theo level</h3>
          <BarChart data={dist} />
        </div>
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Độ thành thạo trung bình theo skill</h3>
          <LineChart data={avg} />
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white shadow-[var(--sh-1)]">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
              {visibleSkills.map((s) => (
                <th key={s.id} className="sticky top-0 z-10 min-w-[88px] border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold text-slate-600">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2">
                  <div className="font-semibold text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.title ?? "-"}</div>
                </td>
                {visibleSkills.map((s) => {
                  const lvl = cellLevel(r.id, s.id);
                  return (
                    <td key={s.id} className="border-b border-slate-100 px-1 py-1 text-center">
                      <select
                        className={selectClass + " " + levelMeta(lvl).cellClass}
                        value={lvl}
                        disabled={pending}
                        onChange={(e) => start(() => setSkillLevel(r.id, s.id, Number(e.target.value)))}
                        aria-label={`${r.name} - ${s.name}`}
                      >
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={visibleSkills.length + 1} className="px-4 py-8 text-center text-slate-400">Không có nhân sự phù hợp</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page** — create `src/app/(portal)/master-data/skill-matrix/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { LevelLookup } from "@/lib/skill-matrix";
import { SkillMatrix } from "./skill-matrix";

export default async function SkillMatrixPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const [users, skills, userSkills] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true, section: true, role: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.userSkill.findMany({ select: { userId: true, skillId: true, level: true } }),
  ]);

  const levels: LevelLookup = {};
  for (const us of userSkills) {
    (levels[us.userId] ??= {})[us.skillId] = us.level;
  }

  const rows = users.map((u) => ({ id: u.id, name: u.name, title: u.title, section: u.section, role: u.role as string }));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Skill Matrix</h1>
          <p className="portal-page-subtitle">Mức thành thạo thực tế của nhân sự theo từng kỹ năng.</p>
        </div>
      </div>
      <SkillMatrix rows={rows} skills={skills} levels={levels} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Build to verify the route compiles**

Run: `npm run build`
Expected: build succeeds and the route list includes `ƒ /master-data/skill-matrix`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/master-data/skill-matrix/skill-matrix.tsx" "src/app/(portal)/master-data/skill-matrix/page.tsx"
git commit -m "feat: add skill matrix screen (filters, charts, editable cells)"
```

---

## Task 6: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the system map** — in `CLAUDE.md`:
  - Under `src/lib` reference, add: `- **skill-matrix.ts** — pure helpers for the Skill Matrix screen: `levelMeta` (0–5 label + Tailwind classes), `LEVELS`, `LEVEL_HEX`, `levelDistribution` (count per level), `avgPerSkill` (mean level per skill).`
  - Under Server actions, add to the master-data list: `- **master-data/skill-matrix**: `setSkillLevel(userId, skillId, level)` (0 removes, 1–5 upserts; guards `master-data:manage`).`
  - Note the new route `/master-data/skill-matrix` and the "Skill Matrix" nav item in the Master Data group.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document skill matrix screen in system map"
```

---

## Self-Review

**Spec coverage:**
- Route + nav + Manager-only guard → Tasks 3, 5. ✓
- Pure `levelMeta` + colors → Task 1. ✓
- Filters (department/role/employee/skill, client-side) → Task 5. ✓
- Legend 0–5 → Task 5. ✓
- Charts block (bar + line) from filtered data, inline SVG, no dep → Tasks 1 (aggregation), 4 (render), 5 (wiring). ✓
- Sticky header row + first column → Task 5. ✓
- Inline edit `setSkillLevel` (0 deletes, 1–5 upserts, clamp, guard) → Task 2. ✓
- Tests: nav, lib (levelMeta/levelDistribution/avgPerSkill), action → Tasks 1, 2, 3. ✓
- Docs → Task 6. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; no "similar to Task N".

**Type consistency:** `LevelLookup` defined in Task 1, consumed in Tasks 2-flow/5; `levelDistribution`/`avgPerSkill` return shapes match what `BarChart`/`LineChart` (Task 4) consume (`{level,label,count}` and `{skillId,name,avg}`); `setSkillLevel(userId, skillId, level)` signature identical across Tasks 2 and 5; `userId_skillId` composite key matches the existing `UserSkill` unique. `ROLES` is exported from `@/types` (verified). Cell value is controlled from the `levels` prop; after `setSkillLevel` the action calls `revalidatePath("/master-data/skill-matrix")`, refreshing the prop.

**Note for executor:** The Master Data feature (models, `master-data:manage`, nav group, `Skill`/`UserSkill`) must already be on the branch (it is — committed earlier). No migration needed; this is a pure view + edit over existing tables.
