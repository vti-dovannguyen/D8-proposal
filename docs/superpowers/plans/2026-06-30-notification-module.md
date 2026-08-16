# Notification Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `Announcement` feature into a manager-managed Notification module with rich-text content, an ON/OFF status, and a working header bell.

**Architecture:** Reuse the `Announcement` Prisma model and `/announcements` routes. Replace `expiresAt` with an `active` (ON/OFF) flag, store sanitized TinyMCE HTML in `body`, gate writes behind a new `announcement:manage` (MANAGERS) capability, and surface active notifications on the home widget and a new header-bell dropdown (no per-user read tracking).

**Tech Stack:** Next.js 16 App Router (server components + server actions), Prisma 7 (`@prisma/adapter-pg`), TinyMCE (`@tinymce/tinymce-react`, served from `/public/tinymce`), `sanitize-html` (server-only), Tailwind v4, lucide-react, Vitest.

## Global Constraints

- UI text is Vietnamese.
- Next.js 16 is a breaking version: read `node_modules/next/dist/docs/` before writing framework code (per `AGENTS.md`).
- Prisma client is generated to `src/generated/prisma` — never hand-edit; regenerate via migrate.
- `sanitize.ts` is `server-only` — never import it from a client component.
- Viewing notifications is open to all roles; create/read-in-admin/update/delete is MANAGERS only (ADMIN, DIVISION_LEADER, SECTION_MANAGER — excludes PM and MEMBER).
- Conventional Commits (`feat:` / `fix:` / `refactor:` / `test:` / `docs:`).
- Keep `d8-portal/CLAUDE.md` in sync with model/lib/action/route changes.

---

## File structure

- Modify `prisma/schema.prisma` — `Announcement` model: drop `expiresAt`, add `active`, add index.
- Modify `src/types/index.ts` — add `"announcement:manage"` to `Capability`.
- Modify `src/lib/permissions.ts` — add the `announcement:manage` rule.
- Modify `src/types/community.ts` — `AnnouncementFormData`: drop `expiresAt`, add `active`.
- Modify `src/lib/announcements.ts` — `activeAnnouncementWhere()` → `{ active: true }`; add pure `htmlToText(html)`.
- Modify `src/app/(portal)/announcements/actions.ts` — manager guard, sanitize body, persist `active`.
- Modify `src/app/(portal)/announcements/announcement-form.tsx` — TinyMCE editor + ON/OFF toggle + Ghim.
- Modify `src/app/(portal)/announcements/page.tsx` — status column, manager-only OFF visibility.
- Modify `src/app/(portal)/announcements/[id]/edit/page.tsx` — `announcement:manage` guard, preload `active`.
- Modify `src/components/home/announcement-list.tsx` — `{ active: true }` filter + text preview.
- Create `src/components/layout/notification-bell.tsx` — client dropdown.
- Modify `src/components/layout/header.tsx` — render `NotificationBell`.
- Modify `src/components/layout/shell-chrome.tsx` — thread a `notifications` prop to `Header`.
- Modify `src/app/(portal)/layout.tsx` — fetch active notifications, pass to `ShellChrome`.
- Modify `tests/permissions.test.ts`, `tests/announcements-lib.test.ts`, `tests/announcement-actions.test.ts`.
- Modify `d8-portal/CLAUDE.md`.

---

## Task 1: Data model, permission capability, and lib helpers

**Files:**
- Modify: `prisma/schema.prisma` (Announcement model, ~350-359)
- Modify: `src/types/index.ts:13-22`
- Modify: `src/lib/permissions.ts:6-16`
- Modify: `src/types/community.ts:9-14`
- Modify: `src/lib/announcements.ts` (whole file)
- Test: `tests/permissions.test.ts`, `tests/announcements-lib.test.ts`

**Interfaces:**
- Produces:
  - `Announcement` model fields: `title: string`, `body: string` (sanitized HTML), `pinned: boolean`, `active: boolean` (default true), `authorId/author`, `createdAt`. No `expiresAt`.
  - `Capability` union includes `"announcement:manage"`.
  - `can(role, "announcement:manage")` → true only for ADMIN/DIVISION_LEADER/SECTION_MANAGER.
  - `AnnouncementFormData = { title: string; body: string; pinned: boolean; active: boolean }`.
  - `activeAnnouncementWhere(): { active: true }` (no args).
  - `htmlToText(html: string): string` — strips tags, collapses whitespace.

- [ ] **Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, replace the `Announcement` model with:

```prisma
model Announcement {
  id        String   @id @default(cuid())
  title     String
  body      String   // sanitized rich-text HTML
  pinned    Boolean  @default(false)
  active    Boolean  @default(true)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())

  @@index([active, pinned, createdAt])
}
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:migrate -- --name notification_active_status`
Expected: a new migration under `prisma/migrations/` that drops `expiresAt` and adds `active`; Prisma client regenerates into `src/generated/prisma` with no errors.

- [ ] **Step 3: Add the capability to the type union**

In `src/types/index.ts`, add the new member to the `Capability` union:

```typescript
export type Capability =
  | "dashboard:view"
  | "meeting:edit"
  | "project:manage"
  | "ai-account:manage"
  | "content:edit"
  | "topic:create"
  | "admin:access"
  | "master-data:manage"
  | "point:award"
  | "announcement:manage";
```

- [ ] **Step 4: Add the permission rule**

In `src/lib/permissions.ts`, add to the `RULES` object (after `"point:award"`):

```typescript
  "announcement:manage": (r) => MANAGERS.includes(r),
```

- [ ] **Step 5: Update the form data type**

In `src/types/community.ts`, replace the `AnnouncementFormData` type:

```typescript
export type AnnouncementFormData = {
  title: string;
  body: string; // rich-text HTML
  pinned: boolean;
  active: boolean;
};
```

- [ ] **Step 6: Rewrite the announcements lib helper**

Replace the entire contents of `src/lib/announcements.ts`:

```typescript
/**
 * Prisma `where` clause selecting active (ON) notifications. OFF notifications
 * are hidden from the home widget, the header bell, and the member list view.
 */
export function activeAnnouncementWhere(): { active: true } {
  return { active: true };
}

/**
 * Strip HTML tags from rich-text body to a plain-text preview. Pure + safe for
 * both server and client (regex only — no DOM, no sanitize-html dependency).
 */
export function htmlToText(html: string): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 7: Replace the lib test**

Replace the entire contents of `tests/announcements-lib.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";

describe("activeAnnouncementWhere()", () => {
  it("matches only active (ON) notifications", () => {
    expect(activeAnnouncementWhere()).toEqual({ active: true });
  });
});

describe("htmlToText()", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToText("<p>Hello   <strong>world</strong></p>")).toBe("Hello world");
  });
  it("decodes common entities", () => {
    expect(htmlToText("<p>A &amp; B &lt;ok&gt;</p>")).toBe("A & B <ok>");
  });
  it("handles empty/nullish input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined as unknown as string)).toBe("");
  });
});
```

- [ ] **Step 8: Add a permissions test case**

In `tests/permissions.test.ts`, add this test inside the `describe("can()", ...)` block (after the `point:award` test, before the closing `});` of the block):

```typescript
  it("lets managers manage announcements, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "announcement:manage")).toBe(true);
    expect(can("DIVISION_LEADER", "announcement:manage")).toBe(true);
    expect(can("ADMIN", "announcement:manage")).toBe(true);
    expect(can("PM", "announcement:manage")).toBe(false);
    expect(can("MEMBER", "announcement:manage")).toBe(false);
  });
```

- [ ] **Step 9: Run the unit tests**

Run: `npm test -- permissions announcements-lib`
Expected: PASS for both files.

- [ ] **Step 10: Commit**

```bash
git add prisma/ src/generated/prisma src/types/index.ts src/lib/permissions.ts src/types/community.ts src/lib/announcements.ts tests/permissions.test.ts tests/announcements-lib.test.ts
git commit -m "feat: add Announcement.active + announcement:manage capability"
```

---

## Task 2: Server actions (manager guard, sanitize, active)

**Files:**
- Modify: `src/app/(portal)/announcements/actions.ts` (whole file)
- Test: `tests/announcement-actions.test.ts` (whole file)

**Interfaces:**
- Consumes: `can(role, "announcement:manage")`, `sanitizeRichTextHtml`, `AnnouncementFormData` (with `active`).
- Produces:
  - `createAnnouncement(form: AnnouncementFormData): Promise<void>` — manager-only, sanitizes `body`, persists `active`/`pinned`, redirects to `/announcements`.
  - `updateAnnouncement(id: string, form: AnnouncementFormData): Promise<void>` — manager-only.
  - `deleteAnnouncement(id: string): Promise<void>` — manager-only.

- [ ] **Step 1: Replace the action test file**

Replace the entire contents of `tests/announcement-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    announcement: {
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
    },
  },
}));

import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../src/app/(portal)/announcements/actions";
import type { AnnouncementFormData } from "@/types/community";

const valid: AnnouncementFormData = { title: "Nghỉ lễ", body: "<p>Công ty nghỉ 2 ngày</p>", pinned: true, active: true };

beforeEach(() => {
  authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); deleteMock.mockReset();
  createMock.mockResolvedValue({ id: "a1" });
});

describe("createAnnouncement", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createAnnouncement(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects a PM (managers only)", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createAnnouncement(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects a blank title or empty body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await expect(createAnnouncement({ ...valid, title: " " })).rejects.toThrow("Validation");
    await expect(createAnnouncement({ ...valid, body: "<p>   </p>" })).rejects.toThrow("Validation");
  });
  it("sanitizes the body and persists active + pinned for a manager, then redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    const dirty = { ...valid, body: '<p>Hi</p><script>alert(1)</script>', active: false };
    await expect(createAnnouncement(dirty)).rejects.toThrow("REDIRECT:/announcements");
    const arg = createMock.mock.calls[0][0] as { data: { authorId: string; pinned: boolean; active: boolean; body: string } };
    expect(arg.data).toMatchObject({ authorId: "u1", pinned: true, active: false });
    expect(arg.data.body).not.toContain("<script>");
    expect(arg.data.body).toContain("Hi");
  });
});

describe("updateAnnouncement / deleteAnnouncement", () => {
  it("updates for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(updateAnnouncement("a1", valid)).rejects.toThrow("REDIRECT:/announcements");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects update for a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(updateAnnouncement("a1", valid)).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("rejects delete for a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(deleteAnnouncement("a1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("deletes for a manager and redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    await expect(deleteAnnouncement("a1")).rejects.toThrow("REDIRECT:/announcements");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "a1" } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- announcement-actions`
Expected: FAIL (actions still use `content:edit`/`expiresAt`; `active` not persisted; PM still allowed).

- [ ] **Step 3: Rewrite the actions file**

Replace the entire contents of `src/app/(portal)/announcements/actions.ts`:

```typescript
"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { sanitizeRichTextHtml } from "@/lib/sanitize";
import { htmlToText } from "@/lib/announcements";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AnnouncementFormData } from "@/types/community";

async function requireManager(): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "announcement:manage")) throw new Error("Forbidden");
  return { id: session.user.id };
}

function validate(form: AnnouncementFormData) {
  if (!form.title?.trim()) throw new Error("Validation: title is required");
  if (!htmlToText(form.body)) throw new Error("Validation: body is required");
}

export async function createAnnouncement(form: AnnouncementFormData) {
  const user = await requireManager();
  validate(form);
  await db.announcement.create({
    data: {
      title: form.title.trim(),
      body: sanitizeRichTextHtml(form.body),
      pinned: form.pinned,
      active: form.active,
      authorId: user.id,
    },
  });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}

export async function updateAnnouncement(id: string, form: AnnouncementFormData) {
  await requireManager();
  validate(form);
  await db.announcement.update({
    where: { id },
    data: {
      title: form.title.trim(),
      body: sanitizeRichTextHtml(form.body),
      pinned: form.pinned,
      active: form.active,
    },
  });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}

export async function deleteAnnouncement(id: string) {
  await requireManager();
  await db.announcement.delete({ where: { id } });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- announcement-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(portal\)/announcements/actions.ts tests/announcement-actions.test.ts
git commit -m "feat: gate announcement actions to managers, sanitize body, persist active"
```

---

## Task 3: Announcement form (TinyMCE + ON/OFF) and pages

**Files:**
- Modify: `src/app/(portal)/announcements/announcement-form.tsx` (whole file)
- Modify: `src/app/(portal)/announcements/page.tsx`
- Modify: `src/app/(portal)/announcements/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `AnnouncementFormData` (with `active`), `createAnnouncement`, `updateAnnouncement`, `can(role, "announcement:manage")`, `activeAnnouncementWhere()`, `htmlToText`.
- Produces: a form rendering TinyMCE for `body`, a Ghim checkbox, and an ON/OFF toggle; the list page shows a "Trạng thái" column and (for managers) OFF rows.

- [ ] **Step 1: Rewrite the form component**

Replace the entire contents of `src/app/(portal)/announcements/announcement-form.tsx`:

```typescript
"use client";
import { useState, useTransition } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { htmlToText } from "@/lib/announcements";
import type { AnnouncementFormData } from "@/types/community";

export function AnnouncementForm({ initial, submitLabel, onSubmit }: {
  initial: AnnouncementFormData;
  submitLabel: string;
  onSubmit: (data: AnnouncementFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<AnnouncementFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof AnnouncementFormData>(k: K, v: AnnouncementFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Vui lòng nhập tiêu đề."); return; }
    if (!htmlToText(form.body)) { setError("Vui lòng nhập nội dung thông báo."); return; }
    setError(null);
    start(async () => {
      try { await onSubmit(form); }
      catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu thông báo."); }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <label className="block text-sm font-semibold text-slate-700">
        Tiêu đề
        <input className="mt-1 w-full rounded border px-2 py-1 font-normal" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="meeting-rich-editor">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Nội dung</span>
        <Editor
          licenseKey="gpl"
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          value={form.body}
          onEditorChange={(value) => set("body", value)}
          init={{
            height: 360,
            base_url: "/tinymce",
            suffix: ".min",
            menubar: false,
            plugins: "lists link table code autoresize",
            toolbar: "undo redo | blocks | bold italic underline | bullist numlist | link table | alignleft aligncenter alignright | code",
            skin: "oxide",
            content_css: "default",
            branding: false,
            promotion: false,
            statusbar: true,
            content_style:
              "body { font-family: Inter, Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.65; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #dbe3ef; padding: 6px 8px; } th { background: #f3f6fb; }",
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={(e) => set("pinned", e.target.checked)} /> Ghim</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Hiển thị (ON)</label>
        <button type="submit" disabled={pending} className="ml-auto rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 font-medium text-white disabled:opacity-50">{pending ? "Đang lưu…" : submitLabel}</button>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Update the list page**

Replace the entire contents of `src/app/(portal)/announcements/page.tsx`:

```typescript
import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
import type { AnnouncementFormData } from "@/types/community";
import { createAnnouncement } from "./actions";
import { AnnouncementForm } from "./announcement-form";
import { DeleteAnnouncementButton } from "./delete-announcement-button";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const editable = can(session!.user.role, "announcement:manage");
  // Managers see all (ON + OFF); everyone else sees ON only.
  const where = editable ? {} : activeAnnouncementWhere();
  const [items, total] = await Promise.all([
    db.announcement.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { author: true }, ...paginationArgs(page) }),
    db.announcement.count({ where }),
  ]);

  async function create(data: AnnouncementFormData) {
    "use server";
    await createAnnouncement(data);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Thông báo</h1>
          <p className="portal-page-subtitle">Các cập nhật đang hiệu lực, ưu tiên thông báo được ghim.</p>
        </div>
        <span className="text-sm text-slate-500">{total} thông báo</span>
      </div>

      {editable && <AnnouncementForm initial={{ title: "", body: "", pinned: false, active: true }} submitLabel="Đăng thông báo" onSubmit={create} />}

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th>Tiêu đề</th><th>Nội dung</th><th>Tác giả</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {item.pinned && <span className="portal-pill bg-amber-100 text-amber-700">Ghim</span>}
                    <span className="font-semibold text-slate-950">{item.title}</span>
                  </div>
                </td>
                <td className="max-w-xl portal-table-muted line-clamp-2">{htmlToText(item.body)}</td>
                <td>{item.author.name}</td>
                <td>
                  {item.active
                    ? <span className="portal-pill bg-emerald-100 text-emerald-700">ON</span>
                    : <span className="portal-pill bg-slate-200 text-slate-600">OFF</span>}
                </td>
                <td className="text-right">
                  {editable && (
                    <div className="flex justify-end gap-3 text-sm">
                      <Link href={`/announcements/${item.id}/edit`} className="text-[var(--vti-deep,#0A3CA8)]">Sửa</Link>
                      <DeleteAnnouncementButton id={item.id} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có thông báo</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/announcements" params={sp} page={page} total={total} />
    </div>
  );
}
```

- [ ] **Step 3: Update the edit page**

Replace the entire contents of `src/app/(portal)/announcements/[id]/edit/page.tsx`:

```typescript
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AnnouncementForm } from "../../announcement-form";
import { updateAnnouncement } from "../../actions";
import type { AnnouncementFormData } from "@/types/community";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!can(session!.user.role, "announcement:manage")) redirect("/announcements");

  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) notFound();

  const initial: AnnouncementFormData = {
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    active: a.active,
  };

  async function action(data: AnnouncementFormData) { "use server"; await updateAnnouncement(id, data); }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Sửa thông báo</h1>
      <AnnouncementForm initial={initial} submitLabel="Lưu" onSubmit={action} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck / build**

Run: `npm run lint && npm run build`
Expected: no type errors; the announcements routes compile. (If the editor needs `"use client"` boundaries, they are already set in the form component.)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(portal\)/announcements/announcement-form.tsx src/app/\(portal\)/announcements/page.tsx src/app/\(portal\)/announcements/\[id\]/edit/page.tsx
git commit -m "feat: TinyMCE body + ON/OFF status on announcement form and pages"
```

---

## Task 4: Home page text preview (rich-text bodies)

> **Note (corrected during execution):** The real home page is `src/app/(portal)/page.tsx`,
> which renders announcement bodies in TWO places: a featured/pinned hero (~line 107) and a
> list (~line 171). The `src/components/home/announcement-list.tsx` component is **dead code**
> (not imported anywhere) but documents the home widget — fix it too for consistency so it
> never gets wired up rendering raw HTML. The `activeAnnouncementWhere()` ON-filter on both
> files was already made arg-less in Task 3; this task only converts raw-HTML body rendering
> to stripped text via `htmlToText`.

**Files:**
- Modify: `src/app/(portal)/page.tsx` (the real home page)
- Modify: `src/components/home/announcement-list.tsx` (documented widget, consistency)

**Interfaces:**
- Consumes: `htmlToText` (from `@/lib/announcements`); `activeAnnouncementWhere()` already in use.
- Produces: home surfaces show stripped plain-text previews of rich-text bodies (no raw tags).

- [ ] **Step 1: Add `htmlToText` to the home page import**

In `src/app/(portal)/page.tsx`, replace the import line:

```typescript
import { activeAnnouncementWhere } from "@/lib/announcements";
```

with:

```typescript
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
```

- [ ] **Step 2: Convert the featured (hero) body to stripped text**

In `src/app/(portal)/page.tsx`, replace:

```typescript
              {featuredAnnouncement?.body ?? "Toàn bộ PM bắt đầu cập nhật Weekly Meeting trên Portal từ tuần 25. Dữ liệu Excel cũ sẽ được migrate xong trước 14/06."}
```

with:

```typescript
              {featuredAnnouncement ? htmlToText(featuredAnnouncement.body) : "Toàn bộ PM bắt đầu cập nhật Weekly Meeting trên Portal từ tuần 25. Dữ liệu Excel cũ sẽ được migrate xong trước 14/06."}
```

- [ ] **Step 3: Convert the list-item body to stripped text**

In `src/app/(portal)/page.tsx`, replace:

```typescript
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.body}</p>
```

with:

```typescript
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{htmlToText(item.body)}</p>
```

- [ ] **Step 4: Fix the documented widget for consistency**

In `src/components/home/announcement-list.tsx`, replace the import line:

```typescript
import { activeAnnouncementWhere } from "@/lib/announcements";
```

with:

```typescript
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
```

and replace the body preview line:

```typescript
                <p className="mt-1 line-clamp-2 text-slate-600">{a.body}</p>
```

with:

```typescript
                <p className="mt-1 line-clamp-2 text-slate-600">{htmlToText(a.body)}</p>
```

- [ ] **Step 5: Typecheck / build**

Run: `npm run build`
Expected: compiles clean; no raw `{item.body}` / `{a.body}` / `?.body` HTML rendering remains for announcements.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(portal\)/page.tsx src/components/home/announcement-list.tsx
git commit -m "feat: strip rich-text HTML to plain text on home announcement previews"
```

---

## Task 5: Header notification bell

**Files:**
- Create: `src/components/layout/notification-bell.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/shell-chrome.tsx`
- Modify: `src/app/(portal)/layout.tsx`

**Interfaces:**
- Consumes (in `layout.tsx`): `db.announcement.findMany`, `activeAnnouncementWhere()`, `htmlToText`.
- Produces:
  - Type `NotificationItem = { id: string; title: string; preview: string; pinned: boolean }`.
  - `NotificationBell({ items }: { items: NotificationItem[] })` — client component; red dot when `items.length > 0`; click toggles a dropdown listing items, each linking to `/announcements`.
  - `Header` gains a `notifications: NotificationItem[]` prop.
  - `ShellChrome` gains a `notifications: NotificationItem[]` prop, passed to `Header`.

- [ ] **Step 1: Create the bell component**

Create `src/components/layout/notification-bell.tsx`:

```typescript
"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, Pin } from "lucide-react";

export type NotificationItem = { id: string; title: string; preview: string; pinned: boolean };

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const hasItems = items.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        aria-expanded={open}
        className="relative hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:block"
      >
        <Bell size={18} />
        {hasItems && <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-lg">
            <div className="border-b border-[#dbe3ef] px-4 py-2.5 text-sm font-semibold text-slate-800">Thông báo</div>
            <ul className="max-h-96 divide-y divide-[#eef2f8] overflow-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href="/announcements" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-slate-50">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      {n.pinned && <Pin size={12} className="text-amber-600" />}
                      <span className="truncate">{n.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">{n.preview}</p>
                  </Link>
                </li>
              ))}
              {!hasItems && <li className="px-4 py-6 text-center text-sm text-slate-400">Chưa có thông báo</li>}
            </ul>
            <Link href="/announcements" onClick={() => setOpen(false)} className="block border-t border-[#dbe3ef] px-4 py-2.5 text-center text-sm font-medium text-[var(--vti-deep,#0A3CA8)] hover:bg-slate-50">
              Xem tất cả
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the bell into the header**

In `src/components/layout/header.tsx`:

Add the import (replace the lucide import to drop the now-unused `Bell`, and import the bell component):

```typescript
import { ChevronDown, Menu, Search, ShieldCheck } from "lucide-react";
import { NotificationBell, type NotificationItem } from "./notification-bell";
```

Update the `Header` signature to accept `notifications`:

```typescript
export function Header({ name, role, notifications, onMenuClick }: { name: string; role: Role; notifications: NotificationItem[]; onMenuClick: () => void }) {
```

Replace the existing static bell button block:

```typescript
        <button className="relative hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:block" aria-label="Thông báo">
          <Bell size={18} />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
```

with:

```typescript
        <NotificationBell items={notifications} />
```

- [ ] **Step 3: Thread the prop through ShellChrome**

In `src/components/layout/shell-chrome.tsx`:

Add the import:

```typescript
import type { NotificationItem } from "./notification-bell";
```

Add `notifications` to the props type and destructure it:

```typescript
export function ShellChrome({
  name,
  role,
  children,
  counts,
  notifications,
}: {
  name: string;
  role: Role;
  children: React.ReactNode;
  counts?: SidebarCounts;
  notifications: NotificationItem[];
}) {
```

Pass it to `Header`:

```typescript
      <Header name={name} role={role} notifications={notifications} onMenuClick={() => setOpen(true)} />
```

- [ ] **Step 4: Fetch notifications in the portal layout**

In `src/app/(portal)/layout.tsx`:

Add imports:

```typescript
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
```

Add an announcements query to the `Promise.all` (so it runs in parallel). Replace the destructuring + `Promise.all` block:

```typescript
  const [meetings, documents, wiki, topics, agents, aiAccounts] = await Promise.all([
    db.meeting.count(),
    db.document.count(),
    db.wikiPage.count(),
    db.topic.count(),
    db.aIAgent.count(),
    db.aIAccount.count(),
  ]);
```

with:

```typescript
  const [meetings, documents, wiki, topics, agents, aiAccounts, notifications] = await Promise.all([
    db.meeting.count(),
    db.document.count(),
    db.wikiPage.count(),
    db.topic.count(),
    db.aIAgent.count(),
    db.aIAccount.count(),
    db.announcement.findMany({
      where: activeAnnouncementWhere(),
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, body: true, pinned: true },
    }),
  ]);
  const notificationItems = notifications.map((n) => ({ id: n.id, title: n.title, preview: htmlToText(n.body), pinned: n.pinned }));
```

Pass it to `ShellChrome`:

```typescript
    <ShellChrome name={name ?? "User"} role={role} counts={{ meetings, documents, wiki, topics, agents, aiAccounts }} notifications={notificationItems}>
```

- [ ] **Step 5: Typecheck / build**

Run: `npm run lint && npm run build`
Expected: compiles with no type errors; `Header`/`ShellChrome` require the new `notifications` prop and the layout supplies it.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/notification-bell.tsx src/components/layout/header.tsx src/components/layout/shell-chrome.tsx src/app/\(portal\)/layout.tsx
git commit -m "feat: wire header notification bell to active announcements"
```

---

## Task 6: Documentation

**Files:**
- Modify: `d8-portal/CLAUDE.md`

- [ ] **Step 1: Update the data model note**

In `d8-portal/CLAUDE.md`, under "Community", update the `Announcement` description to:

```
`Announcement` (title, rich-text `body` (sanitized HTML), `pinned`, `active` ON/OFF status, author; no expiry — `active` controls visibility on home widget + header bell)
```

- [ ] **Step 2: Update the permissions note**

In the "Roles & permissions" section, add `announcement:manage` (MANAGERS) to the capabilities list, e.g. append to the capability enumeration:

```
`announcement:manage` (MANAGERS)
```

- [ ] **Step 3: Update the server-actions note**

Under "announcements" in the server actions list, update to:

```
- **announcements**: `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` — guard `announcement:manage` (MANAGERS), sanitize rich-text `body`, persist `active`/`pinned`. List page shows OFF rows to managers only; the portal header bell + home widget read active announcements.
```

- [ ] **Step 4: Update the lib note**

Under the `src/lib` reference, update the `announcements.ts` entry (or add it):

```
- **announcements.ts** — `activeAnnouncementWhere()` (`{ active: true }`) + `htmlToText(html)` (pure tag-strip for previews).
```

- [ ] **Step 5: Commit**

```bash
git add d8-portal/CLAUDE.md
git commit -m "docs: document notification module (active status, bell, manage capability)"
```

---

## Final verification

- [ ] Run the full unit suite: `npm test`
  Expected: PASS (permissions, announcements-lib, announcement-actions, and all existing specs).
- [ ] Run `npm run build`
  Expected: production build succeeds.
- [ ] Manual smoke (optional, `npm run dev`):
  - As a MANAGER: create a notification with rich text, Ghim ON, status ON → appears on `/announcements`, home widget, and header bell.
  - Toggle status OFF → disappears from home widget, bell, and the member list view; still visible (OFF badge) to managers on `/announcements`.
  - As a PM/MEMBER: no create/edit/delete controls; direct POST blocked by `requireManager`.

## Self-review notes

- **Spec coverage:** §1 data model → Task 1; §2 permissions → Task 1; §3 actions → Task 2; §4 rich text → Tasks 2–3; §5 pages → Task 3; §6 home widget → Task 4; §7 bell → Task 5; §8 tests → Tasks 1–2; §9 docs → Task 6. Acceptance criteria covered by Final verification.
- **Type consistency:** `AnnouncementFormData` (`title/body/pinned/active`) is defined in Task 1 and consumed identically in Tasks 2–3. `NotificationItem` (`id/title/preview/pinned`) defined in Task 5 Step 1 and used consistently in `Header`/`ShellChrome`/layout. `activeAnnouncementWhere()` is arg-less everywhere after Task 1. `htmlToText` signature stable across lib/actions/pages/layout.
