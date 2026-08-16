# Email/Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email + password login to the D8 Portal (username = `User.email`), alongside the existing Google login, with a default password `Vti@1234` for every user, self-service password change, and admin reset-to-default.

**Architecture:** NextAuth v5 `Credentials` provider added next to the existing `Google` provider; global session strategy switched from `"database"` to `"jwt"` (required — Auth.js always JWT-encodes Credentials sessions regardless of configured strategy, and session *reads* branch on the global strategy, so `"database"` would make credential logins unreadable). Passwords hashed with `bcryptjs`, stored on a new nullable `User.password` column, backfilled once for existing users via a standalone script.

**Tech Stack:** Next.js 16 App Router (Server Actions + Server Components), NextAuth v5 beta, Prisma 7 (`@prisma/adapter-pg`), `bcryptjs`, Vitest.

**Design doc:** `docs/superpowers/specs/2026-07-20-email-password-login-design.md`

## Global Constraints

- Default password for every user (existing + new): `Vti@1234` (exported as `DEFAULT_PASSWORD`).
- Password hashing library: `bcryptjs` (pure JS, no native build step).
- Minimum length for a user-chosen new password: 6 characters (exported as `MIN_PASSWORD_LENGTH`). No other complexity policy.
- No forced password change on first login.
- Google login stays exactly as-is (button + server action unchanged); Credentials is additive.
- Session strategy for the whole app: `"jwt"` (was `"database"`).
- All error messages shown to users are in Vietnamese, matching the rest of the UI.
- Generic failure message on bad login credentials — never reveal whether the email or the password was wrong.

---

### Task 1: Password hashing helper

**Files:**
- Modify: `package.json` (add `bcryptjs` dependency)
- Create: `src/lib/password.ts`
- Test: `tests/password.test.ts`

**Interfaces:**
- Produces: `DEFAULT_PASSWORD: string`, `MIN_PASSWORD_LENGTH: number`, `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` — all from `@/lib/password`, consumed by Tasks 2, 3, 5, 6, 7.

- [ ] **Step 1: Add the `bcryptjs` dependency**

Run: `npm install bcryptjs@^3.0.3`
Expected: `package.json` dependencies gain `"bcryptjs": "^3.0.3"`; `package-lock.json` updates; no other version changes.

- [ ] **Step 2: Write the failing test**

Create `tests/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_PASSWORD, MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";

describe("password helpers", () => {
  it("exports the default password and minimum length constants", () => {
    expect(DEFAULT_PASSWORD).toBe("Vti@1234");
    expect(MIN_PASSWORD_LENGTH).toBe(6);
  });

  it("hashes a password to something other than the plain value", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(hash).not.toBe("Vti@1234");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(await verifyPassword("Vti@1234", hash)).toBe(true);
  });

  it("rejects an incorrect password against a hash", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash on each call (random salt)", async () => {
    const hashA = await hashPassword("Vti@1234");
    const hashB = await hashPassword("Vti@1234");
    expect(hashA).not.toBe(hashB);
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `npx vitest run tests/password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/password'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/password.ts`:
```ts
import bcrypt from "bcryptjs";

export const DEFAULT_PASSWORD = "Vti@1234";
export const MIN_PASSWORD_LENGTH = 6;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/password.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/password.ts tests/password.test.ts
git commit -m "feat: add password hashing helper for email/password login"
```

---

### Task 2: Schema migration + default-password backfill

**Files:**
- Modify: `prisma/schema.prisma:60` (insert new field after `gender`)
- Create: `scripts/backfill-default-passwords.ts`
- Modify: `package.json` (add `db:backfill-password` script)

**Interfaces:**
- Consumes: `hashPassword`, `DEFAULT_PASSWORD` from `@/lib/password` (Task 1).
- Produces: `User.password String?` column, used by Task 3 (`authorizeCredentials`), Task 5 (`changePassword`), Task 6 (`resetUserPassword`), Task 7 (import).

- [ ] **Step 1: Add the schema field**

In `prisma/schema.prisma`, the `User` model currently reads (lines 49-61):
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  image         String?
  emailVerified DateTime?
  role          Role      @default(MEMBER)
  employeeType  EmployeeType @default(OFFICIAL)
  section       String?
  title         String?
  dateOfBirth   DateTime?
  gender        String?
  createdAt     DateTime  @default(now())
```
Change the `gender`/`createdAt` lines to:
```prisma
  gender        String?
  password      String?
  createdAt     DateTime  @default(now())
```

- [ ] **Step 2: Validate the schema compiles**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Create and apply the migration against the dev database**

Run: `npx prisma migrate dev --name add_user_password`
Expected: Prisma reports a new migration folder under `prisma/migrations/`, applies `ALTER TABLE "User" ADD COLUMN "password" TEXT;`, and regenerates the client. If the dev database is unreachable from this machine, stop here and run this step from an environment that has DB connectivity before continuing — later steps depend on the column existing.

- [ ] **Step 4: Write the backfill script**

Create `scripts/backfill-default-passwords.ts`:
```ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, DEFAULT_PASSWORD } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const hash = await hashPassword(DEFAULT_PASSWORD);
  const result = await db.user.updateMany({
    where: { password: null },
    data: { password: hash },
  });
  console.log(`✓ Backfilled default password for ${result.count} user(s).`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 5: Add the npm script**

In `package.json`, in `"scripts"`, add (after `"db:seed"`):
```json
    "db:backfill-password": "tsx scripts/backfill-default-passwords.ts",
```

- [ ] **Step 6: Run the backfill against the dev database**

Run: `npm run db:backfill-password`
Expected: `✓ Backfilled default password for N user(s).` where N is the current user count with a null password (all of them, the first time this runs). Running it again prints `0 user(s)` (idempotent).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/backfill-default-passwords.ts package.json
git commit -m "feat: add User.password column and default-password backfill script"
```

---

### Task 3: Credentials provider + JWT session strategy

**Files:**
- Modify: `src/lib/auth.ts` (full rewrite of the `NextAuth(...)` config)
- Modify: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword`, `DEFAULT_PASSWORD` from `@/lib/password` (Task 1); `db.user.findUnique`/`db.user.update` from `@/lib/db`.
- Produces: `authorizeCredentials(email: unknown, password: unknown): Promise<{ id: string; email: string; name: string | null; role: Role } | null>` and `backfillPasswordForNewUser(userId: string): Promise<void>`, both exported from `@/lib/auth` for direct unit testing. `isAllowedEmail` keeps its existing signature (Task 4/5/6 do not depend on it directly).

- [ ] **Step 1: Write the failing tests**

Replace `tests/auth.test.ts` with:
```ts
import { vi } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const verifyPasswordMock = vi.fn();
const hashPasswordMock = vi.fn();

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  DEFAULT_PASSWORD: "Vti@1234",
  verifyPassword: (...a: unknown[]) => verifyPasswordMock(...a),
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));

import { describe, it, expect, beforeEach } from "vitest";
import { isAllowedEmail, authorizeCredentials, backfillPasswordForNewUser } from "@/lib/auth";

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  verifyPasswordMock.mockReset();
  hashPasswordMock.mockReset();
  hashPasswordMock.mockResolvedValue("hashed-default");
});

describe("isAllowedEmail()", () => {
  it("allows the company domain", () => {
    expect(isAllowedEmail("phap.ledai@vti.com.vn", "vti.com.vn")).toBe(true);
  });
  it("rejects other domains", () => {
    expect(isAllowedEmail("someone@gmail.com", "vti.com.vn")).toBe(false);
  });
  it("rejects empty / malformed", () => {
    expect(isAllowedEmail("", "vti.com.vn")).toBe(false);
    expect(isAllowedEmail("nodomain", "vti.com.vn")).toBe(false);
  });
  it("is case-insensitive on domain", () => {
    expect(isAllowedEmail("Phap.LeDai@VTI.com.vn", "vti.com.vn")).toBe(true);
  });
});

describe("authorizeCredentials()", () => {
  it("returns null when email or password is missing", async () => {
    expect(await authorizeCredentials(undefined, "pw")).toBeNull();
    expect(await authorizeCredentials("a@vti.com.vn", undefined)).toBeNull();
    expect(await authorizeCredentials("", "")).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null for a non-string email or password", async () => {
    expect(await authorizeCredentials(123, "pw")).toBeNull();
    expect(await authorizeCredentials("a@vti.com.vn", 123)).toBeNull();
  });

  it("returns null when the email is outside the allowed domain", async () => {
    const result = await authorizeCredentials("someone@gmail.com", "pw");
    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null when no user exists for the email", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await authorizeCredentials("nobody@vti.com.vn", "pw");
    expect(result).toBeNull();
  });

  it("returns null when the user has no password set", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "MEMBER", password: null });
    const result = await authorizeCredentials("u1@vti.com.vn", "pw");
    expect(result).toBeNull();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("returns null when the password does not match", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "MEMBER", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(false);
    const result = await authorizeCredentials("u1@vti.com.vn", "wrong");
    expect(result).toBeNull();
  });

  it("returns the user when the password matches", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "PM", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(true);
    const result = await authorizeCredentials("u1@vti.com.vn", "correct");
    expect(result).toEqual({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "PM" });
  });
});

describe("backfillPasswordForNewUser()", () => {
  it("hashes the default password and updates the user", async () => {
    await backfillPasswordForNewUser("u2");
    expect(hashPasswordMock).toHaveBeenCalledWith("Vti@1234");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "u2" }, data: { password: "hashed-default" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL — `authorizeCredentials`/`backfillPasswordForNewUser` are not exported from `@/lib/auth` yet.

- [ ] **Step 3: Rewrite `src/lib/auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { DEFAULT_PASSWORD, hashPassword, verifyPassword } from "@/lib/password";
import type { Role } from "@/types";

export function isAllowedEmail(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return email.slice(at + 1).toLowerCase() === domain.toLowerCase();
}

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn";

export async function authorizeCredentials(
  email: unknown,
  password: unknown,
): Promise<{ id: string; email: string; name: string | null; role: Role } | null> {
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return null;
  }
  if (!isAllowedEmail(email, ALLOWED_DOMAIN)) return null;

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.password) return null;

  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

export async function backfillPasswordForNewUser(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(DEFAULT_PASSWORD) },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as never),
  // Trust the request host ONLY when explicitly enabled for the deployment
  // (self-hosted behind a trusted reverse proxy / internal network). Defaults
  // off so an untrusted host cannot spoof the Host header to hijack OAuth
  // callback URLs. Set AUTH_TRUST_HOST=true in that environment.
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => authorizeCredentials(credentials?.email, credentials?.password),
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user }) {
      return !!user.email && isAllowedEmail(user.email, ALLOWED_DOMAIN);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: Role }).role ?? "MEMBER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? "MEMBER";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) await backfillPasswordForNewUser(user.id);
    },
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth.test.ts`
Expected: PASS (all `isAllowedEmail`, `authorizeCredentials`, `backfillPasswordForNewUser` tests).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS — no other test file imports `session({ session, user })`-shaped mocks for `@/lib/auth` in a way that assumed the database strategy (confirm by reading failures if any appear, and fix the affected test's mock shape rather than production code).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts tests/auth.test.ts
git commit -m "feat: add Credentials provider and switch session strategy to JWT"
```

---

### Task 4: Login page — email/password form

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/login-form.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `signIn` from `@/lib/auth` (Task 3).
- Produces: none consumed by later tasks (leaf UI feature).

- [ ] **Step 1: Create the server action**

Create `src/app/login/actions.ts`:
```ts
"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function credentialsSignIn(_prevState: string, formData: FormData): Promise<string> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return "";
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email hoặc mật khẩu không đúng.";
    }
    throw error;
  }
}
```

- [ ] **Step 2: Create the client form component**

Create `src/app/login/login-form.tsx`:
```tsx
"use client";
import { useActionState } from "react";
import { credentialsSignIn } from "./actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(credentialsSignIn, "");
  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label htmlFor="email" className="text-xs font-medium text-slate-600">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="ten@vti.com.vn"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-xs font-medium text-slate-600">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--vti-deep,#0A3CA8)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Wire the form into the login page**

Replace `src/app/login/page.tsx` with:
```tsx
import { signIn } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[var(--vti-ink,#0B1B3B)] text-white">
      <div className="w-full max-w-sm rounded-xl bg-white text-slate-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold">PM Sharing Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Division D8 — VTI Group</p>
        // <!--<form
        //   action={async () => {
        //     "use server";
        //     await signIn("google", { redirectTo: "/" });
        //   }}
        //   className="mt-6"
        // >
        //   <button
        //     type="submit"
        //     className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-50"
        //   >
        //     Đăng nhập với Google
        //   </button>
        // </form>
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          hoặc
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <LoginForm />
        <p className="mt-4 text-xs text-slate-400">
          Chỉ dành cho email @vti.com.vn
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/login`.
Expected: Google button unchanged; below it, an email/password form; submitting a backfilled user's email + `Vti@1234` redirects to `/`; submitting a wrong password shows "Email hoặc mật khẩu không đúng." without navigating away.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/actions.ts src/app/login/login-form.tsx src/app/login/page.tsx
git commit -m "feat: add email/password form to the login page"
```

---

### Task 5: Self-service change password

**Files:**
- Create: `src/app/(portal)/account/actions.ts`
- Create: `src/app/(portal)/account/change-password-form.tsx`
- Create: `src/app/(portal)/account/page.tsx`
- Modify: `src/components/layout/header.tsx`
- Test: `tests/account-actions.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 3), `hashPassword`/`verifyPassword`/`MIN_PASSWORD_LENGTH` from `@/lib/password` (Task 1), `db.user.findUnique`/`db.user.update`.
- Produces: none consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `tests/account-actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const authMock = vi.fn();
const verifyPasswordMock = vi.fn();
const hashPasswordMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));
vi.mock("@/lib/password", () => ({
  MIN_PASSWORD_LENGTH: 6,
  verifyPassword: (...a: unknown[]) => verifyPasswordMock(...a),
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));

import { changePassword } from "../src/app/(portal)/account/actions";

const initialState = { error: "", success: false };

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  authMock.mockReset();
  verifyPasswordMock.mockReset();
  hashPasswordMock.mockReset();
  hashPasswordMock.mockResolvedValue("new-hash");
});

describe("changePassword", () => {
  it("throws Forbidden when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(
      changePassword(initialState, form({ currentPassword: "a", newPassword: "abcdef", confirmPassword: "abcdef" })),
    ).rejects.toThrow("Forbidden");
  });

  it("rejects a new password shorter than the minimum length", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await changePassword(initialState, form({ currentPassword: "a", newPassword: "abc", confirmPassword: "abc" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/6 ký tự/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await changePassword(
      initialState,
      form({ currentPassword: "a", newPassword: "abcdef", confirmPassword: "different" }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/khớp/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({ id: "u1", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(false);
    const res = await changePassword(
      initialState,
      form({ currentPassword: "wrong", newPassword: "abcdef", confirmPassword: "abcdef" }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/hiện tại không đúng/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the password hash when everything is valid", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({ id: "u1", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(true);
    const res = await changePassword(
      initialState,
      form({ currentPassword: "correct", newPassword: "abcdef", confirmPassword: "abcdef" }),
    );
    expect(res.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { password: "new-hash" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/account-actions.test.ts`
Expected: FAIL — `src/app/(portal)/account/actions.ts` doesn't exist yet.

- [ ] **Step 3: Write the server action**

Create `src/app/(portal)/account/actions.ts`:
```ts
"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";

export type ChangePasswordState = { error: string; success: boolean };

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`, success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Xác nhận mật khẩu không khớp.", success: false };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.password || !(await verifyPassword(currentPassword, user.password))) {
    return { error: "Mật khẩu hiện tại không đúng.", success: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { password: await hashPassword(newPassword) },
  });
  return { error: "", success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/account-actions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the client form**

Create `src/app/(portal)/account/change-password-form.tsx`:
```tsx
"use client";
import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: "", success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <div>
        <label htmlFor="currentPassword" className="text-xs font-medium text-slate-600">
          Mật khẩu hiện tại
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="text-xs font-medium text-slate-600">
          Mật khẩu mới
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-600">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Đổi mật khẩu thành công.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create the page**

Create `src/app/(portal)/account/page.tsx`:
```tsx
import { ChangePasswordForm } from "./change-password-form";

export default function AccountPage() {
  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tài khoản</h1>
          <p className="portal-page-subtitle">Đổi mật khẩu đăng nhập của bạn.</p>
        </div>
      </div>
      <div className="portal-table-card p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Link the header avatar to the new page**

In `src/components/layout/header.tsx`, replace this block (lines 57-61):
```tsx
        <div className="grid size-9 place-items-center rounded-full bg-[#0f46c8] text-sm font-bold text-white">{initials || "U"}</div>
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="max-w-40 truncate text-sm font-semibold text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{roleLabel(role)} - D8</div>
        </div>
```
with:
```tsx
        <Link href="/account" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
          <div className="grid size-9 place-items-center rounded-full bg-[#0f46c8] text-sm font-bold text-white">{initials || "U"}</div>
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="max-w-40 truncate text-sm font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{roleLabel(role)} - D8</div>
          </div>
        </Link>
```
(`Link` is already imported at the top of this file — no import change needed.)

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, log in, click the avatar/name in the header.
Expected: navigates to `/account`; submitting the current default password + a new 6+ char password shows "Đổi mật khẩu thành công."; a wrong current password shows "Mật khẩu hiện tại không đúng."

- [ ] **Step 9: Commit**

```bash
git add "src/app/(portal)/account" src/components/layout/header.tsx tests/account-actions.test.ts
git commit -m "feat: add self-service change-password page"
```

---

### Task 6: Admin reset-password button

**Files:**
- Modify: `src/app/(portal)/admin/actions.ts`
- Create: `src/app/(portal)/admin/reset-password-button.tsx`
- Modify: `src/app/(portal)/admin/page.tsx`
- Modify: `tests/admin-action.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `DEFAULT_PASSWORD` from `@/lib/password` (Task 1); `ConfirmButton` from `@/components/ui/confirm-button`.
- Produces: none consumed by later tasks.

- [ ] **Step 1: Write the failing test additions**

In `tests/admin-action.test.ts`, add the password mock alongside the existing mocks (after the `xlsx` mock, before the `// can() is pure` comment):
```ts
const hashPasswordMock = vi.fn();
vi.mock("@/lib/password", () => ({
  DEFAULT_PASSWORD: "Vti@1234",
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));
```
Update the import line to also pull in `resetUserPassword`:
```ts
import { updateUserRole, importUsers, resetUserPassword } from "../src/app/(portal)/admin/actions";
```
Add `hashPasswordMock.mockReset()` and `hashPasswordMock.mockResolvedValue("hashed-default");` inside the existing `beforeEach(...)` block.
Add a new `describe` block at the end of the file:
```ts
describe("resetUserPassword", () => {
  it("throws Forbidden for a non-admin and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(resetUserPassword("target")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("resets an existing user's password to the hashed default", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await resetUserPassword("target");
    expect(hashPasswordMock).toHaveBeenCalledWith("Vti@1234");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "target" }, data: { password: "hashed-default" } });
  });
});
```
Also extend the existing `"creates a new email with role MEMBER"` test to assert the password is set, and the existing `"updates an existing email without changing role"` test to assert it is *not* touched:
```ts
    expect(arg.create.password).toBe("hashed-default");
```
```ts
    expect(arg.update).not.toHaveProperty("password");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/admin-action.test.ts`
Expected: FAIL — `resetUserPassword` is not exported from `admin/actions.ts` yet; the new/extended assertions fail.

- [ ] **Step 3: Update the actions file**

In `src/app/(portal)/admin/actions.ts`, add the import (alongside the existing imports):
```ts
import { hashPassword, DEFAULT_PASSWORD } from "@/lib/password";
```
Add a new exported function after `updateUserRole`:
```ts
export async function resetUserPassword(userId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) {
    throw new Error("Forbidden");
  }
  await db.user.update({ where: { id: userId }, data: { password: await hashPassword(DEFAULT_PASSWORD) } });
  revalidatePath("/admin");
}
```
In `importUsers`, compute the default password hash once before the `for` loop (right after `const skipped = ...` line):
```ts
  const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
```
Then update the `upsert` call's `create` block to include it:
```ts
      await db.user.upsert({
        where: { email: r.email },
        create: {
          email: r.email,
          name: r.name,
          dateOfBirth: r.dateOfBirth,
          gender: r.gender,
          role: "MEMBER",
          password: defaultPasswordHash,
        },
        update: { name: r.name, dateOfBirth: r.dateOfBirth, gender: r.gender },
      });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/admin-action.test.ts`
Expected: PASS (all `updateUserRole`, `importUsers`, `resetUserPassword` tests).

- [ ] **Step 5: Create the button component**

Create `src/app/(portal)/admin/reset-password-button.tsx`:
```tsx
"use client";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { resetUserPassword } from "./actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  return (
    <ConfirmButton
      label="Reset mật khẩu"
      confirmLabel="Xác nhận reset?"
      onConfirm={() => resetUserPassword(userId)}
    />
  );
}
```

- [ ] **Step 6: Wire the button into the user list**

In `src/app/(portal)/admin/page.tsx`, add the import:
```tsx
import { ResetPasswordButton } from "./reset-password-button";
```
Change the table header row (line 66) from:
```tsx
            <tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Giới tính</th><th>Ngày sinh</th><th>Vai trò</th></tr>
```
to:
```tsx
            <tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Giới tính</th><th>Ngày sinh</th><th>Vai trò</th><th>Mật khẩu</th></tr>
```
Change the role cell block (line 81) from:
```tsx
                <td><RoleSelect userId={user.id} role={user.role} /></td>
```
to:
```tsx
                <td><RoleSelect userId={user.id} role={user.role} /></td>
                <td><ResetPasswordButton userId={user.id} /></td>
```
Change the empty-state `colSpan` (line 84) from `colSpan={7}` to `colSpan={8}`.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, log in as an ADMIN, open `/admin`.
Expected: a "Reset mật khẩu" button appears per row; clicking once arms it, clicking again resets that user's password to `Vti@1234` (verify by logging in as that user with the default password afterward).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(portal)/admin" tests/admin-action.test.ts
git commit -m "feat: add admin reset-to-default password action and button"
```

---

### Task 7: CLAUDE.md documentation sync

**Files:**
- Modify: `E:\PROJECTS\ACE\D8Portal\d8-portal\CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the `src/lib` function reference**

Add a new bullet after the `permissions.ts`, `nav.ts`, `auth.ts`, `auth-actions.ts` line:
```
- **password.ts** — `DEFAULT_PASSWORD` ("Vti@1234"), `MIN_PASSWORD_LENGTH` (6), `hashPassword(plain)` / `verifyPassword(plain, hash)` (bcryptjs). Used by `auth.ts` (Credentials provider + new-user backfill), the account change-password action, and the admin reset-password action.
```
Update the `auth.ts`/`auth-actions.ts` description to mention the Credentials provider and JWT strategy:
```
- **permissions.ts**, **nav.ts**, **auth-actions.ts** — see above. **auth.ts** — NextAuth config; `Google` + `Credentials` (email/password against `User.password`) providers; `session: { strategy: "jwt" }`; exports `isAllowedEmail`, `authorizeCredentials`, `backfillPasswordForNewUser` in addition to `handlers`/`auth`/`signIn`/`signOut`.
```

- [ ] **Step 2: Update the data model section**

In the `User` bullet under **Auth**, mention the new field:
```
`User` (role, `employeeType` OFFICIAL/INTERN, section, title, `dateOfBirth`, `gender`, `password` — bcrypt hash, nullable, defaults to `Vti@1234` for every user via a one-off backfill script).
```

- [ ] **Step 3: Update the server actions section**

Add to the **account** (new) and extend the **admin** bullet:
```
- **account** (new): `changePassword` — self-service password change; verifies the current password, validates the new one (min 6 chars, must match confirmation), updates the hash. Route `/account` — linked from the header avatar/name.
```
Extend the **admin** bullet to mention `resetUserPassword` alongside `updateUserRole`/`importUsers`.

- [ ] **Step 4: Update the commands section**

Add after `db:seed`:
```
`db:backfill-password` (one-off script — hashes `Vti@1234` and sets it for every user with a null password; safe to re-run, no-ops once all users have a password).
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document email/password login in CLAUDE.md"
```

---

## Post-plan verification

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — production build succeeds (confirms no type errors from the session/JWT callback changes).
- [ ] Manual smoke test per the design doc's Testing section: Google login still works; a backfilled user logs in with `Vti@1234`; wrong password shows the Vietnamese error; change-password flow works both ways; admin reset button restores the default.
