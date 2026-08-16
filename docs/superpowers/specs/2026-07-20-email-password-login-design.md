# Email/Password Login — Design

Date: 2026-07-20
Status: Approved

## Goal

Add email + password login to the D8 Portal, alongside the existing Google OAuth login. Username = `User.email`. All users (existing + future) get a default password `Vti@1234` (hashed), which they can change themselves; admins can reset it back to the default.

## Non-goals

- No forced password change on first login.
- No password complexity policy beyond a simple minimum length.
- No "forgot password" / email-reset flow (admin reset covers this).

## Background constraint

NextAuth v5 (`next-auth@5.0.0-beta.31`, `@auth/core`) always encodes the session as a JWT for `Credentials`-type providers (`@auth/core/lib/actions/callback/index.js`), regardless of the configured `session.strategy`. Session *reads* (`@auth/core/lib/actions/session.js`), however, branch strictly on the global `session.strategy` option. With the current `strategy: "database"`, a credentials-authenticated session would be unreadable (cookie holds a JWT, but lookup queries the `Session` table for it) — the user would appear logged out immediately after a successful login.

Fix: switch the global session strategy to `"jwt"`. Confirmed no app code depends on the `Session` DB table beyond generated Prisma client boilerplate, so this is safe. Trade-off accepted: sessions can no longer be force-invalidated by deleting DB rows (only by cookie expiry or rotating `AUTH_SECRET`).

## Changes

### 1. Schema — `prisma/schema.prisma`

Add to `User`:
```prisma
password String?
```
Nullable at the schema level (safe migration); populated for every row by the backfill step below, so in practice always set after migration.

### 2. `src/lib/password.ts` (new)

```ts
export const DEFAULT_PASSWORD = "Vti@1234";
export async function hashPassword(plain: string): Promise<string>;
export async function verifyPassword(plain: string, hash: string): Promise<boolean>;
```
Implemented with `bcryptjs` (new dependency — pure JS, no native build step).

### 3. `src/lib/auth.ts`

- `session: { strategy: "jwt" }` (was `"database"`).
- New `Credentials` provider:
  - `authorize({ email, password })`: look up `User` by email; if not found, `password` column is null, email fails `isAllowedEmail` check, or `verifyPassword` fails → return `null` (generic failure, no detail on which check failed).
  - On success, return `{ id, email, name, role }`.
- `callbacks.jwt({ token, user })`: on initial sign-in (`user` present), copy `id`/`role` onto the token. Needed for both providers now that `session()` no longer receives the DB `user` argument.
- `callbacks.session({ session, token })`: copy `id`/`role` from token onto `session.user` (replaces the current DB-`user`-based version).
- `events.createUser({ user })`: set a hashed `DEFAULT_PASSWORD` on any newly adapter-created user (covers first-time Google sign-in), so every user can always fall back to password login.

### 4. Migration + backfill

- `prisma migrate dev --name add_user_password` — adds the nullable column.
- `scripts/backfill-default-passwords.ts` (new, one-off, idempotent): hash `DEFAULT_PASSWORD` once, then `db.user.updateMany({ where: { password: null }, data: { password: hash } })`. Add `db:backfill-password` npm script. Kept separate from `prisma/seed.ts` (which seeds fixed demo data, not real users).

### 5. Login page — `src/app/login/`

- Keep the existing Google button/server action untouched.
- Add `login-form.tsx` (client component, `useActionState`) with email + password fields.
- Add `actions.ts` with `credentialsSignIn(prevState, formData)`: calls `signIn("credentials", { email, password, redirectTo: "/" })`; catches `AuthError` and returns a Vietnamese error string ("Email hoặc mật khẩu không đúng."); rethrows any other error (including the internal `NEXT_REDIRECT` signal).

### 6. Self-service change password

- New route `src/app/(portal)/account/page.tsx` + `actions.ts`: form with current password, new password, confirm new password.
- `changePassword` server action: reads the session user id via `auth()`, verifies the current password against the stored hash, validates the new password (non-empty, minimum 6 chars), hashes and updates.
- `src/components/layout/header.tsx`: wrap the existing avatar/name block in a `Link` to `/account` (smallest change that surfaces the new page; no new dropdown menu).

### 7. Admin reset password

- `src/app/(portal)/admin/actions.ts`: `resetUserPassword(userId)`, guarded by `admin:access`, sets the user's password back to the hashed `DEFAULT_PASSWORD`.
- `/admin` user list: add a "Reset mật khẩu" button per row using the existing `confirm-button` UI component.

### 8. Excel import — `src/app/(portal)/admin/actions.ts`

- In `importUsers`, the `create:` branch of the `db.user.upsert` call gets `password: <hashed DEFAULT_PASSWORD>` so newly imported users can log in immediately.

## Error handling

- `authorize()` never throws for bad credentials — returns `null` so NextAuth surfaces a generic `CredentialsSignin` error, mapped to one Vietnamese message client-side. No distinction between "unknown email" and "wrong password" (avoids user enumeration).
- `changePassword` rejects with a specific message when the current password doesn't match, and a separate message when the new password fails the minimum-length check.

## Testing

- Unit: `src/lib/password.ts` (hash/verify roundtrip, wrong password rejected).
- Unit: `isAllowedEmail` reuse already covered; add a case in `auth`-related tests for `authorize()` rejecting a non-domain email even with a correct password hash (if a test seam is practical — otherwise cover via the login server-action test).
- Existing test suite (`tests/`) must continue to pass — in particular `role-sync`/`openai-agent`/`permissions` tests that may touch `auth.ts` mocks.
- Manual verification: Google login still works end-to-end; email/password login works for a backfilled user; wrong password shows the Vietnamese error; change-password flow rejects wrong current password and accepts a valid change; admin reset button restores the default password.
