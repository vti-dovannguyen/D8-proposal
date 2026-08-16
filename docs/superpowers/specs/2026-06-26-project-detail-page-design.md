# Project Detail Page — Design

**Date:** 2026-06-26
**Status:** Approved (design)
**Area:** D8 Portal — new `/projects/[id]` screen

## Goal

Clicking a project name in the projects list opens a detail page: a header with basic info, and a tabbed body with four tabs — Test environments (new model, CRUD), Git/Backlog/Redmine (inline edit), AI accounts (full CRUD scoped to the project), and Resource allocation (inline CRUD). Everyone can view; only Managers can edit.

## Decisions (locked)

- Route `/projects/[id]`; the project **name in the list links here** (the inline "Edit" button stays).
- **View for all** authenticated users; **edit for Managers** (`project:manage`). The page does not redirect non-managers; a `canEdit` flag gates all edit controls and every mutating action re-checks the capability server-side.
- **Test environment** model: `name`, `url`, `username`, `password` (write-only), `note`, `status` (ACTIVE/INACTIVE). `name` is a **datalist** input — suggestions `T4 / Dev / Staging / Production`, but free text allowed.
- All four tabs are **editable inline** (for Managers): env CRUD, git/PM inline edit, AI account full CRUD (reusing the existing AI Accounts feature), allocation inline CRUD.
- Built as **one spec in 4 phases** (page shell + Environments → Git/PM → Allocations → AI accounts).

## 1. Data model (`prisma/schema.prisma`)

```prisma
model ProjectEnvironment {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  url       String?
  username  String?
  password  String?  // write-only: never serialized to the client; empty-on-update = keep
  note      String?
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
}
```
+ `Project.environments ProjectEnvironment[]`. Migration `project_environment`.

`src/lib/master-data.ts`: `export const ENVIRONMENT_NAMES = ["T4", "Dev", "Staging", "Production"] as const;` (datalist suggestions only — not a managed category in v1).

## 2. Routing & access

- `projects/[id]/page.tsx` (server): `auth()` required (no manager redirect); `const canEdit = !!session?.user && can(session.user.role, "project:manage")`.
- In `project-form.tsx`, wrap the project name cell in `<Link href={\`/projects/${p.id}\`}>`.
- Every mutating action below starts with a `requireProjectManager()` guard (mirrors `projects/actions.ts`). The AI account actions keep their own `ai-account:manage` guard (also Managers).

## 3. Pure helper (`src/lib/projects.ts`)

Add a single-row validator and refactor the existing batch one to use it:
```ts
export function normalizeAllocation(r: AllocationInput): AllocationData | null {
  const role = r.role.trim(); const userId = r.userId.trim(); const skillId = r.skillId.trim();
  if (!role && !userId && !skillId) return null;
  if (!role) throw new Error("Validation: mỗi dòng phân bổ cần vai trò");
  const hours = Number(r.hoursPerDay);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error("Validation: giờ/ngày phải trong khoảng 0..24");
  return { userId: userId || null, role, skillId: skillId || null, hoursPerDay: hours };
}
export function normalizeAllocations(rows: AllocationInput[]): AllocationData[] {
  return rows.map(normalizeAllocation).filter((x): x is AllocationData => x !== null);
}
```

## 4. Server actions

**`projects/[id]/actions.ts`** (new) — each guards `project:manage`:
- `EnvironmentFormData = { name, url, username, password, note, status }`. `createEnvironment(projectId, form)`, `updateEnvironment(id, form)` (password: only overwrite when non-empty, like `accessKey`), `deleteEnvironment(id)`. `name` required.
- `addAllocation(projectId, input: AllocationInput)` (uses `normalizeAllocation`; throws if it returns null), `updateAllocation(id, input)`, `deleteAllocation(id)`.
- All `revalidatePath(\`/projects/${projectId}\`)`.

**`projects/actions.ts`** (extend): `updateProjectIntegration(projectId, { repoProvider, repoUrl, pmTool, pmUrl, accessKey })` — reuses the existing `cleanUrl` + `requireProjectManager`; `accessKey` only overwritten when non-empty; `revalidatePath(\`/projects/${projectId}\`)`.

**AI accounts**: reuse `createAIAccount` / `updateAIAccount` / `deleteAIAccount` from `ai-accounts/actions.ts` unchanged (they already accept `project` + `memberIds` and revalidate `/ai-accounts`). Since they don't revalidate the detail route, the AI tab calls `router.refresh()` after a successful mutation so the project's account list re-reads.

## 5. Page & components

**`projects/[id]/page.tsx`** fetches in parallel:
- project (incl. `environments`, `allocations` with `user`/`skill`),
- AI accounts `where: { project: project.name }` (incl. `members`),
- users (`id,name`), active skills (`id,name`), `getCategoryValues("PROJECT_ROLE")`.
Map env rows to `{ ...fields, hasPassword: !!password }` (drop `password`); map project integration to `{ ...fields, hasAccessKey }` (drop `accessKey`). Compute `canEdit`. Render `<ProjectDetailHeader>` + `<ProjectTabs ... canEdit=... />`.

**Components** (client, in `projects/[id]/`):
- `project-tabs.tsx` — tab bar + active-tab state; renders the four tab panels. Clean, accessible tab UI (`role="tab"`, `aria-selected`, keyboard left/right).
- `environments-tab.tsx` — table of environments; per-row inline edit + delete + an "add" row; `name` via `<input list>` + a shared `<datalist>` of `ENVIRONMENT_NAMES`; `password` field shows a "•••• (đã có)" placeholder when `hasPassword`. Read-only rendering when `!canEdit`.
- `integration-tab.tsx` — a compact form for repo/PM/accessKey with a Save button → `updateProjectIntegration`; read-only links when `!canEdit`.
- `allocations-tab.tsx` — list with per-row add/update/delete (member/role/skill/hours selects, reusing the `users`/`skills`/`roles` props); read-only when `!canEdit`.
- `ai-accounts-tab.tsx` — reuses `AIAccountForm` (project defaulted to this project's name) + a list of the project's accounts with edit/delete, mirroring `ai-accounts/page.tsx`; read-only list when `!canEdit`.

Edit controls everywhere are hidden/disabled when `!canEdit`.

## 6. Testing

- `tests/projects-lib.test.ts` (extend): `normalizeAllocation` — null for empty row, throws on missing role / bad hours, maps empties to null; `normalizeAllocations` still passes via the refactor.
- `tests/project-detail-actions.test.ts` (new): for `createEnvironment`/`updateEnvironment`/`deleteEnvironment`, `addAllocation`/`deleteAllocation`: a MEMBER is blocked (no write); `updateEnvironment` with empty password omits `password` from the update data (keep-existing); `createEnvironment` requires `name`.
- `tests/project-actions.test.ts` (extend): `updateProjectIntegration` blocks MEMBER; only sets `accessKey` when non-empty.
- UI verified via `tsc` + `npm run build`.

## 7. Files

- Modify: `prisma/schema.prisma`, `src/lib/master-data.ts`, `src/lib/projects.ts`, `src/app/(portal)/projects/actions.ts`, `src/app/(portal)/projects/project-form.tsx`, `CLAUDE.md`.
- Create: `src/app/(portal)/projects/[id]/page.tsx`, `actions.ts`, `project-detail-header.tsx`, `project-tabs.tsx`, `environments-tab.tsx`, `integration-tab.tsx`, `allocations-tab.tsx`, `ai-accounts-tab.tsx`.
- Tests: extend `tests/projects-lib.test.ts`, `tests/project-actions.test.ts`; create `tests/project-detail-actions.test.ts`.

## 8. Build phases

1. Model + migration + `normalizeAllocation` + detail page shell (header + tabs scaffold) + **Environments tab** (actions + UI).
2. **Git/PM** tab (`updateProjectIntegration` + UI) + list-name link.
3. **Allocations** tab (per-row actions + UI).
4. **AI accounts** tab (reuse AIAccountForm + actions).

## Out of scope (v1)

- Encrypting environment secrets beyond write-only storage.
- Making environment `name` a managed master-data category.
- Audit history / change log.
- Exposing the detail page from places other than the projects list.
