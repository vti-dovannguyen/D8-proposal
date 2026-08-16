# User Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Import Excel" feature to `/admin` that upserts users from an `.xlsx` (columns Name, Account, Date of Birth, Gender) — new users get role MEMBER, existing emails update name/DOB/gender (role preserved).

**Architecture:** Add `User.dateOfBirth` + `gender`. A pure normalizer maps raw sheet rows → `{email,name,dateOfBirth,gender}`. A server action parses the upload with SheetJS, normalizes, and upserts by email. A client component drives the upload and shows a summary; the admin table gains two columns.

**Tech Stack:** Next.js 16 Server Actions, Prisma 7, SheetJS (`xlsx`), Vitest.

## Global Constraints

- Email = `{Account}@{domain}` where `domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn"` (matches `src/lib/auth.ts`). If `Account` already contains `@`, use it as-is.
- Upsert by `email` (User.email is unique). New → `create` with `role: "MEMBER"`. Existing → `update` with `name`/`dateOfBirth`/`gender` ONLY (no `role` key — never change an existing user's role or other fields).
- Import never deletes users absent from the file; re-running the same file is idempotent.
- `gender` stored as plain string `"Male"`/`"Female"` (or null); `dateOfBirth` as `DateTime?`.
- Admin-only: `importUsers` guards `auth()` + `can(role, "admin:access")`, throwing `new Error("Forbidden")` otherwise (existing pattern in `admin/actions.ts`).
- SheetJS used server-side only. `src/generated/prisma` is gitignored (never add it).
- UI text Vietnamese. Tests via `npm test`; lint changed files with `npx eslint <files>` (`npm run lint` is pre-existing-broken in Next 16.2).
- Migration SQL style matches existing `prisma/migrations/` files.

---

### Task 1: Add `User.dateOfBirth` + `gender` (schema + migration)

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)
- Create: `prisma/migrations/20260630030000_user_dob_gender/migration.sql`

**Interfaces:**
- Produces: `User.dateOfBirth DateTime?`, `User.gender String?`.

- [ ] **Step 1: Add the fields**

In `model User { ... }`, add after the `title String?` line:

```prisma
  title         String?
  dateOfBirth   DateTime?
  gender        String?
```

- [ ] **Step 2: Write the migration**

Create `prisma/migrations/20260630030000_user_dob_gender/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
```

- [ ] **Step 3: Regenerate the client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client ... to .\src\generated\prisma`

- [ ] **Step 4: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 5: Apply the migration**

Run: `npx prisma migrate deploy`
Expected: applies `20260630030000_user_dob_gender` (or already applied). If DB unreachable, note it and continue.

- [ ] **Step 6: Commit** (do NOT add `src/generated/prisma`)

```bash
git add prisma/schema.prisma prisma/migrations/20260630030000_user_dob_gender
git commit -m "feat: add User.dateOfBirth and gender"
```

---

### Task 2: Pure normalizer (`src/lib/user-import.ts`)

**Files:**
- Create: `src/lib/user-import.ts`
- Test: `tests/user-import.test.ts`

**Interfaces:**
- Produces:
  - `type RawUserRow = Record<string, unknown>`
  - `type NormalizedUserRow = { email: string; name: string; dateOfBirth: Date | null; gender: string | null }`
  - `normalizeUserImportRows(rawRows: RawUserRow[], domain: string): { rows: NormalizedUserRow[]; errors: string[] }`

- [ ] **Step 1: Write the failing test**

Create `tests/user-import.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeUserImportRows } from "@/lib/user-import";

const D = "vti.com.vn";

describe("normalizeUserImportRows", () => {
  it("builds email from account + domain and trims/lowercases", () => {
    const { rows } = normalizeUserImportRows([{ Name: "Bùi Hữu Lợi", Account: " Loi.BuiHuu " }], D);
    expect(rows[0]).toMatchObject({ email: "loi.buihuu@vti.com.vn", name: "Bùi Hữu Lợi" });
  });
  it("uses an account that already contains @ as-is", () => {
    const { rows } = normalizeUserImportRows([{ Name: "X", Account: "x@other.com" }], D);
    expect(rows[0].email).toBe("x@other.com");
  });
  it("skips rows missing Name or Account with an error note", () => {
    const { rows, errors } = normalizeUserImportRows(
      [{ Name: "", Account: "a.b" }, { Name: "Y", Account: "" }, { Name: "Z", Account: "z.z" }],
      D,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("z.z@vti.com.vn");
    expect(errors).toHaveLength(2);
  });
  it("normalizes gender case-insensitively, junk -> null", () => {
    const { rows } = normalizeUserImportRows(
      [{ Name: "A", Account: "a", Gender: "male" }, { Name: "B", Account: "b", Gender: "FEMALE" }, { Name: "C", Account: "c", Gender: "x" }],
      D,
    );
    expect(rows.map((r) => r.gender)).toEqual(["Male", "Female", null]);
  });
  it("passes a Date through, parses a date string, junk -> null", () => {
    const d = new Date("1995-03-02");
    const { rows } = normalizeUserImportRows(
      [{ Name: "A", Account: "a", "Date of Birth": d },
       { Name: "B", Account: "b", "Date of Birth": "1990-01-15" },
       { Name: "C", Account: "c", "Date of Birth": "not-a-date" }],
      D,
    );
    expect(rows[0].dateOfBirth).toEqual(d);
    expect(rows[1].dateOfBirth?.getUTCFullYear()).toBe(1990);
    expect(rows[2].dateOfBirth).toBeNull();
  });
  it("de-duplicates by email within the file (last wins) and notes it", () => {
    const { rows, errors } = normalizeUserImportRows(
      [{ Name: "First", Account: "dup" }, { Name: "Second", Account: "dup" }],
      D,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Second");
    expect(errors.some((e) => /dup@vti\.com\.vn/.test(e))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `npx vitest run tests/user-import.test.ts`
Expected: FAIL — cannot resolve `@/lib/user-import`.

- [ ] **Step 3: Implement `src/lib/user-import.ts`**

```ts
export type RawUserRow = Record<string, unknown>;
export type NormalizedUserRow = {
  email: string;
  name: string;
  dateOfBirth: Date | null;
  gender: string | null;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function normGender(v: unknown): string | null {
  const g = str(v).toLowerCase();
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return null;
}

function normDob(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeUserImportRows(
  rawRows: RawUserRow[],
  domain: string,
): { rows: NormalizedUserRow[]; errors: string[] } {
  const errors: string[] = [];
  const byEmail = new Map<string, NormalizedUserRow>();
  rawRows.forEach((raw, i) => {
    const lineNo = i + 2; // sheet header is row 1
    const name = str(raw["Name"]);
    const account = str(raw["Account"]).toLowerCase();
    if (!name || !account) {
      errors.push(`Bỏ qua dòng ${lineNo}: thiếu Name hoặc Account`);
      return;
    }
    const email = account.includes("@") ? account : `${account}@${domain}`;
    if (byEmail.has(email)) errors.push(`Trùng email trong file: ${email} (dùng dòng cuối)`);
    byEmail.set(email, {
      email,
      name,
      dateOfBirth: normDob(raw["Date of Birth"]),
      gender: normGender(raw["Gender"]),
    });
  });
  return { rows: [...byEmail.values()], errors };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `npx vitest run tests/user-import.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-import.ts tests/user-import.test.ts
git commit -m "feat: add user-import row normalizer"
```

---

### Task 3: Install SheetJS + `importUsers` server action

**Files:**
- Modify: `package.json` / `package-lock.json` (add `xlsx`)
- Modify: `src/app/(portal)/admin/actions.ts`
- Test: `tests/admin-action.test.ts`

**Interfaces:**
- Consumes: `normalizeUserImportRows`; `User.dateOfBirth`/`gender`; `xlsx`.
- Produces: `importUsers(formData: FormData): Promise<{ created: number; updated: number; skipped: number; errors: string[] }>`.

- [ ] **Step 1: Install SheetJS**

Run: `npm install xlsx`
Expected: adds `xlsx` to `dependencies`; lockfile updated; no errors.

- [ ] **Step 2: Extend the test file (mocks + cases) — write first**

In `tests/admin-action.test.ts`, replace the `xlsx`-less setup. Add a settable rows fixture and mocks, and extend the db mock. Replace lines 3–16 (the mock block + imports + beforeEach) with:

```ts
const updateMock = vi.fn();
const upsertMock = vi.fn();
const findUniqueMock = vi.fn();
const authMock = vi.fn();
let sheetRows: Record<string, unknown>[] = [];

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({ db: { user: {
  update: (...a: unknown[]) => updateMock(...a),
  upsert: (...a: unknown[]) => upsertMock(...a),
  findUnique: (...a: unknown[]) => findUniqueMock(...a),
} } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("xlsx", () => ({
  read: () => ({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } }),
  utils: { sheet_to_json: () => sheetRows },
}));
// can() is pure — do NOT mock it; use the real implementation.

import { updateUserRole, importUsers } from "../src/app/(portal)/admin/actions";

beforeEach(() => {
  updateMock.mockReset();
  upsertMock.mockReset();
  findUniqueMock.mockReset();
  authMock.mockReset();
  sheetRows = [];
  upsertMock.mockResolvedValue({ id: "x" });
});

function xlsxForm() {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([1, 2, 3])], "users.xlsx"));
  return fd;
}
```

Then add a new describe block at the end of the file:

```ts
describe("importUsers", () => {
  it("throws Forbidden for a non-admin and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await expect(importUsers(xlsxForm())).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("creates a new email with role MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(null);
    sheetRows = [{ Name: "Bùi Hữu Lợi", Account: "loi.buihuu", Gender: "Male" }];
    const res = await importUsers(xlsxForm());
    const arg = upsertMock.mock.calls[0][0] as { where: { email: string }; create: Record<string, unknown> };
    expect(arg.where.email).toBe("loi.buihuu@vti.com.vn");
    expect(arg.create.role).toBe("MEMBER");
    expect(arg.create.gender).toBe("Male");
    expect(res.created).toBe(1);
    expect(res.updated).toBe(0);
  });
  it("updates an existing email without changing role", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ id: "existing" });
    sheetRows = [{ Name: "Updated Name", Account: "loi.buihuu" }];
    const res = await importUsers(xlsxForm());
    const arg = upsertMock.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(arg.update).toHaveProperty("name", "Updated Name");
    expect(arg.update).toHaveProperty("dateOfBirth");
    expect(arg.update).toHaveProperty("gender");
    expect(arg.update).not.toHaveProperty("role");
    expect(res.updated).toBe(1);
    expect(res.created).toBe(0);
  });
  it("rejects when no file is provided", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(importUsers(new FormData())).rejects.toThrow(/file/i);
  });
});
```

- [ ] **Step 3: Run the tests — expect fail**

Run: `npx vitest run tests/admin-action.test.ts`
Expected: FAIL — `importUsers` is not exported yet.

- [ ] **Step 4: Add `importUsers` to `src/app/(portal)/admin/actions.ts`**

Add the imports at the top (after the existing imports):

```ts
import * as XLSX from "xlsx";
import { normalizeUserImportRows, type RawUserRow } from "@/lib/user-import";
```

Append this function at the end of the file:

```ts
export async function importUsers(
  formData: FormData,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) throw new Error("Forbidden");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: chưa chọn file");

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet) as RawUserRow[];

  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn";
  const { rows, errors } = normalizeUserImportRows(rawRows, domain);
  const skipped = rawRows.length - rows.length;

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    try {
      const existing = await db.user.findUnique({ where: { email: r.email }, select: { id: true } });
      await db.user.upsert({
        where: { email: r.email },
        create: { email: r.email, name: r.name, dateOfBirth: r.dateOfBirth, gender: r.gender, role: "MEMBER" },
        update: { name: r.name, dateOfBirth: r.dateOfBirth, gender: r.gender },
      });
      if (existing) updated++;
      else created++;
    } catch (e) {
      errors.push(`Lỗi với ${r.email}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  revalidatePath("/admin");
  return { created, updated, skipped, errors };
}
```

- [ ] **Step 5: Run the tests — expect pass**

Run: `npx vitest run tests/admin-action.test.ts`
Expected: PASS (existing `updateUserRole` cases + new `importUsers` cases).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json "src/app/(portal)/admin/actions.ts" tests/admin-action.test.ts
git commit -m "feat: add importUsers server action (Excel upsert by email)"
```

---

### Task 4: UI — import button + admin table columns

**Files:**
- Create: `src/app/(portal)/admin/import-users.tsx` (client)
- Modify: `src/app/(portal)/admin/page.tsx`

**Interfaces:**
- Consumes: `importUsers` from `./actions`; `User.dateOfBirth`/`gender`.
- Produces: route `/admin` renders the importer + two new columns.

- [ ] **Step 1: Create the client importer**

Create `src/app/(portal)/admin/import-users.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { importUsers } from "./actions";

type Result = { created: number; updated: number; skipped: number; errors: string[] };

export function ImportUsers() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    setError("");
    setResult(null);
    if (!file) { setError("Chưa chọn file"); return; }
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      try {
        setResult(await importUsers(fd));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] bg-white px-4 text-sm font-semibold text-slate-700"
      >
        Import Excel
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-slate-700">Import danh sách người dùng (.xlsx)</p>
          <input
            type="file"
            accept=".xlsx"
            className="block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Đang nhập…" : "Tải lên"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="text-sm text-slate-700">
              <p>Đã tạo {result.created} · Cập nhật {result.updated} · Bỏ qua {result.skipped}</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-amber-700">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the admin page + add columns**

In `src/app/(portal)/admin/page.tsx`:

(a) Add the import near the other imports:

```tsx
import { ImportUsers } from "./import-users";
```

(b) Add a date formatter just before the `export default async function AdminPage(`:

```tsx
function fmtDate(d: Date | null) { return d ? d.toISOString().slice(0, 10) : "-"; }
```

(c) In the page heading block, place the importer next to the user count. Replace:

```tsx
        <span className="text-sm text-slate-500">{total} user</span>
```

with:

```tsx
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{total} user</span>
          <ImportUsers />
        </div>
```

(d) Add the two header cells — replace:

```tsx
            <tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Vai trò</th></tr>
```

with:

```tsx
            <tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Giới tính</th><th>Ngày sinh</th><th>Vai trò</th></tr>
```

(e) Add the two body cells — immediately AFTER the "Phân loại" `<td>...</td>` block (the one containing `EMPLOYEE_TYPE_LABELS`) and BEFORE the `<td><RoleSelect .../></td>`, insert:

```tsx
                <td className="portal-table-muted">{user.gender ?? "-"}</td>
                <td className="portal-table-muted">{fmtDate(user.dateOfBirth)}</td>
```

(f) Update the empty-state colSpan — change `colSpan={5}` to `colSpan={7}` in the "Không có user phù hợp" row.

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint "src/app/(portal)/admin/import-users.tsx" "src/app/(portal)/admin/page.tsx"`
Expected: no output (clean).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/admin/import-users.tsx" "src/app/(portal)/admin/page.tsx"
git commit -m "feat: add Excel import button and DOB/gender columns to admin users"
```

---

### Task 5: Docs + full verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

- In the **Data model → Auth** bullet, add `dateOfBirth`/`gender` to the `User` field list.
- In the **`src/lib` function reference**, add: `` **user-import.ts** — `normalizeUserImportRows(rawRows, domain)` (pure): maps Excel rows (Name/Account/Date of Birth/Gender) → `{email,name,dateOfBirth,gender}`, builds email `{account}@{domain}`, skips blanks, de-dups by email. ``
- In **Server actions → admin**, add: `importUsers(formData)` — admin-only; parses an `.xlsx` (SheetJS), upserts users by email (new → role MEMBER; existing → name/DOB/gender only). Note the new `/admin` "Import Excel" button + Giới tính/Ngày sinh columns.
- In the **Stack** section, add `xlsx` (SheetJS) for server-side Excel parsing.

- [ ] **Step 2: Full suite**

Run: `npm test`
Expected: all tests pass (user-import + admin-action included).

- [ ] **Step 3: Lint changed source + typecheck**

Run: `npx eslint src/lib/user-import.ts "src/app/(portal)/admin/actions.ts" "src/app/(portal)/admin/import-users.tsx" "src/app/(portal)/admin/page.tsx"`
Expected: no output.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document user Excel import"
```

---

## Self-Review

**Spec coverage:**
- `dateOfBirth`/`gender` fields + migration → Task 1. ✓
- `xlsx` dependency → Task 3 Step 1. ✓
- Pure normalizer (email build, skip blanks, gender, DOB, dedup) → Task 2. ✓
- `importUsers` action (admin guard, parse, normalize, upsert create MEMBER / update name+dob+gender only, counts) → Task 3. ✓
- UI importer + summary + DOB/Gender columns → Task 4. ✓
- Tests for normalizer + action → Tasks 2, 3. ✓
- Docs → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; commands list expected output.

**Type consistency:** `RawUserRow`/`NormalizedUserRow`/`normalizeUserImportRows` and the action's `{created,updated,skipped,errors}` shape are used identically across Tasks 2–4 and their tests. The upsert `create` includes `role: "MEMBER"`; `update` omits `role`, matching the spec and the action test assertions.
