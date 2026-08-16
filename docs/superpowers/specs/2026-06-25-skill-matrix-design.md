# Skill Matrix Screen — Design

**Date:** 2026-06-25
**Status:** Approved (design)
**Area:** D8 Portal — new screen under the Master Data area

## Goal

An Employee × Skill proficiency matrix: rows are users, columns are skills, each cell shows the user's actual proficiency level (0–5) with color coding. Managers can edit a cell inline. Read of existing `UserSkill` data — no new models, no required-vs-actual gap analysis (v1).

## Decisions (locked)

- **Cells display actual `UserSkill.level` (0–5)**, color-coded by the legend. A missing `UserSkill` row renders as `0 / None`.
- **Inline editable:** clicking a cell sets the level; `0` deletes the `UserSkill`, `1–5` upserts.
- **Filters:** Department = `User.section`, Role = system `Role` enum, employee search (by name), skill search (by name). All client-side/instant. No criticality filter (would need a new field).
- **Access:** Managers and above (`master-data:manage`), consistent with the Master Data group.
- Row label shows `User.name` + `User.title` (e.g. "AI Engineer") as display text; the Role filter uses the enum, not the title.
- No pagination — the matrix shows all (filtered) rows for scanning.
- A **charts block** sits between the filter bar and the matrix, with two inline-SVG charts (no chart library) computed from the **currently filtered** rows/columns so they update live with the filters:
  - **Bar chart** — count of skill assignments at each level 1–5 ("số user theo từng level"), bars colored with the matrix palette. Level 0 (no skill) is excluded.
  - **Line chart** — average proficiency per skill across all visible users (missing = 0), x-axis = visible skill columns. A team skill-strength profile.

## Navigation & permissions

- New route `/master-data/skill-matrix`.
- New item **"Skill Matrix"** in the Master Data sidebar group (`src/components/layout/sidebar.tsx`) and `NAV_ITEMS` (`src/lib/nav.ts`), both gated `MANAGER_ONLY` / `managerOnly`. Icon: `Grid3x3` (lucide).
- Page guards `can(role, "master-data:manage")` → `redirect("/")`.

## Proficiency scale & colors

| Level | Label | Cell color (Tailwind, approx) |
|---|---|---|
| 0 | None | `bg-slate-100 text-slate-400` |
| 1 | Basic | `bg-red-400 text-white` |
| 2 | Working | `bg-orange-400 text-white` |
| 3 | Proficient | `bg-amber-400 text-slate-900` |
| 4 | Expert | `bg-emerald-200 text-emerald-900` |
| 5 | Can Train Others | `bg-emerald-500 text-white` |

A pure helper `levelMeta(level: number): { label: string; cellClass: string; swatchClass: string }` in `src/lib/skill-matrix.ts` centralizes this (used by cells and the legend). Out-of-range input falls back to the level-0 meta.

## Chart aggregation (pure helpers in `src/lib/skill-matrix.ts`)

Both take the already-filtered visible rows/columns + the `levels` lookup, so charts reflect the current filters. Kept pure for unit testing; rendered by tiny inline-SVG components (`bar-chart.tsx`, `line-chart.tsx`) — no chart dependency.

```ts
type LevelLookup = Record<string, Record<string, number>>; // userId -> skillId -> level

// Count of (user, skill) assignments at each level 1..5 across visible cells.
// Returns [{ level, label, count }] for levels 1..5 (0 excluded).
export function levelDistribution(
  rows: { id: string }[], skills: { id: string }[], levels: LevelLookup,
): { level: number; label: string; count: number }[];

// Average proficiency per visible skill across ALL visible users (missing = 0),
// preserving the skill column order. avg rounded to 1 decimal.
export function avgPerSkill(
  rows: { id: string }[], skills: { id: string; name: string }[], levels: LevelLookup,
): { skillId: string; name: string; avg: number }[];
```

## Data flow

**Server component `page.tsx`:**
```
const session = await auth();
if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");
const [users, skills, userSkills] = await Promise.all([
  db.user.findMany({ orderBy: { name: "asc" }, select: { id, name, title, section, role } }),
  db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id, name } }),
  db.userSkill.findMany({ select: { userId, skillId, level } }),
]);
```
Build `levels: Record<userId, Record<skillId, number>>` from `userSkills`. Compute distinct `departments` (non-null sections, sorted) and pass `ROLES` (from `@/types`) for the role filter. Pass `{ rows: {id,name,title,section,role}[], skills: {id,name}[], levels }` to the client component.

**Client component `skill-matrix.tsx`:**
- Receives rows, skills, levels.
- State: `department`, `role`, `employeeQuery`, `skillQuery`.
- Visible rows = rows filtered by department (`section === department || !department`), role (`role === role || !role`), and case-insensitive name contains `employeeQuery`.
- Visible columns = skills filtered by name contains `skillQuery`.
- Computes chart data from the **filtered** rows/columns via pure helpers (below) and renders the charts block above the matrix.
- Renders a table: sticky header row (skill names) + sticky first column (employee name + title). Each cell renders the level via `levelMeta`.
- Edit: cell is a `<select>` (options 0–5 labelled by `levelMeta`) styled with the level color; `onChange` → `startTransition(() => setSkillLevel(userId, skillId, Number(value)))`. The select is disabled while pending.

## Server action (`skill-matrix/actions.ts`)

```ts
export async function setSkillLevel(userId: string, skillId: string, level: number) {
  // guard master-data:manage
  // validate level is an integer 0..5, else throw
  // level === 0 → db.userSkill.deleteMany({ where: { userId, skillId } })
  // else → db.userSkill.upsert({ where: { userId_skillId: { userId, skillId } },
  //          create: { userId, skillId, level }, update: { level } })
  // revalidatePath("/master-data/skill-matrix")
}
```
Use `deleteMany` (not `delete`) for the 0 case so removing an already-absent skill is a no-op rather than a throw.

## Testing

- `tests/nav.test.ts`: Skill Matrix (`/master-data/skill-matrix`) visible to managers, hidden from PM/MEMBER.
- `tests/skill-matrix-lib.test.ts`: `levelMeta` returns correct label per level 0–5 and falls back to level-0 meta for out-of-range/NaN; `levelDistribution` counts assignments per level 1–5 and excludes 0/missing; `avgPerSkill` averages over all rows treating missing as 0, preserves column order, rounds to 1 decimal.
- `tests/skill-matrix-actions.test.ts`: `setSkillLevel` throws Forbidden for MEMBER/PM and does not write; rejects level 6 / -1 / non-integer; `level 0` calls `deleteMany`; `level 3` calls `upsert` with `level: 3`.

## Files

- Create: `src/lib/skill-matrix.ts` (levelMeta + levelDistribution + avgPerSkill), `src/app/(portal)/master-data/skill-matrix/page.tsx`, `.../skill-matrix.tsx`, `.../bar-chart.tsx`, `.../line-chart.tsx`, `.../actions.ts`
- Create tests: `tests/skill-matrix-lib.test.ts`, `tests/skill-matrix-actions.test.ts`
- Modify: `src/lib/nav.ts`, `src/components/layout/sidebar.tsx`, `tests/nav.test.ts`, `CLAUDE.md`

## Out of scope (v1)

- Required-level-per-role and gap highlighting.
- Skill criticality field/filter.
- Export, bulk edit, column grouping by skill category, pagination/virtualization.
