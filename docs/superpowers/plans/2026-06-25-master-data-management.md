# Master Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Managers-only "Master Data" nav group that manages DB-backed categories (read live by forms), a member skills catalog with per-member levels, and a certificate catalog with per-member records.

**Architecture:** New Prisma models (`MasterCategory`, `Skill`, `UserSkill`, `CertificateType`, `UserCertificate`). A new capability `master-data:manage` (= MANAGERS) gates a `/master-data/*` route area and sidebar group. A server helper `master-data-db.ts` reads category values from the DB with the existing constant lists as seed + fallback; feature forms receive category options as props from their server pages.

**Tech Stack:** Next.js 16.2 (App Router, RSC + Server Actions), Prisma 7 (`@prisma/adapter-pg`, client at `src/generated/prisma`), Tailwind v4, lucide-react, Vitest.

## Global Constraints

- UI text is Vietnamese; match existing copy tone.
- Roles: `ADMIN`, `DIVISION_LEADER`, `SECTION_MANAGER`, `PM`, `MEMBER`. MANAGERS = ADMIN/DIVISION_LEADER/SECTION_MANAGER.
- Prisma client is generated to `src/generated/prisma` — never hand-edit; run `npx prisma generate` after schema changes.
- Server actions live in feature `actions.ts` with `"use server"`; every mutating action must guard with `can(role, "master-data:manage")`.
- Secrets/tokens are never sent to the client (no relevant secret here, but keep the pattern).
- Run `npx tsc --noEmit` and `npx vitest run` green before each commit.
- Use Conventional Commits; end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Tests use the `server-only` stub already configured in `vitest.config.ts`.

---

## File Structure

**Create:**
- `prisma/migrations/<ts>_master_data/migration.sql` (via `prisma migrate dev`)
- `src/lib/master-data-db.ts` — category read helper (DB + constant fallback)
- `src/app/(portal)/master-data/categories/page.tsx` + `actions.ts` + `category-manager.tsx`
- `src/app/(portal)/master-data/skills/page.tsx` + `actions.ts` + `skill-manager.tsx`
- `src/app/(portal)/master-data/certificates/page.tsx` + `actions.ts` + `cert-type-manager.tsx`
- `src/app/(portal)/master-data/members/page.tsx`
- `src/app/(portal)/master-data/members/[id]/page.tsx` + `actions.ts` + `member-skills.tsx` + `member-certificates.tsx`
- Tests: `tests/master-data-db.test.ts`, `tests/master-data-category-actions.test.ts`, `tests/master-data-skill-actions.test.ts`, `tests/master-data-cert-actions.test.ts`, `tests/master-data-member-actions.test.ts`

**Modify:**
- `prisma/schema.prisma` — 5 models + `User` relations
- `prisma/seed.ts` — seed categories/skills/cert types
- `src/types/index.ts` — add capability
- `src/lib/permissions.ts` — add rule
- `src/lib/nav.ts` — add nav items
- `src/components/layout/sidebar.tsx` — add group
- `src/lib/master-data.ts` — add `TOPIC_CATEGORIES`, `MasterCategoryType`
- `tests/permissions.test.ts`, `tests/nav.test.ts` — extend
- Forms/pages: `meetings/meeting-form.tsx` (+ new/edit pages), `projects/project-form.tsx` (+ page), `knowledge/documents/document-upload-form.tsx` (+ page), `knowledge/wiki/wiki-form.tsx` (+ new/edit pages), `topics/topic-form.tsx` (+ topics page + new page), `admin/page.tsx`
- `CLAUDE.md` — system map

---

## Task 1: Prisma models, relations, migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: models `MasterCategory{type,value,order,active}`, `Skill{name,category,active}`, `UserSkill{userId,skillId,level}`, `CertificateType{name,issuer,category,active}`, `UserCertificate{userId,typeId,issuer,issuedAt,expiresAt,credentialId,fileUrl}`; `User.userSkills`, `User.certificates`.

- [ ] **Step 1: Add models to schema** — append to `prisma/schema.prisma`:

```prisma
model MasterCategory {
  id        String   @id @default(cuid())
  type      String
  value     String
  order     Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([type, value])
  @@index([type, active, order])
}

model Skill {
  id         String      @id @default(cuid())
  name       String      @unique
  category   String?
  active     Boolean     @default(true)
  userSkills UserSkill[]
  createdAt  DateTime    @default(now())
}

model UserSkill {
  id      String @id @default(cuid())
  userId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  skillId String
  skill   Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)
  level   Int    @default(1)

  @@unique([userId, skillId])
}

model CertificateType {
  id           String            @id @default(cuid())
  name         String            @unique
  issuer       String?
  category     String?
  active       Boolean           @default(true)
  certificates UserCertificate[]
  createdAt    DateTime          @default(now())
}

model UserCertificate {
  id           String          @id @default(cuid())
  userId       String
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  typeId       String
  type         CertificateType @relation(fields: [typeId], references: [id])
  issuer       String?
  issuedAt     DateTime?
  expiresAt    DateTime?
  credentialId String?
  fileUrl      String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([userId])
}
```

- [ ] **Step 2: Add relations to `User`** — in the `User` model add these two lines next to the other relations (after `aiAccounts`):

```prisma
  userSkills    UserSkill[]
  certificates  UserCertificate[]
```

- [ ] **Step 3: Create the migration and regenerate client**

Run: `npm run db:migrate -- --name master_data`
Expected: a new folder under `prisma/migrations/` and `src/generated/prisma` regenerated. (If no DB is reachable, run `npx prisma migrate dev --name master_data --create-only` then `npx prisma generate`, and note the migration must be applied before runtime.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "feat: add master data prisma models (categories, skills, certificates)"
```

---

## Task 2: Capability `master-data:manage`

**Files:**
- Modify: `src/types/index.ts`, `src/lib/permissions.ts`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Produces: `can(role, "master-data:manage")` → true for MANAGERS only.

- [ ] **Step 1: Add the failing test** — append inside the `describe("can()")` block in `tests/permissions.test.ts`:

```ts
  it("lets managers manage master data, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "master-data:manage")).toBe(true);
    expect(can("DIVISION_LEADER", "master-data:manage")).toBe(true);
    expect(can("ADMIN", "master-data:manage")).toBe(true);
    expect(can("PM", "master-data:manage")).toBe(false);
    expect(can("MEMBER", "master-data:manage")).toBe(false);
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/permissions.test.ts`
Expected: FAIL (type error / `master-data:manage` not in Capability).

- [ ] **Step 3: Add the capability** — in `src/types/index.ts` add to the `Capability` union:

```ts
  | "master-data:manage"
```

- [ ] **Step 4: Add the rule** — in `src/lib/permissions.ts` `RULES` object add:

```ts
  "master-data:manage": (r) => MANAGERS.includes(r),
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/permissions.ts tests/permissions.test.ts
git commit -m "feat: add master-data:manage capability for managers"
```

---

## Task 3: Master Data nav group

**Files:**
- Modify: `src/lib/nav.ts`, `src/components/layout/sidebar.tsx`
- Test: `tests/nav.test.ts`

**Interfaces:**
- Consumes: `MANAGER_ONLY` predicate (already in `nav.ts`).
- Produces: nav entries with hrefs `/master-data/categories`, `/master-data/skills`, `/master-data/certificates`, `/master-data/members`.

- [ ] **Step 1: Add the failing test** — append to `tests/nav.test.ts` inside `describe("navForRole()")`:

```ts
  it("shows Master Data to managers, hides from PM and Member", () => {
    const mgr = navForRole("SECTION_MANAGER").map((i) => i.href);
    expect(mgr).toContain("/master-data/categories");
    expect(mgr).toContain("/master-data/members");
    const pm = navForRole("PM").map((i) => i.href);
    expect(pm).not.toContain("/master-data/categories");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/master-data/skills");
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/nav.test.ts`
Expected: FAIL (hrefs not present).

- [ ] **Step 3: Add nav items** — in `src/lib/nav.ts`, insert before the `Administration` entry in `NAV_ITEMS`:

```ts
  { label: "Danh mục", href: "/master-data/categories", icon: "ListTree", visible: MANAGER_ONLY },
  { label: "Skills", href: "/master-data/skills", icon: "Sparkles", visible: MANAGER_ONLY },
  { label: "Chứng chỉ", href: "/master-data/certificates", icon: "Award", visible: MANAGER_ONLY },
  { label: "Hồ sơ thành viên", href: "/master-data/members", icon: "IdCard", visible: MANAGER_ONLY },
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the sidebar group** — in `src/components/layout/sidebar.tsx`, add icon imports `ListTree, Sparkles, Award, IdCard` to the lucide import block, then add a new group object to the `groups` array immediately before the `"Cá nhân"` group:

```tsx
  {
    title: "Master Data",
    items: [
      { label: "Danh mục", href: "/master-data/categories", icon: ListTree, visible: managerOnly },
      { label: "Skills", href: "/master-data/skills", icon: Sparkles, visible: managerOnly },
      { label: "Chứng chỉ", href: "/master-data/certificates", icon: Award, visible: managerOnly },
      { label: "Hồ sơ thành viên", href: "/master-data/members", icon: IdCard, visible: managerOnly },
    ],
  },
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add src/lib/nav.ts src/components/layout/sidebar.tsx tests/nav.test.ts
git commit -m "feat: add Master Data nav group for managers"
```

---

## Task 4: Category constants + DB read helper

**Files:**
- Modify: `src/lib/master-data.ts`
- Create: `src/lib/master-data-db.ts`
- Test: `tests/master-data-db.test.ts`

**Interfaces:**
- Produces:
  - `TOPIC_CATEGORIES` (in `master-data.ts`).
  - `CATEGORY_TYPES: readonly ["PROJECT","DOCUMENT","TOPIC","MEETING","MEETING_SECTION","WIKI"]`, `MasterCategoryType` type, `CATEGORY_FALLBACK: Record<MasterCategoryType, readonly string[]>`, `CATEGORY_LABELS: Record<MasterCategoryType,string>` (in `master-data-db.ts`).
  - `getCategoryValues(type: MasterCategoryType): Promise<string[]>` — DB rows (active, ordered by `order,value`) or the fallback constant when empty.
  - `getCategoryMap(types: MasterCategoryType[]): Promise<Record<MasterCategoryType,string[]>>`.

- [ ] **Step 1: Add `TOPIC_CATEGORIES` constant** — in `src/lib/master-data.ts` add after `DOCUMENT_CATEGORIES`:

```ts
export const TOPIC_CATEGORIES = ["Kỹ thuật", "Quản lý", "Quy trình", "Khách hàng", "Đề xuất", "Khác"] as const;
```

- [ ] **Step 2: Write the failing test** — create `tests/master-data-db.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/db", () => ({ db: { masterCategory: { findMany: (...a: unknown[]) => findManyMock(...a) } } }));

import { getCategoryValues } from "@/lib/master-data-db";
import { PROJECT_CATEGORIES } from "@/lib/master-data";

beforeEach(() => findManyMock.mockReset());

describe("getCategoryValues", () => {
  it("returns DB values when present", async () => {
    findManyMock.mockResolvedValue([{ value: "Alpha" }, { value: "Beta" }]);
    expect(await getCategoryValues("PROJECT")).toEqual(["Alpha", "Beta"]);
  });
  it("falls back to the constant list when the table is empty", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await getCategoryValues("PROJECT")).toEqual([...PROJECT_CATEGORIES]);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/master-data-db.test.ts`
Expected: FAIL (module `@/lib/master-data-db` not found).

- [ ] **Step 4: Implement the helper** — create `src/lib/master-data-db.ts`:

```ts
import "server-only";
import { db } from "@/lib/db";
import {
  PROJECT_CATEGORIES,
  DOCUMENT_CATEGORIES,
  TOPIC_CATEGORIES,
  MEETING_CATEGORIES,
  MEETING_SECTIONS,
  WIKI_CATEGORIES,
} from "@/lib/master-data";

export const CATEGORY_TYPES = ["PROJECT", "DOCUMENT", "TOPIC", "MEETING", "MEETING_SECTION", "WIKI"] as const;
export type MasterCategoryType = (typeof CATEGORY_TYPES)[number];

export const CATEGORY_LABELS: Record<MasterCategoryType, string> = {
  PROJECT: "Danh mục dự án",
  DOCUMENT: "Danh mục tài liệu",
  TOPIC: "Danh mục topic",
  MEETING: "Danh mục họp tuần",
  MEETING_SECTION: "Section",
  WIKI: "Danh mục wiki",
};

export const CATEGORY_FALLBACK: Record<MasterCategoryType, readonly string[]> = {
  PROJECT: PROJECT_CATEGORIES,
  DOCUMENT: DOCUMENT_CATEGORIES,
  TOPIC: TOPIC_CATEGORIES,
  MEETING: MEETING_CATEGORIES,
  MEETING_SECTION: MEETING_SECTIONS,
  WIKI: WIKI_CATEGORIES,
};

export async function getCategoryValues(type: MasterCategoryType): Promise<string[]> {
  const rows = await db.masterCategory.findMany({
    where: { type, active: true },
    orderBy: [{ order: "asc" }, { value: "asc" }],
    select: { value: true },
  });
  if (rows.length === 0) return [...CATEGORY_FALLBACK[type]];
  return rows.map((r) => r.value);
}

export async function getCategoryMap(
  types: MasterCategoryType[],
): Promise<Record<MasterCategoryType, string[]>> {
  const entries = await Promise.all(types.map(async (t) => [t, await getCategoryValues(t)] as const));
  return Object.fromEntries(entries) as Record<MasterCategoryType, string[]>;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/master-data-db.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/master-data.ts src/lib/master-data-db.ts tests/master-data-db.test.ts
git commit -m "feat: add category read helper with constant fallback"
```

---

## Task 5: Category management page + actions

**Files:**
- Create: `src/app/(portal)/master-data/categories/actions.ts`, `.../categories/page.tsx`, `.../categories/category-manager.tsx`
- Test: `tests/master-data-category-actions.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_TYPES`, `CATEGORY_LABELS`, `MasterCategoryType`.
- Produces: `CategoryFormData = { type: string; value: string; order: number; active: boolean }`; actions `createCategory(form)`, `updateCategory(id, form)`, `deleteCategory(id)`.

- [ ] **Step 1: Write the failing guard test** — create `tests/master-data-category-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { masterCategory: {
    create: (...a: unknown[]) => createMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
  } },
}));

import { createCategory, updateCategory, deleteCategory } from "../src/app/(portal)/master-data/categories/actions";

const form = { type: "PROJECT", value: "New", order: 0, active: true };

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); deleteMock.mockReset(); });

describe("category actions auth", () => {
  it("blocks a MEMBER from creating", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createCategory(form)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("blocks a PM from updating", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(updateCategory("c1", form)).rejects.toThrow("Forbidden");
  });
  it("allows a manager to create with a valid type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await createCategory(form);
    expect(createMock).toHaveBeenCalled();
  });
  it("rejects an unknown category type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createCategory({ ...form, type: "BOGUS" })).rejects.toThrow(/type/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/master-data-category-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions** — create `src/app/(portal)/master-data/categories/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CATEGORY_TYPES, type MasterCategoryType } from "@/lib/master-data-db";

export type CategoryFormData = { type: string; value: string; order: number; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: CategoryFormData) {
  if (!CATEGORY_TYPES.includes(form.type as MasterCategoryType)) throw new Error("Validation: unknown category type");
  const value = form.value.trim();
  if (!value) throw new Error("Validation: value is required");
  return { type: form.type, value, order: Number.isFinite(form.order) ? form.order : 0, active: form.active };
}

export async function createCategory(form: CategoryFormData) {
  await requireManager();
  await db.masterCategory.create({ data: clean(form) });
  revalidatePath("/master-data/categories");
}

export async function updateCategory(id: string, form: CategoryFormData) {
  await requireManager();
  await db.masterCategory.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/categories");
}

export async function deleteCategory(id: string) {
  await requireManager();
  await db.masterCategory.delete({ where: { id } });
  revalidatePath("/master-data/categories");
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/master-data-category-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the client manager component** — create `src/app/(portal)/master-data/categories/category-manager.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import type { CategoryFormData } from "./actions";

export type CategoryRow = { id: string; type: string; value: string; order: number; active: boolean };
type Group = { type: string; label: string; rows: CategoryRow[] };

export function CategoryManager({
  groups,
  onCreate,
  onUpdate,
  onDelete,
}: {
  groups: Group[];
  onCreate: (data: CategoryFormData) => Promise<void>;
  onUpdate: (id: string, data: CategoryFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.type} className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{g.label} <span className="text-slate-400">({g.type})</span></h2>
          <div className="flex flex-wrap gap-2">
            {g.rows.map((r) => (
              <span key={r.id} className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm " + (r.active ? "bg-slate-50" : "bg-slate-100 text-slate-400 line-through")}>
                {r.value}
                <button type="button" className="text-xs text-slate-500" title={r.active ? "Ẩn" : "Hiện"} onClick={() => start(() => onUpdate(r.id, { type: r.type, value: r.value, order: r.order, active: !r.active }))}>{r.active ? "ẩn" : "hiện"}</button>
                <button type="button" className="text-xs text-red-500" onClick={() => start(() => onDelete(r.id))}>xóa</button>
              </span>
            ))}
            {g.rows.length === 0 && <span className="text-sm text-slate-400">Chưa có mục nào</span>}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = (draft[g.type] ?? "").trim();
              if (!value) return;
              start(async () => {
                await onCreate({ type: g.type, value, order: g.rows.length, active: true });
                setDraft((d) => ({ ...d, [g.type]: "" }));
              });
            }}
          >
            <input className="rounded border px-2 py-1 text-sm" placeholder="Thêm giá trị mới…" value={draft[g.type] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [g.type]: e.target.value }))} />
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm</button>
          </form>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create the page** — create `src/app/(portal)/master-data/categories/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CATEGORY_TYPES, CATEGORY_LABELS } from "@/lib/master-data-db";
import { CategoryManager } from "./category-manager";
import { createCategory, updateCategory, deleteCategory, type CategoryFormData } from "./actions";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const all = await db.masterCategory.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }, { value: "asc" }] });
  const groups = CATEGORY_TYPES.map((type) => ({
    type,
    label: CATEGORY_LABELS[type],
    rows: all.filter((r) => r.type === type).map((r) => ({ id: r.id, type: r.type, value: r.value, order: r.order, active: r.active })),
  }));

  async function createAction(data: CategoryFormData) { "use server"; await createCategory(data); }
  async function updateAction(id: string, data: CategoryFormData) { "use server"; await updateCategory(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteCategory(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý danh mục</h1>
          <p className="portal-page-subtitle">Danh mục dùng chung cho dự án, tài liệu, topic, họp tuần và wiki.</p>
        </div>
      </div>
      <CategoryManager groups={groups} onCreate={createAction} onUpdate={updateAction} onDelete={deleteAction} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add "src/app/(portal)/master-data/categories" tests/master-data-category-actions.test.ts
git commit -m "feat: add master data category management page"
```

---

## Task 6: Make feature forms read categories from the DB

Each sub-step converts one form to receive options as props. After each, run `npx tsc --noEmit`. Commit once at the end.

**Files:**
- Modify: `meetings/meeting-form.tsx`, `meetings/new/page.tsx`, `meetings/[id]/edit/page.tsx`, `projects/project-form.tsx`, `projects/page.tsx`, `knowledge/documents/document-upload-form.tsx`, `knowledge/documents/page.tsx`, `knowledge/wiki/wiki-form.tsx`, `knowledge/wiki/new/page.tsx`, `knowledge/wiki/[id]/edit/page.tsx`, `topics/topic-form.tsx`, `topics/page.tsx`, `topics/new/page.tsx`, `admin/page.tsx`

**Interfaces:**
- Consumes: `getCategoryValues`, `getCategoryMap` from `@/lib/master-data-db`.

- [ ] **Step 1: Meeting form** — in `meetings/meeting-form.tsx` add props `categories: string[]` and `sections: string[]` to the `MeetingForm` signature; replace `MEETING_SECTIONS.map(...)` with `sections.map(...)` and `MEETING_CATEGORIES.map(...)` with `categories.map(...)`; default the category select value to `categories[0]`. Remove now-unused `MEETING_CATEGORIES`/`MEETING_SECTIONS` imports if unused. In `meetings/new/page.tsx` and `meetings/[id]/edit/page.tsx`, fetch `const { MEETING: categories, MEETING_SECTION: sections } = await getCategoryMap(["MEETING","MEETING_SECTION"]);` and pass `categories={categories} sections={sections}` to `<MeetingForm>`. Keep `MEETING_SECTIONS[1]` defaults by replacing with `sections[1] ?? sections[0] ?? ""`.

- [ ] **Step 2: Project form** — in `projects/project-form.tsx` add props `categories: string[]; sections: string[]`; replace the two constant `.map`s; set `EMPTY.category`/`EMPTY.section` from props inside the component (compute `const EMPTY = {...}` → move category/section defaults to `categories[0]`/`sections[1] ?? sections[0]`). In `projects/page.tsx` fetch `getCategoryMap(["PROJECT","MEETING_SECTION"])` and pass them.

- [ ] **Step 3: Document upload form** — in `document-upload-form.tsx` add prop `categories: string[]`, replace `DOCUMENT_CATEGORIES.map`. In `knowledge/documents/page.tsx` fetch `getCategoryValues("DOCUMENT")` and pass it (also use it for any category filter list on that page).

- [ ] **Step 4: Wiki form** — in `wiki-form.tsx` add prop `categories: string[]`, replace `WIKI_CATEGORIES.map`. In `knowledge/wiki/new/page.tsx` and `knowledge/wiki/[id]/edit/page.tsx` fetch `getCategoryValues("WIKI")` and pass it.

- [ ] **Step 5: Topic form + pages** — in `topic-form.tsx` add prop `categories: string[]`, remove the local `TOPIC_CATEGORIES` const, replace `.map`. In `topics/new/page.tsx` pass `categories={await getCategoryValues("TOPIC")}`. In `topics/page.tsx` replace the local `TOPIC_CATEGORIES` const with `import { TOPIC_CATEGORIES } from "@/lib/master-data"` and prefer DB values: `const categoryOptions = await getCategoryValues("TOPIC")`.

- [ ] **Step 6: Admin section filter** — in `admin/page.tsx` replace `MEETING_SECTIONS.map` with values from `await getCategoryValues("MEETING_SECTION")`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (fix any leftover unused-import lint).

- [ ] **Step 8: Run full unit suite (existing form/action tests must still pass)**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: read categories from DB across meeting/project/document/wiki/topic forms"
```

---

## Task 7: Skills catalog page + actions

**Files:**
- Create: `master-data/skills/actions.ts`, `.../skills/page.tsx`, `.../skills/skill-manager.tsx`
- Test: `tests/master-data-skill-actions.test.ts`

**Interfaces:**
- Produces: `SkillFormData = { name: string; category: string; active: boolean }`; `createSkill(form)`, `updateSkill(id, form)`, `deleteSkill(id)`.

- [ ] **Step 1: Write the failing guard test** — create `tests/master-data-skill-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { skill: {
  create: (...a: unknown[]) => createMock(...a),
  update: vi.fn(),
  delete: (...a: unknown[]) => deleteMock(...a),
} } }));

import { createSkill, deleteSkill } from "../src/app/(portal)/master-data/skills/actions";

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); deleteMock.mockReset(); });

describe("skill actions auth", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createSkill({ name: "Java", category: "", active: true })).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("requires a name", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createSkill({ name: "  ", category: "", active: true })).rejects.toThrow(/name/i);
  });
  it("allows a manager to create", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    await createSkill({ name: "Java", category: "Backend", active: true });
    expect(createMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/master-data-skill-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions** — create `src/app/(portal)/master-data/skills/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export type SkillFormData = { name: string; category: string; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: SkillFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: name is required");
  return { name, category: form.category.trim() || null, active: form.active };
}

export async function createSkill(form: SkillFormData) {
  await requireManager();
  await db.skill.create({ data: clean(form) });
  revalidatePath("/master-data/skills");
}

export async function updateSkill(id: string, form: SkillFormData) {
  await requireManager();
  await db.skill.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/skills");
}

export async function deleteSkill(id: string) {
  await requireManager();
  await db.skill.delete({ where: { id } });
  revalidatePath("/master-data/skills");
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/master-data-skill-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the manager component** — create `src/app/(portal)/master-data/skills/skill-manager.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import type { SkillFormData } from "./actions";

export type SkillRow = { id: string; name: string; category: string; active: boolean };

export function SkillManager({
  skills,
  onCreate,
  onDelete,
}: {
  skills: SkillRow[];
  onCreate: (data: SkillFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => { await onCreate({ name, category, active: true }); setName(""); setCategory(""); });
        }}
      >
        <input className="rounded border px-2 py-1 text-sm" placeholder="Tên skill" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nhóm (tùy chọn)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm skill</button>
      </form>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Skill</th><th>Nhóm</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold text-slate-900">{s.name}</td>
                <td className="portal-table-muted">{s.category || "-"}</td>
                <td><span className={"portal-pill " + (s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{s.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right"><button type="button" className="text-red-600" onClick={() => start(() => onDelete(s.id))}>Xóa</button></td>
              </tr>
            ))}
            {skills.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có skill</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the page** — create `src/app/(portal)/master-data/skills/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { SkillManager } from "./skill-manager";
import { createSkill, deleteSkill, type SkillFormData } from "./actions";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const skills = await db.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const rows = skills.map((s) => ({ id: s.id, name: s.name, category: s.category ?? "", active: s.active }));

  async function createAction(data: SkillFormData) { "use server"; await createSkill(data); }
  async function deleteAction(id: string) { "use server"; await deleteSkill(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý Skills</h1>
          <p className="portal-page-subtitle">Danh mục kỹ năng dùng để gán cho thành viên.</p>
        </div>
        <span className="text-sm text-slate-500">{rows.length} skill</span>
      </div>
      <SkillManager skills={rows} onCreate={createAction} onDelete={deleteAction} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add "src/app/(portal)/master-data/skills" tests/master-data-skill-actions.test.ts
git commit -m "feat: add skills catalog management"
```

---

## Task 8: Certificate type catalog page + actions

**Files:**
- Create: `master-data/certificates/actions.ts`, `.../certificates/page.tsx`, `.../certificates/cert-type-manager.tsx`
- Test: `tests/master-data-cert-actions.test.ts`

**Interfaces:**
- Produces: `CertTypeFormData = { name: string; issuer: string; category: string; active: boolean }`; `createCertType(form)`, `updateCertType(id, form)`, `deleteCertType(id)`.

- [ ] **Step 1: Write the failing guard test** — create `tests/master-data-cert-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { certificateType: {
  create: (...a: unknown[]) => createMock(...a), update: vi.fn(), delete: vi.fn(),
} } }));

import { createCertType } from "../src/app/(portal)/master-data/certificates/actions";

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); });

describe("certificate type actions auth", () => {
  it("blocks a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(createCertType({ name: "PMP", issuer: "PMI", category: "", active: true })).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("allows a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createCertType({ name: "PMP", issuer: "PMI", category: "", active: true });
    expect(createMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/master-data-cert-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions** — create `src/app/(portal)/master-data/certificates/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export type CertTypeFormData = { name: string; issuer: string; category: string; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: CertTypeFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: name is required");
  return { name, issuer: form.issuer.trim() || null, category: form.category.trim() || null, active: form.active };
}

export async function createCertType(form: CertTypeFormData) {
  await requireManager();
  await db.certificateType.create({ data: clean(form) });
  revalidatePath("/master-data/certificates");
}

export async function updateCertType(id: string, form: CertTypeFormData) {
  await requireManager();
  await db.certificateType.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/certificates");
}

export async function deleteCertType(id: string) {
  await requireManager();
  await db.certificateType.delete({ where: { id } });
  revalidatePath("/master-data/certificates");
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/master-data-cert-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the manager component** — create `src/app/(portal)/master-data/certificates/cert-type-manager.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import type { CertTypeFormData } from "./actions";

export type CertTypeRow = { id: string; name: string; issuer: string; category: string; active: boolean };

export function CertTypeManager({
  types,
  onCreate,
  onDelete,
}: {
  types: CertTypeRow[];
  onCreate: (data: CertTypeFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => { await onCreate({ name, issuer, category, active: true }); setName(""); setIssuer(""); setCategory(""); });
        }}
      >
        <input className="rounded border px-2 py-1 text-sm" placeholder="Tên chứng chỉ" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nơi cấp (tùy chọn)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nhóm (tùy chọn)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm</button>
      </form>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Chứng chỉ</th><th>Nơi cấp</th><th>Nhóm</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold text-slate-900">{t.name}</td>
                <td className="portal-table-muted">{t.issuer || "-"}</td>
                <td className="portal-table-muted">{t.category || "-"}</td>
                <td><span className={"portal-pill " + (t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{t.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right"><button type="button" className="text-red-600" onClick={() => start(() => onDelete(t.id))}>Xóa</button></td>
              </tr>
            ))}
            {types.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có loại chứng chỉ</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the page** — create `src/app/(portal)/master-data/certificates/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CertTypeManager } from "./cert-type-manager";
import { createCertType, deleteCertType, type CertTypeFormData } from "./actions";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const types = await db.certificateType.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const rows = types.map((t) => ({ id: t.id, name: t.name, issuer: t.issuer ?? "", category: t.category ?? "", active: t.active }));

  async function createAction(data: CertTypeFormData) { "use server"; await createCertType(data); }
  async function deleteAction(id: string) { "use server"; await deleteCertType(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý Chứng chỉ</h1>
          <p className="portal-page-subtitle">Danh mục loại chứng chỉ dùng để gán cho thành viên.</p>
        </div>
        <span className="text-sm text-slate-500">{rows.length} loại</span>
      </div>
      <CertTypeManager types={rows} onCreate={createAction} onDelete={deleteAction} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)

```bash
git add "src/app/(portal)/master-data/certificates" tests/master-data-cert-actions.test.ts
git commit -m "feat: add certificate type catalog management"
```

---

## Task 9: Member profile — assign skills & certificates

**Files:**
- Create: `master-data/members/page.tsx`, `master-data/members/[id]/page.tsx`, `.../[id]/actions.ts`, `.../[id]/member-skills.tsx`, `.../[id]/member-certificates.tsx`
- Test: `tests/master-data-member-actions.test.ts`

**Interfaces:**
- Produces: `setUserSkill(userId, skillId, level)`, `removeUserSkill(userSkillId)`, `addUserCertificate(userId, form)`, `deleteUserCertificate(id)`. `CertInput = { typeId: string; issuer: string; issuedAt: string; expiresAt: string; credentialId: string }`. Uses `uploadAttachmentFile(path, file)` from `@/lib/storage`.

- [ ] **Step 1: Write the failing guard test** — create `tests/master-data-member-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const certCreateMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({ uploadAttachmentFile: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  userSkill: { upsert: (...a: unknown[]) => upsertMock(...a), delete: vi.fn() },
  userCertificate: { create: (...a: unknown[]) => certCreateMock(...a), delete: vi.fn() },
} }));

import { setUserSkill, addUserCertificate } from "../src/app/(portal)/master-data/members/[id]/actions";

beforeEach(() => { authMock.mockReset(); upsertMock.mockReset(); certCreateMock.mockReset(); });

describe("member actions auth", () => {
  it("blocks a MEMBER from assigning a skill", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(setUserSkill("user2", "skill1", 3)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("clamps level to 1..5 for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await setUserSkill("user2", "skill1", 9);
    const arg = upsertMock.mock.calls[0][0] as { create: { level: number } };
    expect(arg.create.level).toBe(5);
  });
  it("requires a certificate type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const fd = new FormData();
    await expect(addUserCertificate("user2", fd)).rejects.toThrow(/type/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/master-data-member-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions** — create `src/app/(portal)/master-data/members/[id]/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { uploadAttachmentFile } from "@/lib/storage";

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clampLevel(level: number) {
  if (!Number.isFinite(level)) return 1;
  return Math.min(5, Math.max(1, Math.round(level)));
}

export async function setUserSkill(userId: string, skillId: string, level: number) {
  await requireManager();
  const lvl = clampLevel(level);
  await db.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, level: lvl },
    update: { level: lvl },
  });
  revalidatePath(`/master-data/members/${userId}`);
}

export async function removeUserSkill(userSkillId: string) {
  await requireManager();
  await db.userSkill.delete({ where: { id: userSkillId } });
}

export async function addUserCertificate(userId: string, formData: FormData) {
  await requireManager();
  if (!/^[a-z0-9]{20,}$/i.test(userId)) throw new Error("Validation: bad user id");
  const typeId = String(formData.get("typeId") ?? "").trim();
  if (!typeId) throw new Error("Validation: certificate type is required");

  const toDate = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s ? new Date(s) : null;
  };

  let fileUrl: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `certificates/${userId}/${Date.now()}_${safeName}`;
    await uploadAttachmentFile(path, file);
    fileUrl = path;
  }

  await db.userCertificate.create({
    data: {
      userId,
      typeId,
      issuer: String(formData.get("issuer") ?? "").trim() || null,
      issuedAt: toDate(formData.get("issuedAt")),
      expiresAt: toDate(formData.get("expiresAt")),
      credentialId: String(formData.get("credentialId") ?? "").trim() || null,
      fileUrl,
    },
  });
  revalidatePath(`/master-data/members/${userId}`);
}

export async function deleteUserCertificate(id: string) {
  await requireManager();
  await db.userCertificate.delete({ where: { id } });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/master-data-member-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the member list page** — create `src/app/(portal)/master-data/members/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [users, total] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      ...paginationArgs(page),
      select: { id: true, name: true, email: true, section: true, _count: { select: { userSkills: true, certificates: true } } },
    }),
    db.user.count(),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Hồ sơ thành viên</h1>
          <p className="portal-page-subtitle">Quản lý skills và chứng chỉ của từng thành viên.</p>
        </div>
        <span className="text-sm text-slate-500">{total} user</span>
      </div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Tên</th><th>Email</th><th>Section</th><th>Skills</th><th>Chứng chỉ</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold text-slate-900">{u.name}</td>
                <td className="portal-table-muted">{u.email}</td>
                <td>{u.section ?? "-"}</td>
                <td>{u._count.userSkills}</td>
                <td>{u._count.certificates}</td>
                <td className="text-right"><Link href={`/master-data/members/${u.id}`} className="text-[var(--vti-deep,#0A3CA8)]">Quản lý</Link></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Không có user</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/master-data/members" params={sp} page={page} total={total} />
    </div>
  );
}
```

- [ ] **Step 6: Create the member-skills client component** — create `src/app/(portal)/master-data/members/[id]/member-skills.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { setUserSkill, removeUserSkill } from "./actions";

export type UserSkillRow = { id: string; skillId: string; name: string; level: number };
type SkillOption = { id: string; name: string };
const LEVELS = [1, 2, 3, 4, 5];
const LEVEL_LABEL: Record<number, string> = { 1: "Beginner", 2: "Basic", 3: "Intermediate", 4: "Advanced", 5: "Expert" };

export function MemberSkills({ userId, current, options }: { userId: string; current: UserSkillRow[]; options: SkillOption[] }) {
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState(3);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Skills</h2>
      <ul className="mb-3 space-y-1">
        {current.map((s) => (
          <li key={s.id} className="flex items-center justify-between text-sm">
            <span>{s.name} — <span className="text-slate-500">{LEVEL_LABEL[s.level]}</span></span>
            <button type="button" className="text-xs text-red-500" onClick={() => start(() => removeUserSkill(s.id))}>xóa</button>
          </li>
        ))}
        {current.length === 0 && <li className="text-sm text-slate-400">Chưa gán skill</li>}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (!skillId) return; start(async () => { await setUserSkill(userId, skillId, level); setSkillId(""); }); }}
      >
        <select className="rounded border px-2 py-1 text-sm" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Chọn skill…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="rounded border px-2 py-1 text-sm" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Gán</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 7: Create the member-certificates client component** — create `src/app/(portal)/master-data/members/[id]/member-certificates.tsx`:

```tsx
"use client";
import { useRef, useState, useTransition } from "react";
import { addUserCertificate, deleteUserCertificate } from "./actions";

export type UserCertRow = { id: string; typeName: string; issuer: string; issuedAt: string; expiresAt: string; credentialId: string };
type TypeOption = { id: string; name: string };

export function MemberCertificates({ userId, current, options }: { userId: string; current: UserCertRow[]; options: TypeOption[] }) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Chứng chỉ</h2>
      <ul className="mb-3 space-y-1">
        {current.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span>{c.typeName}{c.issuer ? ` — ${c.issuer}` : ""}{c.issuedAt ? ` (${c.issuedAt}${c.expiresAt ? ` → ${c.expiresAt}` : ""})` : ""}</span>
            <button type="button" className="text-xs text-red-500" onClick={() => start(() => deleteUserCertificate(c.id))}>xóa</button>
          </li>
        ))}
        {current.length === 0 && <li className="text-sm text-slate-400">Chưa có chứng chỉ</li>}
      </ul>
      <form
        ref={formRef}
        className="grid gap-2 sm:grid-cols-2"
        action={(fd) => start(async () => { await addUserCertificate(userId, fd); formRef.current?.reset(); })}
      >
        <select name="typeId" required className="rounded border px-2 py-1 text-sm">
          <option value="">Chọn loại chứng chỉ…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input name="issuer" placeholder="Nơi cấp" className="rounded border px-2 py-1 text-sm" />
        <label className="text-xs text-slate-500">Ngày cấp<input name="issuedAt" type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
        <label className="text-xs text-slate-500">Hết hạn<input name="expiresAt" type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
        <input name="credentialId" placeholder="Mã chứng chỉ" className="rounded border px-2 py-1 text-sm" />
        <input name="file" type="file" className="text-sm" />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">Thêm chứng chỉ</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 8: Create the member detail page** — create `src/app/(portal)/master-data/members/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MemberSkills } from "./member-skills";
import { MemberCertificates } from "./member-certificates";

function fmt(d: Date | null) { return d ? d.toISOString().slice(0, 10) : ""; }

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const user = await db.user.findUnique({
    where: { id },
    include: {
      userSkills: { include: { skill: true } },
      certificates: { include: { type: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();

  const [skillOptions, typeOptions] = await Promise.all([
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.certificateType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const currentSkills = user.userSkills.map((us) => ({ id: us.id, skillId: us.skillId, name: us.skill.name, level: us.level }));
  const currentCerts = user.certificates.map((c) => ({
    id: c.id, typeName: c.type.name, issuer: c.issuer ?? "", issuedAt: fmt(c.issuedAt), expiresAt: fmt(c.expiresAt), credentialId: c.credentialId ?? "",
  }));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">{user.name}</h1>
          <p className="portal-page-subtitle">{user.email}{user.section ? ` · ${user.section}` : ""}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MemberSkills userId={user.id} current={currentSkills} options={skillOptions} />
        <MemberCertificates userId={user.id} current={currentCerts} options={typeOptions} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Typecheck + full test run + commit**

Run: `npx tsc --noEmit` (expected: clean)
Run: `npx vitest run` (expected: all PASS)

```bash
git add "src/app/(portal)/master-data/members" tests/master-data-member-actions.test.ts
git commit -m "feat: add member skills and certificate assignment"
```

---

## Task 10: Seed master data + docs

**Files:**
- Modify: `prisma/seed.ts`, `CLAUDE.md`

- [ ] **Step 1: Seed categories, skills, cert types** — in `prisma/seed.ts`, import the constants near the top:

```ts
import {
  PROJECT_CATEGORIES, DOCUMENT_CATEGORIES, TOPIC_CATEGORIES,
  MEETING_CATEGORIES, MEETING_SECTIONS, WIKI_CATEGORIES,
} from "../src/lib/master-data";
```

Then add this block before `db.$disconnect()` at the end of the seed routine:

```ts
const CATEGORY_SEED: Array<[string, readonly string[]]> = [
  ["PROJECT", PROJECT_CATEGORIES],
  ["DOCUMENT", DOCUMENT_CATEGORIES],
  ["TOPIC", TOPIC_CATEGORIES],
  ["MEETING", MEETING_CATEGORIES],
  ["MEETING_SECTION", MEETING_SECTIONS],
  ["WIKI", WIKI_CATEGORIES],
];
for (const [type, values] of CATEGORY_SEED) {
  for (let i = 0; i < values.length; i++) {
    await db.masterCategory.upsert({
      where: { type_value: { type, value: values[i] } },
      create: { type, value: values[i], order: i },
      update: { order: i },
    });
  }
}

const SKILLS = ["Java", "Spring Boot", "React", "Next.js", "AWS", "Project Management"];
for (const name of SKILLS) {
  await db.skill.upsert({ where: { name }, create: { name }, update: {} });
}

const CERT_TYPES: Array<{ name: string; issuer: string }> = [
  { name: "AWS Solutions Architect Associate", issuer: "AWS" },
  { name: "PMP", issuer: "PMI" },
  { name: "TOEIC", issuer: "ETS" },
];
for (const t of CERT_TYPES) {
  await db.certificateType.upsert({ where: { name: t.name }, create: t, update: {} });
}
```

- [ ] **Step 2: Run the seed (if a dev DB is available)**

Run: `npm run db:seed`
Expected: completes without error; categories/skills/cert types present.

- [ ] **Step 3: Update `CLAUDE.md`** — add to the Data model section (new models), `src/lib` reference (`master-data-db.ts`), Server actions (master-data: category/skill/cert/member actions), API/route list (`/master-data/*`), and note the new nav group + `master-data:manage` capability under Roles & permissions.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts CLAUDE.md
git commit -m "chore: seed master data and update system map"
```

---

## Self-Review

**Spec coverage:**
- Nav & permissions → Tasks 2, 3. ✓
- Data model (5 models + User relations) → Task 1. ✓
- Category mgmt + form integration → Tasks 4, 5, 6. ✓
- Skills catalog + member assignment → Tasks 7, 9. ✓
- Certificate catalog + member records (+ optional file) → Tasks 8, 9. ✓
- Server-action guards → every actions file has `requireManager`; guard tests in Tasks 5, 7, 8, 9. ✓
- Seed + tests → Tasks 1–9 tests, Task 10 seed. ✓
- Docs → Task 10. ✓

**Type consistency:** `MasterCategoryType`/`CATEGORY_TYPES` defined in Task 4 and consumed in Tasks 5/6; `CategoryFormData`, `SkillFormData`, `CertTypeFormData` defined in their actions and consumed by their managers/pages; member actions signatures (`setUserSkill`, `removeUserSkill`, `addUserCertificate`, `deleteUserCertificate`) match across actions/components in Task 9; `uploadAttachmentFile(path, file)` matches `src/lib/storage`. Prisma upsert composite keys `userId_skillId` and `type_value` match the `@@unique` definitions in Task 1.

**Placeholder scan:** No TBD/TODO; every code step contains full code; no "similar to Task N".

**Note for executor:** Task 1's migration must be applied and the Prisma client regenerated before Tasks 5–9 will typecheck (they reference `db.masterCategory`, `db.skill`, etc.). If no DB is reachable, use `--create-only` + `npx prisma generate` so the client types exist.
