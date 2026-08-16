# Project Resource Allocation — Design

**Date:** 2026-06-26
**Status:** Approved (design)
**Area:** D8 Portal — create/edit Project screen

## Goal

On the create/edit Project screen, add a "Phân bổ nguồn lực" (resource allocation) section: a list of requirement slots, each specifying which member (optional), what project role, what skill (optional), and how many hours per day. Restructure the screen into a roomy full-width editor (top) with the project list below.

## Decisions (locked)

- Each allocation row is a **requirement slot**: `member` is optional (a slot may be unfilled), `role` is required, `skill` is optional, `hoursPerDay` is required.
- `role` comes from a new **master-data `PROJECT_ROLE`** category (managed on the Danh mục screen).
- `skill` is a **FK to the existing `Skill` catalog**.
- `hoursPerDay` is a **Float** (decimals allowed, e.g. 4.5), range 0–24.
- Layout: **full-width editor card on top, project list card below**.
- Access unchanged: `project:manage` (managers).

## 1. Data model (`prisma/schema.prisma`)

```prisma
model ProjectAllocation {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  role        String
  skillId     String?
  skill       Skill?   @relation(fields: [skillId], references: [id])
  hoursPerDay Float
  createdAt   DateTime @default(now())

  @@index([projectId])
}
```

Add relation fields: `Project.allocations ProjectAllocation[]`, `User.allocations ProjectAllocation[]`, `Skill.allocations ProjectAllocation[]`. Migration via `npm run db:migrate -- --name project_allocation` (DB reachable; build runs `prisma generate`).

## 2. Project Role as managed master data

- `src/lib/master-data.ts`: `export const PROJECT_ROLES = ["Developer","BrSE","Tester","QA","BA","PM","Comtor","Designer"] as const;`
- `src/lib/master-data-db.ts`: add `"PROJECT_ROLE"` to `CATEGORY_TYPES`; `CATEGORY_LABELS.PROJECT_ROLE = "Vai trò dự án"`; `CATEGORY_FALLBACK.PROJECT_ROLE = PROJECT_ROLES`.
- `prisma/seed.ts`: add `["PROJECT_ROLE", PROJECT_ROLES]` to the `CATEGORY_SEED` array.
- The Danh mục page (`/master-data/categories`) iterates `CATEGORY_TYPES`, so PROJECT_ROLE appears for management with no page change. The category-actions `clean()` validates against `CATEGORY_TYPES`, so it accepts the new type automatically.

## 3. Pure helper (`src/lib/projects.ts`, new)

```ts
export type AllocationInput = { userId: string; role: string; skillId: string; hoursPerDay: number };
export type AllocationData = { userId: string | null; role: string; skillId: string | null; hoursPerDay: number };

export function normalizeAllocations(rows: AllocationInput[]): AllocationData[] {
  const out: AllocationData[] = [];
  for (const r of rows) {
    const role = r.role.trim();
    const userId = r.userId.trim();
    const skillId = r.skillId.trim();
    if (!role && !userId && !skillId) continue; // drop fully-empty rows
    if (!role) throw new Error("Validation: mỗi dòng phân bổ cần vai trò");
    const hours = Number(r.hoursPerDay);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error("Validation: giờ/ngày phải trong khoảng 0..24");
    out.push({ userId: userId || null, role, skillId: skillId || null, hoursPerDay: hours });
  }
  return out;
}
```

Unit-tested; keeps the server actions thin.

## 4. Server actions (`projects/actions.ts`)

- Extend `ProjectFormData` with `allocations: AllocationInput[]`.
- `createProject`: `db.project.create({ data: { ...clean(form), accessKey, allocations: { create: normalizeAllocations(form.allocations) } } })`.
- `updateProject`: add `allocations: { deleteMany: {}, create: normalizeAllocations(form.allocations) }` (same replace pattern as meeting `eeRows`).
- `deleteProject` unchanged (Cascade removes allocations).
- All still guard `project:manage`; `normalizeAllocations` runs after the auth guard.

## 5. Layout & form

**`projects/page.tsx`:**
- Fetch in parallel: projects `include: { allocations: { include: { user: { select:{id,name} }, skill: { select:{id,name} } } } }` (ordered), users (`id, name`), active skills (`id, name`), `getCategoryMap(["PROJECT","MEETING_SECTION"])` (existing), and `getCategoryValues("PROJECT_ROLE")`.
- Map each project row to include `allocations: { userId, role, skillId, hoursPerDay }[]` for preload, plus an `allocationCount`.
- Pass `users`, `skills`, `roles`, `categories`, `sections` to `<ProjectForm>`.

**`projects/project-form.tsx`** (restructure):
- Single **full-width editor card**:
  - Basic fields in a responsive grid (`sm:grid-cols-2 lg:grid-cols-4`): name, code, category, section; description full row; the existing Source code & PM `fieldset` retained.
  - **"Phân bổ nguồn lực"** section: a table row-editor. Each row: Member `<select>` (blank = "— Chưa gán —", else users), Role `<select>` (from `roles`), Skill `<select>` (blank = "— Không —", else skills), Giờ/ngày `<input type="number" step="0.5" min="0" max="24">`, and a remove button. A "+ Thêm dòng" button appends an empty row.
  - Save / Cancel.
- **Project list as a full-width card below** the editor (move the existing table out of the old right column), with a "N nguồn lực" pill per row using `allocationCount`.
- `ProjectFormData` (client) gains `allocations: AllocationInput[]`; `EMPTY`/`emptyForm` start with `allocations: []`. `edit(project)` preloads `project.allocations` mapped to `AllocationInput` (`userId ?? ""`, `skillId ?? ""`, `hoursPerDay`, `role`).
- The `ProjectRow` type passed in gains `allocations: { userId: string|null; role: string; skillId: string|null; hoursPerDay: number }[]` and `allocationCount: number`.

## 6. Testing

- `tests/projects-lib.test.ts` (new): `normalizeAllocations` — drops fully-empty rows; throws when a non-empty row lacks `role`; rejects hours < 0, > 24, NaN; maps empty `userId`/`skillId` to `null`; passes a valid mixed set through.
- `tests/project-actions.test.ts` (extend the existing file): `createProject` includes `allocations.create` with normalized data; `updateProject` includes `allocations.deleteMany` + `create`; a MEMBER is still blocked (no write).
- `tests/master-data-db.test.ts` (extend): `getCategoryValues("PROJECT_ROLE")` falls back to `PROJECT_ROLES` when the table is empty.

## 7. Files

- Modify: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/master-data.ts`, `src/lib/master-data-db.ts`, `src/app/(portal)/projects/actions.ts`, `src/app/(portal)/projects/page.tsx`, `src/app/(portal)/projects/project-form.tsx`, `CLAUDE.md`.
- Create: `src/lib/projects.ts`, `tests/projects-lib.test.ts`.
- Extend tests: `tests/project-actions.test.ts`, `tests/master-data-db.test.ts`.

## Out of scope (v1)

- Capacity / over-allocation warnings (sum of hours per member across projects).
- Per-allocation date ranges or effort percentages.
- Auto-suggesting members by skill from the Skill Matrix.
- Showing a member's allocations on their profile page.
