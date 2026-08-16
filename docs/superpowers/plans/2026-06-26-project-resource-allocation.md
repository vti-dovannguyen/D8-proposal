# Project Resource Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resource-allocation section to the create/edit Project screen — requirement slots of member (optional) · project role · skill (optional) · hours/day — backed by a new `ProjectAllocation` model and a managed Project Role category, with the screen restructured into a full-width editor above a full-width project list.

**Architecture:** A new `ProjectAllocation` model relates Project↔User/Skill with `role` + `hoursPerDay`. Project roles become a new `PROJECT_ROLE` master-data category (auto-managed on the Danh mục screen). A pure `normalizeAllocations` helper validates/cleans form rows; the existing `createProject`/`updateProject` actions persist allocations as nested writes (create / deleteMany+create). The project form is restructured to full width with a row-editor.

**Tech Stack:** Next.js 16.2 (App Router, RSC + Server Actions), Prisma 7 (client at `src/generated/prisma`), Tailwind v4, Vitest.

## Global Constraints

- UI text is Vietnamese; match existing copy tone.
- Access unchanged: `project:manage` (MANAGERS) guards the actions; the page already redirects non-managers.
- Allocation row: `member` optional, `role` required (a Project Role value), `skill` optional, `hoursPerDay` Float in 0–24 (decimals allowed).
- `role` source = master-data `PROJECT_ROLE`; `skill` source = `Skill` catalog (FK).
- No secrets to the client (existing `accessKey` pattern unchanged).
- Prisma client is generated to `src/generated/prisma`; `npm run build` runs `prisma generate`. `UserSkill`-style nested writes use Prisma relation syntax.
- Run `npx tsc --noEmit` and the relevant `npx vitest run` green before each commit. Conventional Commits; end messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Tests use the `server-only` stub configured in `vitest.config.ts`.

---

## File Structure

**Create:** `src/lib/projects.ts` (normalizeAllocations), `tests/projects-lib.test.ts`, `tests/project-actions.test.ts`.
**Modify:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/master-data.ts`, `src/lib/master-data-db.ts`, `tests/master-data-db.test.ts`, `src/app/(portal)/projects/actions.ts`, `src/app/(portal)/projects/page.tsx`, `src/app/(portal)/projects/project-form.tsx`, `CLAUDE.md`.

---

## Task 1: `ProjectAllocation` model + migration

**Files:** Modify `prisma/schema.prisma`.

**Interfaces:**
- Produces: model `ProjectAllocation { projectId, userId?, role, skillId?, hoursPerDay }`; relations `Project.allocations`, `User.allocations`, `Skill.allocations`.

- [ ] **Step 1: Add the model** — append to `prisma/schema.prisma`:

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

- [ ] **Step 2: Add the relation fields** — add `allocations ProjectAllocation[]` to three existing models:
  - In `model Project { ... }`, add a line: `  allocations ProjectAllocation[]`
  - In `model User { ... }` (next to `userSkills`/`certificates`), add: `  allocations    ProjectAllocation[]`
  - In `model Skill { ... }` (next to `userSkills`), add: `  allocations ProjectAllocation[]`

- [ ] **Step 3: Migrate + regenerate**

Run: `npm run db:migrate -- --name project_allocation`
Expected: a new folder under `prisma/migrations/` and the client regenerated. (If the DB is unreachable: `npx prisma migrate dev --name project_allocation --create-only` then `npx prisma generate`, and note it must be applied before runtime.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ProjectAllocation model"
```

---

## Task 2: Project Role master-data category

**Files:** Modify `src/lib/master-data.ts`, `src/lib/master-data-db.ts`, `prisma/seed.ts`; Test `tests/master-data-db.test.ts`.

**Interfaces:**
- Produces: `PROJECT_ROLES` (master-data.ts); `"PROJECT_ROLE"` added to `CATEGORY_TYPES`, `CATEGORY_LABELS`, `CATEGORY_FALLBACK` (master-data-db.ts). `getCategoryValues("PROJECT_ROLE")` returns DB rows or the constant.

- [ ] **Step 1: Add the failing test** — append to `tests/master-data-db.test.ts` inside the `describe("getCategoryValues", ...)` block:

```ts
  it("falls back to PROJECT_ROLES for the PROJECT_ROLE type", async () => {
    findManyMock.mockResolvedValue([]);
    const { PROJECT_ROLES } = await import("@/lib/master-data");
    expect(await getCategoryValues("PROJECT_ROLE")).toEqual([...PROJECT_ROLES]);
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/master-data-db.test.ts`
Expected: FAIL (type `"PROJECT_ROLE"` not assignable / `PROJECT_ROLES` undefined).

- [ ] **Step 3: Add the constant** — in `src/lib/master-data.ts` add after `TOPIC_CATEGORIES`:

```ts
export const PROJECT_ROLES = ["Developer", "BrSE", "Tester", "QA", "BA", "PM", "Comtor", "Designer"] as const;
```

- [ ] **Step 4: Register the category type** — in `src/lib/master-data-db.ts`:
  - Add `PROJECT_ROLES` to the import from `@/lib/master-data`.
  - Add `"PROJECT_ROLE"` to the `CATEGORY_TYPES` array (append after `"WIKI"`).
  - Add to `CATEGORY_LABELS`: `PROJECT_ROLE: "Vai trò dự án",`
  - Add to `CATEGORY_FALLBACK`: `PROJECT_ROLE: PROJECT_ROLES,`

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/master-data-db.test.ts`
Expected: PASS.

- [ ] **Step 6: Seed the values** — in `prisma/seed.ts`:
  - Add `PROJECT_ROLES` to the existing import from `../src/lib/master-data`.
  - Add `["PROJECT_ROLE", PROJECT_ROLES]` to the `CATEGORY_SEED` array.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add src/lib/master-data.ts src/lib/master-data-db.ts prisma/seed.ts tests/master-data-db.test.ts
git commit -m "feat: add PROJECT_ROLE managed category"
```

---

## Task 3: `normalizeAllocations` helper

**Files:** Create `src/lib/projects.ts`; Test `tests/projects-lib.test.ts`.

**Interfaces:**
- Produces:
  - `type AllocationInput = { userId: string; role: string; skillId: string; hoursPerDay: number }`
  - `type AllocationData = { userId: string | null; role: string; skillId: string | null; hoursPerDay: number }`
  - `normalizeAllocations(rows: AllocationInput[]): AllocationData[]`

- [ ] **Step 1: Write the failing test** — create `tests/projects-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeAllocations, type AllocationInput } from "@/lib/projects";

const row = (o: Partial<AllocationInput>): AllocationInput => ({ userId: "", role: "", skillId: "", hoursPerDay: 8, ...o });

describe("normalizeAllocations", () => {
  it("drops fully-empty rows", () => {
    expect(normalizeAllocations([row({})])).toEqual([]);
  });
  it("throws when a non-empty row lacks a role", () => {
    expect(() => normalizeAllocations([row({ userId: "u1" })])).toThrow(/vai trò/i);
  });
  it("rejects hours outside 0..24 or NaN", () => {
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: 25 })])).toThrow(/giờ/i);
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: -1 })])).toThrow(/giờ/i);
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: NaN })])).toThrow(/giờ/i);
  });
  it("maps empty userId/skillId to null and keeps valid rows", () => {
    const out = normalizeAllocations([
      row({ role: "Developer", userId: "u1", skillId: "s1", hoursPerDay: 4.5 }),
      row({ role: "Tester", userId: "", skillId: "", hoursPerDay: 8 }),
    ]);
    expect(out).toEqual([
      { userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 4.5 },
      { userId: null, role: "Tester", skillId: null, hoursPerDay: 8 },
    ]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/projects-lib.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/lib/projects.ts`:

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

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/projects-lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects.ts tests/projects-lib.test.ts
git commit -m "feat: add normalizeAllocations helper"
```

---

## Task 4: Persist allocations in the project actions

**Files:** Modify `src/app/(portal)/projects/actions.ts`; Test `tests/project-actions.test.ts` (new).

**Interfaces:**
- Consumes: `normalizeAllocations`, `AllocationInput` from `@/lib/projects`.
- Produces: `ProjectFormData` now includes `allocations: AllocationInput[]`; `createProject`/`updateProject` persist them.

- [ ] **Step 1: Write the failing test** — create `tests/project-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { project: {
  create: (...a: unknown[]) => createMock(...a),
  update: (...a: unknown[]) => updateMock(...a),
} } }));

import { createProject, updateProject, type ProjectFormData } from "../src/app/(portal)/projects/actions";

const base: ProjectFormData = {
  name: "P1", code: "", category: "Delivery", section: "D8.1", active: true, description: "",
  repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "",
  allocations: [{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8 }],
};

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); });

describe("project actions allocations", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(createProject(base)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("createProject nests normalized allocations", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await createProject(base);
    const data = createMock.mock.calls[0][0].data as { allocations: { create: unknown[] } };
    expect(data.allocations.create).toEqual([{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8 }]);
  });
  it("updateProject replaces allocations with deleteMany + create", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProject("p1", base);
    const data = updateMock.mock.calls[0][0].data as { allocations: { deleteMany: unknown; create: unknown[] } };
    expect(data.allocations.deleteMany).toEqual({});
    expect(data.allocations.create).toEqual([{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8 }]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/project-actions.test.ts`
Expected: FAIL (`allocations` missing on `ProjectFormData` / not nested).

- [ ] **Step 3: Wire allocations into the actions** — in `src/app/(portal)/projects/actions.ts`:
  - Add the import at the top: `import { normalizeAllocations, type AllocationInput } from "@/lib/projects";`
  - Add `allocations: AllocationInput[];` to the `ProjectFormData` type.
  - In `createProject`, change the create call to include allocations:

```ts
  await db.project.create({
    data: { ...clean(form), accessKey: accessKey || null, allocations: { create: normalizeAllocations(form.allocations ?? []) } },
  });
```

  - In `updateProject`, change the update `data` to include allocations:

```ts
    data: {
      ...clean(form),
      ...(accessKey ? { accessKey } : {}),
      allocations: { deleteMany: {}, create: normalizeAllocations(form.allocations ?? []) },
    },
```

- [ ] **Step 3b: Keep tsc green with a one-line stopgap** — adding `allocations` to `ProjectFormData` makes the current `project-form.tsx` `EMPTY` constant incomplete. In `src/app/(portal)/projects/project-form.tsx`, add `allocations: []` to the `EMPTY` object literal (the form is fully rewritten in Task 5; this is a temporary keep-it-compiling edit):

```ts
const EMPTY: ProjectFormData = {
  name: "",
  code: "",
  category: "",
  section: "",
  active: true,
  description: "",
  repoProvider: "",
  repoUrl: "",
  pmTool: "",
  pmUrl: "",
  accessKey: "",
  allocations: [],
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/project-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add "src/app/(portal)/projects/actions.ts" "src/app/(portal)/projects/project-form.tsx" tests/project-actions.test.ts
git commit -m "feat: persist project allocations in create/update actions"
```

---

## Task 5: Full-width editor + resource-allocation row editor

**Files:** Modify `src/app/(portal)/projects/page.tsx`, `src/app/(portal)/projects/project-form.tsx`.

**Interfaces:**
- Consumes: `ProjectFormData` (now with `allocations`), `AllocationInput` from `@/lib/projects`, `getCategoryValues`/`getCategoryMap`.
- Produces: restructured screen. `ProjectForm` props gain `users: {id,name}[]`, `skills: {id,name}[]`, `roles: string[]`; `ProjectRow` gains `allocations` + `allocationCount`.

- [ ] **Step 1: Update the page to fetch allocations/users/skills/roles** — replace the body of `src/app/(portal)/projects/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getCategoryMap, getCategoryValues } from "@/lib/master-data-db";
import { ProjectForm } from "./project-form";
import { createProject, updateProject, deleteProject, type ProjectFormData } from "./actions";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "project:manage")) redirect("/");

  const [projects, users, skills, { PROJECT: categories, MEETING_SECTION: sections }, roles] = await Promise.all([
    db.project.findMany({
      orderBy: [{ active: "desc" }, { section: "asc" }, { name: "asc" }],
      include: { allocations: { include: { user: { select: { id: true, name: true } }, skill: { select: { id: true, name: true } } } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCategoryMap(["PROJECT", "MEETING_SECTION"]),
    getCategoryValues("PROJECT_ROLE"),
  ]);

  const rows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? "",
    category: p.category,
    section: p.section,
    active: p.active,
    description: p.description ?? "",
    repoProvider: p.repoProvider ?? "",
    repoUrl: p.repoUrl ?? "",
    pmTool: p.pmTool ?? "",
    pmUrl: p.pmUrl ?? "",
    hasAccessKey: !!p.accessKey,
    allocationCount: p.allocations.length,
    allocations: p.allocations.map((a) => ({ userId: a.userId, role: a.role, skillId: a.skillId, hoursPerDay: a.hoursPerDay })),
  }));

  async function createAction(data: ProjectFormData) { "use server"; await createProject(data); }
  async function updateAction(id: string, data: ProjectFormData) { "use server"; await updateProject(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteProject(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Project Management</h1>
          <p className="portal-page-subtitle">Quản lý dự án và phân bổ nguồn lực (member, vai trò, skill, giờ/ngày).</p>
        </div>
        <span className="text-sm text-slate-500">{rows.length} project</span>
      </div>
      <ProjectForm
        projects={rows}
        categories={categories}
        sections={sections}
        users={users}
        skills={skills}
        roles={roles}
        onCreate={createAction}
        onUpdate={updateAction}
        onDelete={deleteAction}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the form** — replace the entire contents of `src/app/(portal)/projects/project-form.tsx` with:

```tsx
"use client";
import { useState, useTransition } from "react";
import { REPO_PROVIDERS, PM_TOOLS } from "@/lib/master-data";
import type { ProjectFormData } from "./actions";
import type { AllocationInput } from "@/lib/projects";

type Person = { id: string; name: string };
type SkillOpt = { id: string; name: string };
type AllocRow = { userId: string | null; role: string; skillId: string | null; hoursPerDay: number };
type ProjectRow = Omit<ProjectFormData, "accessKey" | "allocations"> & {
  id: string;
  hasAccessKey: boolean;
  allocationCount: number;
  allocations: AllocRow[];
};

const EMPTY: ProjectFormData = {
  name: "", code: "", category: "", section: "", active: true, description: "",
  repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "", allocations: [],
};

const REPO_LABELS: Record<string, string> = { github: "GitHub", gitlab: "GitLab" };
const PM_LABELS: Record<string, string> = { redmine: "Redmine", backlog: "Backlog" };
const PAGE_SIZE = 10;

export function ProjectForm({
  projects, categories, sections, users, skills, roles, onCreate, onUpdate, onDelete,
}: {
  projects: ProjectRow[];
  categories: string[];
  sections: string[];
  users: Person[];
  skills: SkillOpt[];
  roles: string[];
  onCreate: (data: ProjectFormData) => Promise<void>;
  onUpdate: (id: string, data: ProjectFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const emptyForm: ProjectFormData = { ...EMPTY, category: categories[0] ?? "", section: sections[1] ?? sections[0] ?? "" };
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasKey, setEditingHasKey] = useState(false);
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const visibleProjects = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const set = <K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) => setForm((f) => ({ ...f, [key]: value }));

  const setAlloc = <K extends keyof AllocationInput>(i: number, key: K, value: AllocationInput[K]) =>
    setForm((f) => {
      const next = f.allocations.slice();
      next[i] = { ...next[i], [key]: value };
      return { ...f, allocations: next };
    });
  const addAlloc = () => setForm((f) => ({ ...f, allocations: [...f.allocations, { userId: "", role: roles[0] ?? "", skillId: "", hoursPerDay: 8 }] }));
  const removeAlloc = (i: number) => setForm((f) => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) }));

  function edit(project: ProjectRow) {
    setEditingId(project.id);
    setEditingHasKey(project.hasAccessKey);
    setForm({
      name: project.name, code: project.code, category: project.category, section: project.section,
      active: project.active, description: project.description, repoProvider: project.repoProvider,
      repoUrl: project.repoUrl, pmTool: project.pmTool, pmUrl: project.pmUrl, accessKey: "",
      allocations: project.allocations.map((a) => ({ userId: a.userId ?? "", role: a.role, skillId: a.skillId ?? "", hoursPerDay: a.hoursPerDay })),
    });
  }

  function reset() {
    setEditingId(null);
    setEditingHasKey(false);
    setForm(emptyForm);
  }

  const inputCls = "mt-1 w-full rounded border px-2 py-1";

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (editingId) await onUpdate(editingId, form);
            else await onCreate(form);
            reset();
          });
        }}
        className="space-y-4 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-5 shadow-[var(--sh-1)]"
      >
        <h2 className="text-sm font-semibold text-slate-950">{editingId ? "Sửa dự án" : "Tạo dự án"}</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">Project name<input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="block text-sm">Code<input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} /></label>
          <label className="block text-sm">Category
            <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-sm">Section
            <select className={inputCls} value={form.section} onChange={(e) => set("section", e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-sm">Description<textarea rows={2} className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>

        <fieldset className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Source code & quản lý dự án</legend>
          <label className="block text-sm">Source code
            <select className={inputCls} value={form.repoProvider} onChange={(e) => set("repoProvider", e.target.value)}>
              <option value="">—</option>
              {REPO_PROVIDERS.map((p) => <option key={p} value={p}>{REPO_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-1 lg:col-span-2">Repository URL
            <input type="url" placeholder="https://github.com/org/repo" className={inputCls} value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} />
          </label>
          <label className="block text-sm">Quản lý dự án
            <select className={inputCls} value={form.pmTool} onChange={(e) => set("pmTool", e.target.value)}>
              <option value="">—</option>
              {PM_TOOLS.map((t) => <option key={t} value={t}>{PM_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-1 lg:col-span-2">Link dự án
            <input type="url" placeholder="https://redmine.example.com/projects/abc" className={inputCls} value={form.pmUrl} onChange={(e) => set("pmUrl", e.target.value)} />
          </label>
          <label className="block text-sm lg:col-span-3">Access key (AI MCP health check)
            <input type="password" autoComplete="off" placeholder={editingHasKey ? "•••••••• (đã có — để trống nếu giữ nguyên)" : "Nhập access key / token"} className={inputCls} value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} />
          </label>
        </fieldset>

        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Phân bổ nguồn lực</h3>
            <button type="button" onClick={addAlloc} className="text-sm text-[var(--vti-deep,#0A3CA8)]">+ Thêm dòng</button>
          </div>
          <div className="portal-table-card shadow-none">
            <table className="portal-table min-w-[720px]">
              <thead><tr><th>Member</th><th>Vai trò</th><th>Skill</th><th>Giờ/ngày</th><th></th></tr></thead>
              <tbody>
                {form.allocations.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.userId} onChange={(e) => setAlloc(i, "userId", e.target.value)}>
                        <option value="">— Chưa gán —</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.role} onChange={(e) => setAlloc(i, "role", e.target.value)}>
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.skillId} onChange={(e) => setAlloc(i, "skillId", e.target.value)}>
                        <option value="">— Không —</option>
                        {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" step="0.5" min="0" max="24" className="w-20 rounded border px-1 py-0.5" value={a.hoursPerDay} onChange={(e) => setAlloc(i, "hoursPerDay", Number(e.target.value))} />
                    </td>
                    <td><button type="button" className="text-xs font-semibold text-red-500" onClick={() => removeAlloc(i)}>Xóa</button></td>
                  </tr>
                ))}
                {form.allocations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-400">Chưa có dòng phân bổ nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            Active
          </label>
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm">Hủy</button>}
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo"}
            </button>
          </div>
        </div>
      </form>

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th className="px-4 py-2">Project</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Section</th><th className="px-4 py-2">Nguồn lực</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {visibleProjects.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td>
                  <div className="font-semibold text-slate-950">{p.name}</div>
                  <div className="portal-table-muted">{p.code || "No code"}</div>
                  {(p.repoUrl || p.pmUrl || p.hasAccessKey) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{REPO_LABELS[p.repoProvider] ?? "Repo"} ↗</a>}
                      {p.pmUrl && <a href={p.pmUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{PM_LABELS[p.pmTool] ?? "PM"} ↗</a>}
                      {p.hasAccessKey && <span className="portal-pill bg-amber-50 text-amber-700">🔑 key</span>}
                    </div>
                  )}
                </td>
                <td><span className="portal-pill bg-blue-50 text-blue-700">{p.category}</span></td>
                <td><span className="portal-pill bg-slate-100 text-slate-600">{p.section}</span></td>
                <td><span className="portal-pill bg-violet-50 text-violet-700">{p.allocationCount} nguồn lực</span></td>
                <td><span className={"portal-pill " + (p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{p.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right">
                  <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => edit(p)}>Edit</button>
                  <button type="button" className="text-red-600" onClick={() => start(() => onDelete(p.id))}>Delete</button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No projects yet</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-[#dbe3ef] px-4 py-3 text-sm text-slate-600">
          <span>Hiển thị {projects.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(projects.length, page * PAGE_SIZE)} / {projects.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Trước</button>
            <span className="font-semibold text-slate-900">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Sau</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Build to verify the route compiles**

Run: `npm run build`
Expected: succeeds; route list includes `ƒ /projects`.

- [ ] **Step 5: Run the full unit suite**

Run: `npx vitest run`
Expected: all PASS (existing project/category/master-data tests included).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(portal)/projects/page.tsx" "src/app/(portal)/projects/project-form.tsx"
git commit -m "feat: full-width project editor with resource allocation row editor"
```

---

## Task 6: Docs

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update the system map** — in `CLAUDE.md`:
  - Under the Data model **Meetings** bullet (which lists `Project`), append to the `Project` description: `; resource allocation via **`ProjectAllocation`** (member optional, project `role`, optional `skill`, `hoursPerDay`).`
  - Under `src/lib` reference, add: `- **projects.ts** — `normalizeAllocations(rows)`: validates/cleans project resource-allocation rows (role required, hours 0–24, empty member/skill → null).`
  - Under the `master-data-db.ts` line, note the `PROJECT_ROLE` category type ("Vai trò dự án") was added.
  - Under Server actions **projects**, note `createProject`/`updateProject` now persist `ProjectAllocation` rows.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document project resource allocation"
```

---

## Self-Review

**Spec coverage:**
- `ProjectAllocation` model + relations + migration → Task 1. ✓
- `PROJECT_ROLE` managed category (constant, types, labels, fallback, seed, Danh mục auto-render) → Task 2. ✓
- `normalizeAllocations` helper (drop empty, role required, hours 0–24, null mapping) → Task 3. ✓
- Actions persist allocations (create / deleteMany+create), guard unchanged → Task 4. ✓
- Layout restructure (full-width editor + row editor + list below with count) → Task 5. ✓
- Tests: lib helper, actions, master-data PROJECT_ROLE → Tasks 2, 3, 4. ✓
- Docs → Task 6. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; no "similar to Task N".

**Type consistency:** `AllocationInput`/`AllocationData` defined in Task 3, consumed by Task 4 (`actions.ts`) and Task 5 (`project-form.tsx`); `ProjectFormData` gains `allocations: AllocationInput[]` in Task 4 and is used consistently in Task 5's `EMPTY`/`emptyForm`/`edit`. The page's `rows` map (Task 5) produces `allocations: AllocRow[]` (`userId/skillId` nullable) which `edit()` maps back to `AllocationInput` (empty-string for null) — matches `ProjectRow.allocations` type. `normalizeAllocations(form.allocations ?? [])` guards against undefined. `setAlloc` key/value typing matches `AllocationInput`. `getCategoryValues("PROJECT_ROLE")` is valid once Task 2 adds the type.

**Cross-task note for executor:** Task 4 adds `allocations` to `ProjectFormData`; its Step 3b adds a one-line `allocations: []` stopgap to the existing form so tsc stays green before Task 5 rewrites the form. The migration from Task 1 must be applied + the Prisma client regenerated before Tasks 4–5 typecheck (Task 5 uses `include: { allocations }` and nested allocation writes).
