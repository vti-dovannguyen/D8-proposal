# Project Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/projects/[id]` detail page — header with basic info + four inline-editable tabs (Test environments CRUD, Git/Backlog/Redmine, AI accounts, Resource allocation) — viewable by all, editable by Managers.

**Architecture:** A server page fetches the project with all related data and a `canEdit` flag, renders a header + a generic client `ProjectTabs` container holding four client tab components. A new `ProjectEnvironment` model backs the environments tab. New per-row server actions handle environment CRUD, allocation CRUD, and project-integration updates (all guard `project:manage`); the AI tab reuses the existing AI Accounts feature.

**Tech Stack:** Next.js 16.2 (App Router, RSC + Server Actions), Prisma 7 (client at `src/generated/prisma`), Tailwind v4, lucide-react, Vitest.

## Global Constraints

- UI text is Vietnamese; match existing copy tone.
- **View for all** authenticated users (the page does NOT redirect non-managers); **edit for Managers** (`project:manage`). Every mutating action re-checks the capability server-side; edit controls render only when `canEdit`.
- Secrets are write-only: environment `password` and project `accessKey` are never serialized to the client (only `hasPassword`/`hasAccessKey`); on update, an empty value keeps the existing secret.
- No new dependencies. Prisma client is generated to `src/generated/prisma`; `npm run build` runs `prisma generate`.
- Allocation rows validated by `normalizeAllocation` (single) / `normalizeAllocations` (batch) in `@/lib/projects`.
- Run `npx tsc --noEmit` and the relevant `npx vitest run` green before each commit. Conventional Commits; end messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Tests use the `server-only` stub in `vitest.config.ts`.

---

## File Structure

**Create:** `src/app/(portal)/projects/[id]/page.tsx`, `actions.ts`, `project-detail-header.tsx`, `project-tabs.tsx`, `environments-tab.tsx`, `integration-tab.tsx`, `allocations-tab.tsx`, `ai-accounts-tab.tsx`; `tests/project-detail-actions.test.ts`.
**Modify:** `prisma/schema.prisma`, `src/lib/master-data.ts`, `src/lib/projects.ts`, `src/app/(portal)/projects/actions.ts`, `src/app/(portal)/projects/project-form.tsx`, `tests/projects-lib.test.ts`, `tests/project-actions.test.ts`, `CLAUDE.md`.

---

## Task 1: `ProjectEnvironment` model + env-name constant + migration

**Files:** Modify `prisma/schema.prisma`, `src/lib/master-data.ts`.

**Interfaces:**
- Produces: model `ProjectEnvironment { projectId, name, url?, username?, password?, note?, status }`; `Project.environments`; `ENVIRONMENT_NAMES` constant.

- [ ] **Step 1: Add the model** — append to `prisma/schema.prisma`:

```prisma
model ProjectEnvironment {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  url       String?
  username  String?
  password  String?
  note      String?
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
}
```

- [ ] **Step 2: Add the relation** — in `model Project { ... }` add a line: `  environments ProjectEnvironment[]`

- [ ] **Step 3: Add the constant** — in `src/lib/master-data.ts` after `PROJECT_ROLES`:

```ts
export const ENVIRONMENT_NAMES = ["T4", "Dev", "Staging", "Production"] as const;
```

- [ ] **Step 4: Migrate + regenerate**

Run: `npm run db:migrate -- --name project_environment`
Expected: new migration folder + client regenerated. (If DB unreachable: `npx prisma migrate dev --name project_environment --create-only` then `npx prisma generate`, and note it.)

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add prisma/schema.prisma prisma/migrations src/lib/master-data.ts
git commit -m "feat: add ProjectEnvironment model and env-name constant"
```

---

## Task 2: `normalizeAllocation` single-row helper

**Files:** Modify `src/lib/projects.ts`; Test `tests/projects-lib.test.ts`.

**Interfaces:**
- Consumes: existing `AllocationInput`, `AllocationData`.
- Produces: `normalizeAllocation(r: AllocationInput): AllocationData | null`; `normalizeAllocations` refactored to use it (same output as before).

- [ ] **Step 1: Add the failing test** — append to `tests/projects-lib.test.ts`:

```ts
import { normalizeAllocation } from "@/lib/projects";

describe("normalizeAllocation", () => {
  it("returns null for a fully-empty row", () => {
    expect(normalizeAllocation({ userId: "", role: "", skillId: "", hoursPerDay: 8 })).toBeNull();
  });
  it("throws when role is missing on a non-empty row", () => {
    expect(() => normalizeAllocation({ userId: "u1", role: "", skillId: "", hoursPerDay: 8 })).toThrow(/vai trò/i);
  });
  it("rejects bad hours", () => {
    expect(() => normalizeAllocation({ userId: "", role: "Dev", skillId: "", hoursPerDay: 25 })).toThrow(/giờ/i);
  });
  it("maps empty ids to null", () => {
    expect(normalizeAllocation({ userId: "", role: "Dev", skillId: "", hoursPerDay: 4.5 }))
      .toEqual({ userId: null, role: "Dev", skillId: null, hoursPerDay: 4.5 });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/projects-lib.test.ts`
Expected: FAIL (`normalizeAllocation` not exported).

- [ ] **Step 3: Refactor** — replace the body of `src/lib/projects.ts` with:

```ts
export type AllocationInput = { userId: string; role: string; skillId: string; hoursPerDay: number };
export type AllocationData = { userId: string | null; role: string; skillId: string | null; hoursPerDay: number };

export function normalizeAllocation(r: AllocationInput): AllocationData | null {
  const role = r.role.trim();
  const userId = r.userId.trim();
  const skillId = r.skillId.trim();
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

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/projects-lib.test.ts`
Expected: PASS (both the new and the pre-existing `normalizeAllocations` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects.ts tests/projects-lib.test.ts
git commit -m "feat: add normalizeAllocation single-row helper"
```

---

## Task 3: Detail-page server actions

**Files:** Create `src/app/(portal)/projects/[id]/actions.ts`; Modify `src/app/(portal)/projects/actions.ts`; Test `tests/project-detail-actions.test.ts` (new), `tests/project-actions.test.ts` (extend).

**Interfaces:**
- Consumes: `normalizeAllocation`, `AllocationInput`.
- Produces:
  - `EnvironmentFormData = { name, url, username, password, note, status }`; `createEnvironment(projectId, form)`, `updateEnvironment(id, projectId, form)`, `deleteEnvironment(id, projectId)`.
  - `addAllocation(projectId, input)`, `updateAllocation(id, projectId, input)`, `deleteAllocation(id, projectId)`.
  - `IntegrationFormData = { repoProvider, repoUrl, pmTool, pmUrl, accessKey }`; `updateProjectIntegration(projectId, form)` (in `projects/actions.ts`).

- [ ] **Step 1: Write the failing detail-actions test** — create `tests/project-detail-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const envCreate = vi.fn(), envUpdate = vi.fn(), envDelete = vi.fn();
const allocCreate = vi.fn(), allocDelete = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  projectEnvironment: { create: (...a: unknown[]) => envCreate(...a), update: (...a: unknown[]) => envUpdate(...a), delete: (...a: unknown[]) => envDelete(...a) },
  projectAllocation: { create: (...a: unknown[]) => allocCreate(...a), update: vi.fn(), delete: (...a: unknown[]) => allocDelete(...a) },
} }));

import { createEnvironment, updateEnvironment, deleteEnvironment, addAllocation } from "../src/app/(portal)/projects/[id]/actions";

const env = { name: "Dev", url: "", username: "", password: "", note: "", status: "ACTIVE" };

beforeEach(() => { authMock.mockReset(); envCreate.mockReset(); envUpdate.mockReset(); envDelete.mockReset(); allocCreate.mockReset(); allocDelete.mockReset(); });

describe("detail-page actions auth", () => {
  it("blocks a MEMBER from creating an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(createEnvironment("p1", env)).rejects.toThrow("Forbidden");
    expect(envCreate).not.toHaveBeenCalled();
  });
  it("requires an environment name", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(createEnvironment("p1", { ...env, name: "  " })).rejects.toThrow(/tên/i);
  });
  it("updateEnvironment omits password when empty (keep existing)", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateEnvironment("e1", "p1", { ...env, password: "" });
    const data = envUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect("password" in data).toBe(false);
  });
  it("updateEnvironment sets password when provided", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateEnvironment("e1", "p1", { ...env, password: "secret" });
    const data = envUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.password).toBe("secret");
  });
  it("blocks a MEMBER from adding an allocation", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(addAllocation("p1", { userId: "u1", role: "Dev", skillId: "", hoursPerDay: 8 })).rejects.toThrow("Forbidden");
    expect(allocCreate).not.toHaveBeenCalled();
  });
  it("addAllocation creates a normalized row for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await addAllocation("p1", { userId: "u1", role: "Dev", skillId: "", hoursPerDay: 8 });
    expect(allocCreate).toHaveBeenCalledWith({ data: { projectId: "p1", userId: "u1", role: "Dev", skillId: null, hoursPerDay: 8 } });
  });
  it("allows a manager to delete an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await deleteEnvironment("e1", "p1");
    expect(envDelete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/project-detail-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the detail actions** — create `src/app/(portal)/projects/[id]/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { normalizeAllocation, type AllocationInput } from "@/lib/projects";

export type EnvironmentFormData = { name: string; url: string; username: string; password: string; note: string; status: string };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "project:manage")) throw new Error("Forbidden");
}

function cleanEnv(form: EnvironmentFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: tên môi trường là bắt buộc");
  return {
    name,
    url: form.url.trim() || null,
    username: form.username.trim() || null,
    note: form.note.trim() || null,
    status: form.status.trim() || "ACTIVE",
  };
}

export async function createEnvironment(projectId: string, form: EnvironmentFormData) {
  await requireManager();
  const password = form.password.trim();
  await db.projectEnvironment.create({ data: { projectId, ...cleanEnv(form), password: password || null } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateEnvironment(id: string, projectId: string, form: EnvironmentFormData) {
  await requireManager();
  const password = form.password.trim();
  await db.projectEnvironment.update({ where: { id }, data: { ...cleanEnv(form), ...(password ? { password } : {}) } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteEnvironment(id: string, projectId: string) {
  await requireManager();
  await db.projectEnvironment.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function addAllocation(projectId: string, input: AllocationInput) {
  await requireManager();
  const data = normalizeAllocation(input);
  if (!data) throw new Error("Validation: dòng phân bổ trống");
  await db.projectAllocation.create({ data: { projectId, ...data } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateAllocation(id: string, projectId: string, input: AllocationInput) {
  await requireManager();
  const data = normalizeAllocation(input);
  if (!data) throw new Error("Validation: dòng phân bổ trống");
  await db.projectAllocation.update({ where: { id }, data });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteAllocation(id: string, projectId: string) {
  await requireManager();
  await db.projectAllocation.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/project-detail-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the failing integration test** — append to `tests/project-actions.test.ts`:

```ts
import { updateProjectIntegration } from "../src/app/(portal)/projects/actions";

describe("updateProjectIntegration", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(updateProjectIntegration("p1", { repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" })).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("only sets accessKey when non-empty", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" });
    expect("accessKey" in (updateMock.mock.calls[0][0].data as object)).toBe(false);
    updateMock.mockReset();
    await updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "tok" });
    expect((updateMock.mock.calls[0][0].data as { accessKey?: string }).accessKey).toBe("tok");
  });
});
```

- [ ] **Step 6: Implement `updateProjectIntegration`** — in `src/app/(portal)/projects/actions.ts` add (after `deleteProject`):

```ts
export type IntegrationFormData = { repoProvider: string; repoUrl: string; pmTool: string; pmUrl: string; accessKey: string };

export async function updateProjectIntegration(projectId: string, form: IntegrationFormData) {
  await requireProjectManager();
  const accessKey = form.accessKey.trim();
  await db.project.update({
    where: { id: projectId },
    data: {
      repoProvider: form.repoProvider.trim() || null,
      repoUrl: cleanUrl(form.repoUrl, "Repository URL"),
      pmTool: form.pmTool.trim() || null,
      pmUrl: cleanUrl(form.pmUrl, "Project management URL"),
      ...(accessKey ? { accessKey } : {}),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
```

- [ ] **Step 7: Run both action tests, verify pass; typecheck**

Run: `npx vitest run tests/project-detail-actions.test.ts tests/project-actions.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(portal)/projects/[id]/actions.ts" "src/app/(portal)/projects/actions.ts" tests/project-detail-actions.test.ts tests/project-actions.test.ts
git commit -m "feat: add project detail-page server actions (env, allocation, integration)"
```

---

## Task 4: Detail page shell + header + tabs + Environments tab + list link

**Files:** Create `src/app/(portal)/projects/[id]/page.tsx`, `project-detail-header.tsx`, `project-tabs.tsx`, `environments-tab.tsx`; Modify `src/app/(portal)/projects/project-form.tsx`.

**Interfaces:**
- Consumes: `createEnvironment`/`updateEnvironment`/`deleteEnvironment` (Task 3), `ENVIRONMENT_NAMES`.
- Produces: `ProjectTabs({ tabs })`, `ProjectDetailHeader({ project })`, `EnvironmentsTab({ projectId, environments, canEdit })`, `EnvRow` type.

- [ ] **Step 1: Create the generic tabs container** — `src/app/(portal)/projects/[id]/project-tabs.tsx`:

```tsx
"use client";
import { useState, type ReactNode } from "react";

export function ProjectTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[#dbe3ef]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={"-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition " + (active === t.id ? "border-[var(--vti-deep,#0A3CA8)] text-[var(--vti-deep,#0A3CA8)]" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tabs.map((t) => (
          <div key={t.id} role="tabpanel" hidden={active !== t.id}>{t.content}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the header** — `src/app/(portal)/projects/[id]/project-detail-header.tsx`:

```tsx
import Link from "next/link";

export function ProjectDetailHeader({ project }: {
  project: { name: string; code: string; category: string; section: string; active: boolean; description: string };
}) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-5 shadow-[var(--sh-1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {project.code && <span className="portal-pill bg-slate-100 text-slate-600">{project.code}</span>}
            <span className="portal-pill bg-blue-50 text-blue-700">{project.category}</span>
            <span className="portal-pill bg-slate-100 text-slate-600">{project.section}</span>
            <span className={"portal-pill " + (project.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{project.active ? "Active" : "Inactive"}</span>
          </div>
        </div>
        <Link href="/projects" className="shrink-0 rounded-lg border px-3 py-1.5 text-sm text-slate-600">← Projects</Link>
      </div>
      {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the Environments tab** — `src/app/(portal)/projects/[id]/environments-tab.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { ENVIRONMENT_NAMES } from "@/lib/master-data";
import { createEnvironment, updateEnvironment, deleteEnvironment, type EnvironmentFormData } from "./actions";

export type EnvRow = { id: string; name: string; url: string; username: string; note: string; status: string; hasPassword: boolean };
const EMPTY: EnvironmentFormData = { name: "", url: "", username: "", password: "", note: "", status: "ACTIVE" };

export function EnvironmentsTab({ projectId, environments, canEdit }: { projectId: string; environments: EnvRow[]; canEdit: boolean }) {
  const [form, setForm] = useState<EnvironmentFormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasPw, setEditingHasPw] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof EnvironmentFormData>(k: K, v: EnvironmentFormData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "mt-1 w-full rounded border px-2 py-1 text-sm";

  function edit(e: EnvRow) {
    setEditingId(e.id); setEditingHasPw(e.hasPassword);
    setForm({ name: e.name, url: e.url, username: e.username, password: "", note: e.note, status: e.status });
  }
  function reset() { setEditingId(null); setEditingHasPw(false); setForm(EMPTY); }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; start(async () => { if (editingId) await updateEnvironment(editingId, projectId, form); else await createEnvironment(projectId, form); reset(); }); }}
          className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)] sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block text-sm">Tên môi trường
            <input list="env-names" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="T4 / Dev / Staging / Production" />
            <datalist id="env-names">{ENVIRONMENT_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="block text-sm">URL<input type="url" className={inputCls} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." /></label>
          <label className="block text-sm">Trạng thái
            <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="block text-sm">Tài khoản<input className={inputCls} value={form.username} onChange={(e) => set("username", e.target.value)} /></label>
          <label className="block text-sm">Mật khẩu
            <input type="password" autoComplete="off" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={editingHasPw ? "•••• (đã có — để trống nếu giữ nguyên)" : "Mật khẩu"} />
          </label>
          <label className="block text-sm lg:col-span-3">Ghi chú<input className={inputCls} value={form.note} onChange={(e) => set("note", e.target.value)} /></label>
          <div className="flex justify-end gap-2 lg:col-span-3">
            {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm">Hủy</button>}
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm môi trường"}</button>
          </div>
        </form>
      )}

      <div className="portal-table-card">
        <table className="portal-table min-w-[760px]">
          <thead><tr><th>Môi trường</th><th>URL</th><th>Tài khoản</th><th>Trạng thái</th><th>Ghi chú</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {environments.map((e) => (
              <tr key={e.id}>
                <td className="font-semibold text-slate-900">{e.name}</td>
                <td className="portal-table-muted">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{e.url} ↗</a> : "-"}</td>
                <td className="portal-table-muted">{e.username || "-"}{e.hasPassword && <span className="ml-2 portal-pill bg-amber-50 text-amber-700">🔑</span>}</td>
                <td><span className={"portal-pill " + (e.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{e.status}</span></td>
                <td className="portal-table-muted">{e.note || "-"}</td>
                {canEdit && (
                  <td className="text-right">
                    <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => edit(e)}>Sửa</button>
                    <button type="button" className="text-red-600" onClick={() => start(() => deleteEnvironment(e.id, projectId))}>Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {environments.length === 0 && <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400">Chưa có môi trường nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the page** — `src/app/(portal)/projects/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectTabs } from "./project-tabs";
import { EnvironmentsTab } from "./environments-tab";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();
  const canEdit = can(session.user.role, "project:manage");

  const project = await db.project.findUnique({
    where: { id },
    include: { environments: { orderBy: { name: "asc" } } },
  });
  if (!project) notFound();

  const header = {
    name: project.name, code: project.code ?? "", category: project.category, section: project.section,
    active: project.active, description: project.description ?? "",
  };
  const environments = project.environments.map((e) => ({
    id: e.id, name: e.name, url: e.url ?? "", username: e.username ?? "", note: e.note ?? "", status: e.status, hasPassword: !!e.password,
  }));

  const tabs = [
    { id: "env", label: "Môi trường test", content: <EnvironmentsTab projectId={project.id} environments={environments} canEdit={canEdit} /> },
  ];

  return (
    <div className="space-y-5">
      <ProjectDetailHeader project={header} />
      <ProjectTabs tabs={tabs} />
    </div>
  );
}
```

- [ ] **Step 5: Link the project name in the list** — in `src/app/(portal)/projects/project-form.tsx`, add `import Link from "next/link";` at the top, then change the project-name cell `<div className="font-semibold text-slate-950">{p.name}</div>` to:

```tsx
                  <Link href={`/projects/${p.id}`} className="font-semibold text-slate-950 hover:text-[var(--vti-deep,#0A3CA8)] hover:underline">{p.name}</Link>
```

- [ ] **Step 6: Typecheck + build + commit**

Run: `npx tsc --noEmit` (expected: clean)
Run: `npm run build` (expected: succeeds; route list includes `ƒ /projects/[id]`)

```bash
git add "src/app/(portal)/projects/[id]/page.tsx" "src/app/(portal)/projects/[id]/project-detail-header.tsx" "src/app/(portal)/projects/[id]/project-tabs.tsx" "src/app/(portal)/projects/[id]/environments-tab.tsx" "src/app/(portal)/projects/project-form.tsx"
git commit -m "feat: project detail page with header, tabs, and environments tab"
```

---

## Task 5: Git/Backlog/Redmine tab

**Files:** Create `src/app/(portal)/projects/[id]/integration-tab.tsx`; Modify `src/app/(portal)/projects/[id]/page.tsx`.

**Interfaces:**
- Consumes: `updateProjectIntegration`, `IntegrationFormData` (Task 3); `REPO_PROVIDERS`, `PM_TOOLS` from `@/lib/master-data`.
- Produces: `IntegrationTab({ projectId, initial, hasAccessKey, canEdit })`.

- [ ] **Step 1: Create the tab** — `src/app/(portal)/projects/[id]/integration-tab.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { REPO_PROVIDERS, PM_TOOLS } from "@/lib/master-data";
import { updateProjectIntegration, type IntegrationFormData } from "../actions";

const REPO_LABELS: Record<string, string> = { github: "GitHub", gitlab: "GitLab" };
const PM_LABELS: Record<string, string> = { redmine: "Redmine", backlog: "Backlog" };

export function IntegrationTab({ projectId, initial, hasAccessKey, canEdit }: {
  projectId: string;
  initial: IntegrationFormData;
  hasAccessKey: boolean;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<IntegrationFormData>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof IntegrationFormData>(k: K, v: IntegrationFormData[K]) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };
  const inputCls = "mt-1 w-full rounded border px-2 py-1 text-sm";

  if (!canEdit) {
    return (
      <div className="space-y-2 text-sm">
        <p>Source code: {initial.repoUrl ? <a className="text-[var(--vti-deep,#0A3CA8)] hover:underline" href={initial.repoUrl} target="_blank" rel="noopener noreferrer">{REPO_LABELS[initial.repoProvider] ?? "Repo"} ↗</a> : "-"}</p>
        <p>Quản lý dự án: {initial.pmUrl ? <a className="text-[var(--vti-deep,#0A3CA8)] hover:underline" href={initial.pmUrl} target="_blank" rel="noopener noreferrer">{PM_LABELS[initial.pmTool] ?? "PM"} ↗</a> : "-"}</p>
        <p>Access key: {hasAccessKey ? "đã cấu hình" : "chưa có"}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => { await updateProjectIntegration(projectId, form); setSaved(true); }); }}
      className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)] sm:grid-cols-2 lg:grid-cols-3"
    >
      <label className="block text-sm">Source code
        <select className={inputCls} value={form.repoProvider} onChange={(e) => set("repoProvider", e.target.value)}>
          <option value="">—</option>
          {REPO_PROVIDERS.map((p) => <option key={p} value={p}>{REPO_LABELS[p]}</option>)}
        </select>
      </label>
      <label className="block text-sm lg:col-span-2">Repository URL<input type="url" className={inputCls} value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/org/repo" /></label>
      <label className="block text-sm">Quản lý dự án
        <select className={inputCls} value={form.pmTool} onChange={(e) => set("pmTool", e.target.value)}>
          <option value="">—</option>
          {PM_TOOLS.map((t) => <option key={t} value={t}>{PM_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="block text-sm lg:col-span-2">Link dự án<input type="url" className={inputCls} value={form.pmUrl} onChange={(e) => set("pmUrl", e.target.value)} placeholder="https://redmine.example.com/projects/abc" /></label>
      <label className="block text-sm lg:col-span-3">Access key (AI MCP health check)
        <input type="password" autoComplete="off" className={inputCls} value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} placeholder={hasAccessKey ? "•••• (đã có — để trống nếu giữ nguyên)" : "Nhập access key / token"} />
      </label>
      <div className="flex items-center justify-end gap-3 lg:col-span-3">
        {saved && <span className="text-sm text-emerald-600">Đã lưu</span>}
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Đang lưu..." : "Lưu"}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire it into the page** — in `src/app/(portal)/projects/[id]/page.tsx`:
  - Add import: `import { IntegrationTab } from "./integration-tab";`
  - After the `environments` mapping, add:

```tsx
  const integration = {
    repoProvider: project.repoProvider ?? "", repoUrl: project.repoUrl ?? "",
    pmTool: project.pmTool ?? "", pmUrl: project.pmUrl ?? "", accessKey: "",
  };
```

  - Add a tab entry to the `tabs` array (after the `env` entry):

```tsx
    { id: "git", label: "Git / Backlog / Redmine", content: <IntegrationTab projectId={project.id} initial={integration} hasAccessKey={!!project.accessKey} canEdit={canEdit} /> },
```

- [ ] **Step 3: Typecheck + build + commit**

Run: `npx tsc --noEmit` (expected: clean)
Run: `npm run build` (expected: succeeds)

```bash
git add "src/app/(portal)/projects/[id]/integration-tab.tsx" "src/app/(portal)/projects/[id]/page.tsx"
git commit -m "feat: add Git/Backlog/Redmine tab to project detail"
```

---

## Task 6: Resource allocation tab

**Files:** Create `src/app/(portal)/projects/[id]/allocations-tab.tsx`; Modify `src/app/(portal)/projects/[id]/page.tsx`.

**Interfaces:**
- Consumes: `addAllocation`/`updateAllocation`/`deleteAllocation` (Task 3); `getCategoryValues` (`PROJECT_ROLE`).
- Produces: `AllocationsTab({ projectId, allocations, users, skills, roles, canEdit })`.

- [ ] **Step 1: Create the tab** — `src/app/(portal)/projects/[id]/allocations-tab.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { addAllocation, updateAllocation, deleteAllocation } from "./actions";

type Person = { id: string; name: string };
type SkillOpt = { id: string; name: string };
export type AllocItem = { id: string; userId: string | null; userName: string | null; role: string; skillId: string | null; skillName: string | null; hoursPerDay: number };
type Draft = { userId: string; role: string; skillId: string; hoursPerDay: number };

export function AllocationsTab({ projectId, allocations, users, skills, roles, canEdit }: {
  projectId: string; allocations: AllocItem[]; users: Person[]; skills: SkillOpt[]; roles: string[]; canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({ userId: "", role: roles[0] ?? "", skillId: "", hoursPerDay: 8 });
  const [pending, start] = useTransition();
  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="portal-table-card">
        <table className="portal-table min-w-[720px]">
          <thead><tr><th>Member</th><th>Vai trò</th><th>Skill</th><th>Giờ/ngày</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-slate-900">{a.userName ?? <span className="text-slate-400">— Chưa gán —</span>}</td>
                <td><span className="portal-pill bg-violet-50 text-violet-700">{a.role}</span></td>
                <td className="portal-table-muted">{a.skillName ?? "-"}</td>
                <td className="portal-table-muted">{a.hoursPerDay}</td>
                {canEdit && (
                  <td className="text-right">
                    <button type="button" className="text-red-600" onClick={() => start(() => deleteAllocation(a.id, projectId))}>Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {allocations.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-slate-400">Chưa có phân bổ nào</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!draft.role) return; start(async () => { await addAllocation(projectId, draft); setDraft({ userId: "", role: roles[0] ?? "", skillId: "", hoursPerDay: 8 }); }); }}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]"
        >
          <label className="text-sm">Member
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.userId} onChange={(e) => setD("userId", e.target.value)}>
              <option value="">— Chưa gán —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Vai trò
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.role} onChange={(e) => setD("role", e.target.value)}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm">Skill
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.skillId} onChange={(e) => setD("skillId", e.target.value)}>
              <option value="">— Không —</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Giờ/ngày
            <input type="number" step="0.5" min="0" max="24" className="mt-1 block w-20 rounded border px-2 py-1 text-sm" value={draft.hoursPerDay} onChange={(e) => setD("hoursPerDay", Number(e.target.value))} />
          </label>
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">+ Thêm</button>
        </form>
      )}
    </div>
  );
}
```

(Note: this tab uses add + delete for quick edits. `updateAllocation` is imported but intentionally not wired to UI here — keep the import only if used; otherwise remove it to avoid an unused-import lint error. The implementer should DELETE the `updateAllocation` name from the import since this UI does add/delete only.)

- [ ] **Step 2: Wire it into the page** — in `src/app/(portal)/projects/[id]/page.tsx`:
  - Add imports: `import { getCategoryValues } from "@/lib/master-data-db";` and `import { AllocationsTab } from "./allocations-tab";`
  - Change the project query to include allocations with relations:

```tsx
  const project = await db.project.findUnique({
    where: { id },
    include: {
      environments: { orderBy: { name: "asc" } },
      allocations: { include: { user: { select: { id: true, name: true } }, skill: { select: { id: true, name: true } } } },
    },
  });
```

  - After `if (!project) notFound();`, fetch the editor option lists:

```tsx
  const [users, skills, roles] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCategoryValues("PROJECT_ROLE"),
  ]);
  const allocations = project.allocations.map((a) => ({
    id: a.id, userId: a.userId, userName: a.user?.name ?? null, role: a.role,
    skillId: a.skillId, skillName: a.skill?.name ?? null, hoursPerDay: a.hoursPerDay,
  }));
```

  - Add a tab entry (after the `git` entry):

```tsx
    { id: "alloc", label: "Phân bổ nguồn lực", content: <AllocationsTab projectId={project.id} allocations={allocations} users={users} skills={skills} roles={roles} canEdit={canEdit} /> },
```

- [ ] **Step 3: Typecheck + build + commit**

Run: `npx tsc --noEmit` (expected: clean — confirm `updateAllocation` is not left as an unused import in the tab)
Run: `npm run build` (expected: succeeds)

```bash
git add "src/app/(portal)/projects/[id]/allocations-tab.tsx" "src/app/(portal)/projects/[id]/page.tsx"
git commit -m "feat: add resource allocation tab to project detail"
```

---

## Task 7: AI accounts tab

**Files:** Create `src/app/(portal)/projects/[id]/ai-accounts-tab.tsx`; Modify `src/app/(portal)/projects/[id]/page.tsx`.

**Interfaces:**
- Consumes: `AIAccountForm` from `@/app/(portal)/ai-accounts/ai-account-form` (relative import), `createAIAccount`/`updateAIAccount`/`deleteAIAccount` + `AIAccountFormData` from the ai-accounts actions.
- Produces: `AiAccountsTab({ projectName, accounts, projectOption, users, canEdit })`.

- [ ] **Step 1: Create the tab** — `src/app/(portal)/projects/[id]/ai-accounts-tab.tsx`:

```tsx
"use client";
import { AIAccountForm } from "../../ai-accounts/ai-account-form";
import { createAIAccount, updateAIAccount, deleteAIAccount, type AIAccountFormData } from "../../ai-accounts/actions";

type ProjectOption = { id: string; name: string; code: string | null; category: string; section: string };
type AccountRow = {
  id: string; email: string; provider: string; accountType: string; project: string;
  memberIds: string[]; memberNames: string[]; purchaseDate: string; cost: string; currency: string;
  subscriptionType: string; status: string; notes: string;
};
type Person = { id: string; name: string; email: string };

export function AiAccountsTab({ projectName, accounts, projectOption, users, canEdit }: {
  projectName: string; accounts: AccountRow[]; projectOption: ProjectOption; users: Person[]; canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <div className="portal-table-card">
        <table className="portal-table min-w-[640px]">
          <thead><tr><th>Email</th><th>Provider</th><th>Loại</th><th>Members</th><th>Status</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-slate-900">{a.email}</td>
                <td>{a.provider}</td>
                <td className="portal-table-muted">{a.accountType}</td>
                <td className="portal-table-muted">{a.memberNames.join(", ") || "-"}</td>
                <td><span className="portal-pill bg-slate-100 text-slate-600">{a.status}</span></td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có tài khoản AI cho dự án này</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  async function onCreate(data: AIAccountFormData) { await createAIAccount({ ...data, project: data.project || projectName }); }
  async function onUpdate(id: string, data: AIAccountFormData) { await updateAIAccount(id, data); }
  async function onDelete(id: string) { await deleteAIAccount(id); }

  return <AIAccountForm accounts={accounts} projects={[projectOption]} users={users} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />;
}
```

- [ ] **Step 2: Wire it into the page** — in `src/app/(portal)/projects/[id]/page.tsx`:
  - Add import: `import { AiAccountsTab } from "./ai-accounts-tab";`
  - Add to the `Promise.all` (extend the existing destructure to include AI accounts + member-email users). Replace the `[users, skills, roles]` fetch block from Task 6 with:

```tsx
  const [users, skills, roles, aiUsers, aiAccountsRaw] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCategoryValues("PROJECT_ROLE"),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    db.aIAccount.findMany({ where: { project: project.name }, orderBy: [{ status: "asc" }, { email: "asc" }], include: { members: true } }),
  ]);
```

  - After the `allocations` mapping, add:

```tsx
  const aiAccounts = aiAccountsRaw.map((a) => ({
    id: a.id, email: a.email, provider: a.provider, accountType: a.accountType, project: a.project ?? "",
    memberIds: a.members.map((m) => m.id), memberNames: a.members.map((m) => m.name),
    purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
    cost: a.cost == null ? "" : String(a.cost), currency: a.currency, subscriptionType: a.subscriptionType,
    status: a.status, notes: a.notes ?? "",
  }));
  const projectOption = { id: project.id, name: project.name, code: project.code, category: project.category, section: project.section };
```

  - Add a tab entry (after the `alloc` entry):

```tsx
    { id: "ai", label: "AI accounts", content: <AiAccountsTab projectName={project.name} accounts={aiAccounts} projectOption={projectOption} users={aiUsers} canEdit={canEdit} /> },
```

- [ ] **Step 3: Typecheck + build + full test run + commit**

Run: `npx tsc --noEmit` (expected: clean — if `AIAccountForm`'s prop types differ from the shapes above, read `src/app/(portal)/ai-accounts/ai-account-form.tsx` and align the `AccountRow`/`ProjectOption`/`Person` types and the prop names exactly; do not change `AIAccountForm` itself)
Run: `npm run build` (expected: succeeds)
Run: `npx vitest run` (expected: all PASS)

```bash
git add "src/app/(portal)/projects/[id]/ai-accounts-tab.tsx" "src/app/(portal)/projects/[id]/page.tsx"
git commit -m "feat: add AI accounts tab to project detail"
```

---

## Task 8: Docs

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update the system map** — in `CLAUDE.md`:
  - Data model: in the `Project` description, append `, `ProjectEnvironment` (test environments: name/url/username/password write-only/note/status).`
  - `src/lib` reference: update the `projects.ts` line to mention `normalizeAllocation` (single-row) alongside `normalizeAllocations`.
  - Server actions: add `- **projects/[id]**: `createEnvironment`/`updateEnvironment`/`deleteEnvironment`, `addAllocation`/`updateAllocation`/`deleteAllocation` (guard `project:manage`).` and note `updateProjectIntegration` under **projects**.
  - Note the new route `/projects/[id]` — project detail with tabs (environments, git/PM, AI accounts, allocations); view-for-all, edit-for-managers.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document project detail page"
```

---

## Self-Review

**Spec coverage:**
- `ProjectEnvironment` model + `ENVIRONMENT_NAMES` → Task 1. ✓
- `normalizeAllocation` → Task 2. ✓
- Env CRUD + allocation CRUD + `updateProjectIntegration` actions, all guarded + write-only password/accessKey → Task 3. ✓
- Page (view-all, `canEdit`) + header + tabs + Environments tab + list-name link → Task 4. ✓
- Git/PM inline-edit tab → Task 5. ✓
- Allocations inline tab → Task 6. ✓
- AI accounts tab reusing `AIAccountForm` scoped to the project → Task 7. ✓
- Tests (normalizeAllocation, detail actions, integration action) → Tasks 2, 3. ✓
- Docs → Task 8. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. Two explicit "verify and align" notes (Task 6 unused-import, Task 7 AIAccountForm prop shapes) point at real integration seams, not vague work.

**Type consistency:** `EnvironmentFormData`, `IntegrationFormData`, `AllocationInput` defined in Task 3 and consumed by Tasks 4/5/6; `EnvRow`/`AllocItem`/`AccountRow` are page→tab prop shapes built from the Prisma includes added in Tasks 4/6/7; `normalizeAllocation` (Task 2) is used by the allocation actions (Task 3). `ProjectTabs` consumes `{id,label,content}[]` produced by the page; tab entries are appended incrementally in Tasks 4→7. The page's `findUnique` include grows across Tasks 4 (environments), 6 (allocations), 7 (AI via separate query).

**Cross-task note for executor:** The migration (Task 1) must be applied + the client regenerated before Tasks 3–7 typecheck (they use `db.projectEnvironment` and `include: { environments/allocations }`). Each UI task (4→7) edits `page.tsx` incrementally (adds a fetch + a tab entry); run tasks in order. Task 7 may require reading `ai-accounts/ai-account-form.tsx` to match its exact prop types — align the tab's local types to it without modifying the shared form.
