# User Excel Import — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design)
**Feature:** Import a list of users from an Excel file (like `D8_employee.xlsx`) on the "Quản lý người dùng" (`/admin`) screen. New users default to role MEMBER; existing emails are updated (not duplicated).

## 1. Summary

Add an "Import Excel" action to `/admin` that reads an `.xlsx` with columns **Name, Account, Date of Birth, Gender** and upserts users by email:
- Email = `{Account}@{ALLOWED_EMAIL_DOMAIN}` (e.g. `loi.buihuu@vti.com.vn`).
- New user → created with `role = MEMBER`.
- Existing email → only `name`, `dateOfBirth`, `gender` updated; **role and all other fields preserved**.
- Admin-only.

## 2. Source file shape

`D8_employee.xlsx`, first sheet, header row then ~146 data rows. Columns:
- `Name` → `User.name` (required).
- `Account` → email local-part (required); the file already disambiguates duplicates (e.g. `huong.dothithu`, `huong.dothithu1`).
- `Date of Birth` → `User.dateOfBirth`.
- `Gender` → `User.gender` (`Male` / `Female`).

## 3. Data model

Add two nullable fields to `User`:

```prisma
  dateOfBirth DateTime?
  gender      String?    // "Male" | "Female" | null
```

Migration `prisma/migrations/<ts>_user_dob_gender/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
```

## 4. Dependency

Add **`xlsx`** (SheetJS) to `package.json` dependencies. Used server-side only (in the import action). No client bundling.

## 5. Pure normalizer (`src/lib/user-import.ts`) — unit-tested

```ts
export type RawUserRow = Record<string, unknown>; // a row from XLSX sheet_to_json
export type NormalizedUserRow = {
  email: string;
  name: string;
  dateOfBirth: Date | null;
  gender: string | null; // "Male" | "Female" | null
};
export function normalizeUserImportRows(
  rawRows: RawUserRow[],
  domain: string,
): { rows: NormalizedUserRow[]; errors: string[] };
```

Rules:
- Read columns by header name: `Name`, `Account`, `Date of Birth`, `Gender` (trimmed string access).
- Skip a row when `Name` or `Account` is blank; push a Vietnamese note to `errors` (e.g. `Bỏ qua dòng N: thiếu Name hoặc Account`).
- `account = String(Account).trim().toLowerCase()`. `email = account.includes("@") ? account : \`${account}@${domain}\``.
- `name = String(Name).trim()`.
- `gender`: case-insensitive match → `"Male"` / `"Female"`; anything else → null.
- `dateOfBirth`: if value is a `Date` → use it; else if a non-empty string that `new Date(...)` parses to a valid date → that Date; else null.
- De-duplicate within the file by email (last row wins); note duplicates in `errors`.

## 6. Server action (`src/app/(portal)/admin/actions.ts`)

`importUsers(formData: FormData): Promise<{ created: number; updated: number; skipped: number; errors: string[] }>`:
1. Guard: `auth()` + `can(role, "admin:access")`; else throw `Forbidden`.
2. Read `formData.get("file")`; require a non-empty `.xlsx` File (else throw a validation error).
3. `const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { cellDates: true });` → `XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])`.
4. `normalizeUserImportRows(rawRows, process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn")`.
5. For each normalized row, `db.user.upsert({ where: { email }, create: { email, name, dateOfBirth, gender, role: "MEMBER" }, update: { name, dateOfBirth, gender } })`; tally created vs updated (an upsert that hits an existing email = updated). Implementation: check existence with a pre-count, or use `db.user.findUnique` per email to classify; counts are returned for the summary.
6. `revalidatePath("/admin")`; return the summary (skipped = blank/duplicate rows from the normalizer's errors).

Errors during a single row's DB write are caught and appended to `errors` (so one bad row doesn't abort the whole import).

## 7. UI

- **`src/app/(portal)/admin/import-users.tsx`** (client): an "Import Excel" button that reveals a `<input type="file" accept=".xlsx">` + a submit button; calls `importUsers(formData)` in a transition; renders the returned summary (`Đã tạo {created} · Cập nhật {updated} · Bỏ qua {skipped}`) and lists `errors`. On success, the revalidated page shows the new rows.
- **`/admin` page**: render `<ImportUsers />` in the page heading area; add two columns to the table — **Giới tính** (`gender ?? "-"`) and **Ngày sinh** (`dateOfBirth` formatted `YYYY-MM-DD` or "-"). Column order: Tên · Email · Section · Phân loại · Giới tính · Ngày sinh · Vai trò.

## 8. Testing

- `tests/user-import.test.ts`: email building from account + domain; account already containing `@` used as-is; blank Name/Account rows skipped with an error note; gender normalization (`male`→`Male`, `FEMALE`→`Female`, junk→null); DOB as Date passthrough, parseable string → Date, junk → null; in-file duplicate email de-dup (last wins).
- `tests/admin-action.test.ts` (extend): `importUsers` throws for a non-admin; for a new email, `upsert.create` includes `role: "MEMBER"`; for an existing email, `upsert.update` contains `name`/`dateOfBirth`/`gender` and **no `role`** key; the returned summary counts are correct.

## 9. Out of scope (YAGNI)

- CSV import / Google Sheets sync.
- Editing DOB/Gender through a form (only set via import for now).
- Deleting users not present in the file (import never deletes).
- Importing section/title/employeeType (not in the file).

## 10. Assumptions & decisions

- Email domain = `ALLOWED_EMAIL_DOMAIN` env (default `vti.com.vn`), matching `auth.ts`.
- Gender stored as a plain string (`"Male"`/`"Female"`), not a Prisma enum.
- DOB stored as `DateTime?`.
- Existing users: update name/dob/gender only; role and other fields preserved.
- Parser: SheetJS `xlsx`, server-side, first sheet, header-row keyed.
- Import is additive/idempotent: re-running the same file updates in place, never duplicates or deletes.
