# Production Deploy — D8 PM Sharing Portal

## Overview
Next.js 16 app on **Vercel**, backed by an existing **Supabase** project (Postgres + Storage).
No database migration is required: the schema (`20260618032049_init`) is already applied to the
Supabase database, and Sprints 2–5 added none. Deploy points the same code at the same Supabase project.

## Prerequisites (human)
- A Vercel account with access to the target team.
- Owner access to the Supabase project (URL + service-role key already in local `.env.local`).
- Access to the Google Cloud Console OAuth client used for `next-auth` (to add the production redirect URI).

## 1. Import the project into Vercel
1. Vercel dashboard → Add New → Project → import the Git repo (or `vercel link` from the repo root after `vercel login`).
2. Framework preset: **Next.js** (auto-detected; `vercel.json` pins it). Region: **sin1**.

## 2. Environment variables (Production scope)
Set each of these in Vercel → Project → Settings → Environment Variables (Production):

| Variable | Value / source |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (port 6543, `?pgbouncer=true`) — same as local `.env.local` |
| `AUTH_SECRET` | a fresh strong secret (`npx auth secret`) — do NOT reuse the dev value |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `ALLOWED_EMAIL_DOMAIN` | `vti.com.vn` |
| `NEXT_PUBLIC_APP_URL` | the production URL, e.g. `https://d8-portal.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret (server-only) |
| `SUPABASE_STORAGE_BUCKET` | `meeting-attachments` |

**Note on migrations:** No migration runs at deploy time (the schema is already applied to the Supabase DB). If you ever need to run `prisma migrate` against production, `prisma.config.ts` derives the migration connection from `DATABASE_URL` (rewrites the pooler port and strips `pgbouncer`), so a separate `DIRECT_URL` is not required.

## 3. Google OAuth redirect URI
In the Google Cloud Console OAuth client, add an **Authorized redirect URI**:
`https://<production-domain>/api/auth/callback/google`
(and the matching JavaScript origin `https://<production-domain>`). Keep the existing localhost entry for dev.

## 4. Supabase checks
- Confirm the `meeting-attachments` Storage bucket exists and is **Private** (run `node scripts/check-storage.mjs` locally against the prod env to verify).
- No SQL/migration step is needed.

## 5. Deploy
- `vercel --prod` (or click Deploy in the dashboard). First build runs `prisma generate` via the postinstall/build (confirm `npm run build` passes locally first).

## 6. Post-deploy smoke checklist
- `GET https://<domain>/api/health` → `{"status":"ok"}` (200).
- Visit `/` unauthenticated → redirected to `/login`.
- Log in with a `@vti.com.vn` Google account → lands on Home.
- Create a meeting; upload an attachment; reopen the detail → the attachment link downloads (signed-on-read).
- Create a wiki page (Tiptap) and a topic; search; bookmark; check My Workspace.
- Post an announcement → appears on Home; set an expiry in the past → it disappears from the list.

## 7. Rollback
- Vercel → Deployments → promote the previous successful deployment, or `vercel rollback`.

## 8. Follow-ups (post-launch)
- Add a tuned `Content-Security-Policy` header (omitted at launch to avoid breaking Next's inline runtime).
- Wire `/api/health` to an uptime monitor.
- Storage cleanup job for orphaned objects (document version-bump/delete; see S3–S4 debt notes).
