# Point Award — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design)
**Feature:** A "Point Award" menu for recognizing individuals and projects with monthly points, an attractive Google Chat notification, and a public monthly leaderboard.

## 1. Summary

Add a **Point Award** feature to the D8 Portal:

- **Screen 1 — Create award** (`/point-award/new`, managers only): SM/DL/Admin award points (0–100) to a **person** or a **project** for a given **month**, with a reason, and optionally push an attractive **Google Chat Card v2** notification.
- **Screen 2 — Leaderboard** (`/point-award`, all roles): per-month ranking, podium (Top 1/2/3) + ranked list from #4, split into **Cá nhân / Dự án** tabs. Managers can delete rows inline.

Each (month + target) has at most one award; re-creating **upserts** (overwrites points/reason). Postgres NULL-distinct unique indexes enforce "one ranking per person/project per month".

## 2. Roles & permissions

- **Create / delete awards:** `MANAGERS` = ADMIN, DIVISION_LEADER, SECTION_MANAGER. New capability `point:award`.
- **View leaderboard:** all authenticated roles (recognition/motivation). The create button and form are gated by `point:award`; the delete action is gated by `point:award`.

## 3. Data model (`prisma/schema.prisma`)

```prisma
enum PointAwardType { PERSON, PROJECT }

model PointAward {
  id          String   @id @default(cuid())
  month       String   // "YYYY-MM" (consistent with UnitMonthly)
  type        PointAwardType
  userId      String?  // set when type = PERSON
  user        User?    @relation("PointAwardTarget", fields: [userId], references: [id], onDelete: Cascade)
  projectId   String?  // set when type = PROJECT
  project     Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  points      Int      // 0..100, integer
  reason      String
  notified    Boolean  @default(false)   // was a Google Chat message sent
  notifiedAt  DateTime?
  createdById String                      // the awarder (SM/DL/Admin)
  createdBy   User     @relation("PointAwardCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([month, userId])     // one award per person per month (NULLs distinct → project rows unaffected)
  @@unique([month, projectId])  // one award per project per month
  @@index([month, type])
}
```

Back-relations:
- `User` → `pointAwards PointAward[] @relation("PointAwardTarget")` and `pointAwardsCreated PointAward[] @relation("PointAwardCreatedBy")`.
- `Project` → `pointAwards PointAward[]`.

**Invariants** (enforced in the server action, not by schema alone):
- `type = PERSON` ⇒ `userId` set, `projectId` null.
- `type = PROJECT` ⇒ `projectId` set, `userId` null.
- `points` integer, `0 ≤ points ≤ 100`.
- `reason` non-empty.
- `month` matches `^\d{4}-(0[1-9]|1[0-2])$`.

Migration: `prisma/migrations/<ts>_point_award/` — `CREATE TYPE "PointAwardType"`, `CREATE TABLE "PointAward"`, two unique indexes, one composite index, FKs.

## 4. Navigation (`src/lib/nav.ts`)

Add: `{ label: "Point Award", href: "/point-award", icon: "Trophy", visible: ALL }`. (`Trophy` is a lucide icon; `Award` is already used by Chứng chỉ.)

## 5. Library helpers

### `src/lib/point-award.ts` (pure, unit-tested)

- `rankAwards(rows)` — sort by `points` desc, tie-break by `createdAt` asc (earlier award ranks higher on ties).
- `splitPodium(rows)` — `{ podium: rows[0..2], rest: rows[3..] }`.
- `formatMonth("YYYY-MM")` → `"Tháng 6/2026"`.
- `validatePoints(value)` — integer 0..100, throws on invalid.

### `src/lib/google-chat.ts`

- `buildPointAwardCard(payload)` — **pure**, returns a Google Chat **Cards v2** JSON object. Payload: `{ targetName, targetKind: "PERSON"|"PROJECT", points, reason, monthLabel, awarderName, leaderboardUrl, avatarUrl? }`. Card includes 🏆 header ("VINH DANH ĐIỂM THƯỞNG" + month), a section with avatar/icon, the target name, a bold **+N điểm** badge, the reason, "— by {awarder}", and a "Xem bảng xếp hạng" button linking to the leaderboard.
- `sendPointAwardCard(payload)` — builds the card and `POST`s it to `process.env.GOOGLE_CHAT_WEBHOOK_URL`. **No-ops and returns `false` when the env var is unset** (mirrors the `openai-agent` mock-fallback so local/dev without a webhook never errors). Returns `true` on a 2xx response; logs and returns `false` on failure (never throws — a notification failure must not fail award creation).

## 6. Server actions (`src/app/(portal)/point-award/actions.ts`)

- `createPointAward(input)`:
  - Guard `point:award` (else throw `Forbidden`).
  - Validate invariants (Section 3).
  - **Upsert** keyed on the target: for PERSON use `@@unique([month, userId])`, for PROJECT use `@@unique([month, projectId])`. Persist `points`, `reason`, `createdById = session.user.id`.
  - If `sendNotification === true` **and** the webhook env is set → call `sendPointAwardCard(...)`; on success set `notified = true`, `notifiedAt = now`. Notification failure is swallowed (logged), award still saved.
  - `revalidatePath("/point-award")`.
- `deletePointAward(id)`:
  - Guard `point:award`; delete; `revalidatePath("/point-award")`.

## 7. Screen 1 — Create form (`/point-award/new`, managers only)

Server page guards `point:award` (redirect otherwise), loads user list (`User`) and active projects (`Project` where active). Client form fields, top-to-bottom:

1. **Tháng** — `<input type="month">`, default current month (`YYYY-MM`).
2. **Loại** — radio: Cá nhân / Dự án.
3. **Target** (conditional): Cá nhân → user `<select>` (name); Dự án → project `<select>` (active projects from master data).
4. **Point** — `<input type="number" min=0 max=100 step=1>`.
5. **Lý do** — `<textarea>`, required.
6. **Gửi thông báo Google Chat** — Yes/No toggle, **default Yes**.
7. **Tạo** — submit.

Client validation mirrors the server (points 0–100 int, reason required, target required for the chosen type). On success → redirect to `/point-award`.

## 8. Screen 2 — Leaderboard (`/point-award`, all roles)

- **Month filter** — `<input type="month">`, default current month; drives the server query (via search param, like `/admin` filters).
- **Tabs** — Cá nhân / Dự án (filter `type`).
- **Podium (Top 1/2/3)** — three highlighted cards: avatar (`User.image` or initials; projects show a `FolderKanban` icon), **points badge**, name, truncated reason (full reason visible in the list / on hover).
- **List from #4** — table: rank · name · points · reason · awarder name · 🗑 delete (managers only).
- **Empty state** — message when the selected month/tab has no awards.
- Managers also see "＋ Tạo thưởng" → `/point-award/new`.

## 9. Testing

- `tests/point-award-lib.test.ts` — `rankAwards` ordering + tie-break, `splitPodium` boundaries (0/1/2/3/4 rows), `formatMonth`, `validatePoints` bounds, `buildPointAwardCard` JSON shape (header, points badge, button URL).
- `tests/point-award-actions.test.ts` — MEMBER blocked (create + delete), validation failures, upsert invoked with correct key, notification **gated by both** the `sendNotification` flag and webhook env (not sent when flag off; not sent / no-op when env unset; `notified` set when sent), award still saved when notification fails.

## 10. Docs

Update `CLAUDE.md` system map: new `PointAward` model + `PointAwardType` enum, `point-award.ts` + `google-chat.ts` lib entries, point-award server actions, nav item, `point:award` capability, and the `GOOGLE_CHAT_WEBHOOK_URL` env var.

## 11. Assumptions & decisions

- `points` is an integer 0–100 (Min 0 allowed per requirement).
- `month` stored as `"YYYY-MM"`, consistent with `UnitMonthly`.
- Target modeled as one table + `type` enum + two nullable FKs (Approach A).
- Re-award for same (month, target) overwrites (upsert).
- Leaderboard public; create/delete = managers.
- Google Chat = **Cards v2**; webhook env var = `GOOGLE_CHAT_WEBHOOK_URL`; missing env → notification silently skipped.
- Notification default = **Yes** on the form.
- Notification failures never block award creation.

## 12. Out of scope (YAGNI)

- Per-user point history / cumulative all-time totals across months.
- Editing an award through a dedicated edit screen (re-create = upsert covers it).
- Configurable webhook per section/team (single global webhook).
- Reactions/comments on awards.
