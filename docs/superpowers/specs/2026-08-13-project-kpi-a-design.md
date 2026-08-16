# KPI Loại A — Design

Date: 2026-08-13
Status: Approved

## Goal

Track which members earn a "KPI Loại A" in a given month, per project.

1. A new **"List KPI Loại A"** tab on the project detail screen (`/projects/[id]`) that manages the month's KPI-A members, with an **Add KPI** popup (pick a month, tick several members, optional note per member).
2. A new sidebar item **"List KPI A"** at `/kpi-a` listing KPI-A records across all projects, filterable by month and by project.

## Decisions

| Decision | Choice |
| --- | --- |
| Record shape | month + member + optional note (note not required) |
| Multiple members per month | Yes |
| KPI type | `kpiType` column, only `"A"` used today — B/C need no migration later |
| Edit permission (project tab) | Manager or the project's PIC PM (`requireProjectEditAccess`) |
| Sidebar visibility | Manager + PM (`MANAGER_OR_PM`, same as `Projects`) |
| Popup member source | All users (some projects have no allocations yet) |
| Route | `/kpi-a` |

## Data model

New table in `prisma/schema.prisma`, styled after `ProjectAllocation`:

```prisma
model ProjectKpi {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  month     String   // "YYYY-MM"
  kpiType   String   @default("A")
  note      String?
  createdAt DateTime @default(now())

  @@unique([projectId, month, kpiType, userId])
  @@index([month])
}
```

Back-relations: `Project.kpis ProjectKpi[]`, `User.projectKpis ProjectKpi[]`.

Migration SQL is hand-written into `prisma/migrations/<timestamp>_add_project_kpi/migration.sql`
(matching the other migrations on this branch). The developer runs `npm run db:migrate`.

## Pure lib — `src/lib/project-kpi.ts`

- `KPI_TYPE_A = "A"`, `KPI_TYPES = ["A"]`.
- `normalizeKpiInput({ month, kpiType, entries })` → `{ month, kpiType, entries: [{ userId, note }] }`:
  - `month` must match `/^\d{4}-\d{2}$/`, else throw a `Validation:` error.
  - `kpiType` defaults to `"A"`; anything outside `KPI_TYPES` throws.
  - `entries` de-duplicated by `userId`, blank `userId` dropped, `note` trimmed → `null` when empty.
  - Empty result throws (`chọn ít nhất 1 member`).

Month labels reuse `formatMonth` from `src/lib/point-award.ts`.

Unit tests: `tests/project-kpi.test.ts`.

## Project detail tab

`src/app/(portal)/projects/[id]/kpi-tab.tsx`, appended to the `tabs` array in `page.tsx`
(label `List KPI Loại A`). `page.tsx` also includes `kpis` (with `user: { id, name }`) in
its `project.findUnique` and passes all users (already loaded for the allocations tab).

- Table sorted month desc → member name: **Tháng | Member | Ghi chú | (Xóa)**.
- `Ghi chú` is an inline input persisted on blur for editors (same pattern as
  `allocations-tab.tsx`); plain text for viewers.
- `+ Add KPI` (editors only) opens a local overlay (`fixed inset-0`, no native
  `dialog`/`confirm`): `Tháng` via `<input type="month">` defaulting to the current
  month, then a scrollable checkbox list of **all users**; each checked row reveals an
  optional `Ghi chú` input.
- Submitting adds every selected member in one action. Re-adding an existing
  member+month is a silent no-op (`createMany` + `skipDuplicates`), not an error.

## Server actions — `projects/[id]/actions.ts`

All gated by `requireProjectEditAccess(projectId)` and revalidating `/projects/[id]` and `/kpi-a`.

- `addProjectKpis(projectId, input)` — validates via `normalizeKpiInput`, `createMany({ skipDuplicates: true })`.
- `updateProjectKpiNote(id, projectId, note)`.
- `deleteProjectKpi(id, projectId)`.

## Global list page — `/kpi-a`

`src/app/(portal)/kpi-a/page.tsx` (read-only) + `kpi-a-filter.tsx` (client, modeled on
`meetings-filter.tsx`).

- Columns **Tháng | Dự án | Member | Ghi chú**, sorted month desc → project name → member name.
- Filters via searchParams `?month=&projectId=`. Month options are the distinct months
  present in the visible rows; project options are the visible projects.
- Row-level visibility reuses `projectVisibilityWhere(role, userId)` from `src/lib/projects.ts`:
  a PM only sees projects they're PIC PM on; managers see all.
- Nav entry after `Projects` in `src/lib/nav.ts`:
  `{ label: "List KPI A", href: "/kpi-a", icon: "Target", visible: MANAGER_OR_PM }`.

## Excel export (follow-up)

`GET /api/kpi-a/export?month=&projectId=` writes the list with SheetJS
(`XLSX.write`, sheet `KPI A`, columns Tháng / Dự án / Member / Loại KPI / Ghi chú).

- The `⬇ Xuất Excel` link on `/kpi-a` carries the page's active filters into the query
  string, so the file matches the table exactly.
- Gated by `canViewKpiList(role)` (401 anonymous, 403 for MEMBER) and scoped by the same
  `kpiProjectWhere`, so a PM can never export another project's KPI.
- A malformed `month` is ignored rather than erroring; no matches yields a header-only file.
- File name from `kpiExportFileName(month)` — `KPI-loai-A-2026-08.xlsx`, or
  `KPI-loai-A-tat-ca-thang.xlsx` with no month filter. ASCII only, so
  `Content-Disposition` needs no `filename*` encoding.

Query + visibility moved into `src/lib/kpi-a-report.ts` (server-only) so the page and the
export route share one source of truth.

## Files touched

- `prisma/schema.prisma` + new migration folder
- `src/lib/{project-kpi.ts, kpi-a-report.ts}` (new), `src/lib/nav.ts`
- `src/components/layout/sidebar.tsx` (the rendered sidebar keeps its own hardcoded group
  list separate from `nav.ts` — both need the entry)
- `src/app/(portal)/projects/[id]/{page.tsx, actions.ts, kpi-tab.tsx}`
- `src/app/(portal)/kpi-a/{page.tsx, kpi-a-filter.tsx}` (new)
- `src/app/api/kpi-a/export/route.ts` (new)
- `tests/{project-kpi-lib.test.ts, kpi-a-export-route.test.ts}` (new),
  `tests/{project-detail-actions.test.ts, nav.test.ts}`
- `CLAUDE.md` (system map sync)

## Out of scope

- KPI loại B/C UI (column exists, no UI).
- Notifications (Google Chat) for KPI awards.
- Editing month/member of an existing row — delete and re-add instead.
