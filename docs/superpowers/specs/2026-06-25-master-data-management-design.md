# Master Data Management — Design

**Date:** 2026-06-25
**Status:** Approved (design)
**Area:** D8 Portal — new "Master Data" admin area

## Goal

Add a **Master Data** menu group (visible to Managers and above) that centralizes:

1. **Category management** — make the currently hardcoded category lists (Project, Document, Topic, Meeting, Meeting Section, Wiki) database-backed and editable; forms read them live.
2. **Member skills** — a Skill catalog plus per-member skill assignment with proficiency level.
3. **Certificates** — a CertificateType catalog plus per-member certificate records.

## Decisions (locked)

- Categories are **DB-backed and read directly by forms** (constants become seed + fallback).
- Skills use a **catalog + `UserSkill` with level 1–5**.
- Certificates use a **CertificateType catalog + per-member `UserCertificate`** records (type, issuer, dates, credential id, optional file).
- Access: **Managers and above** (ADMIN / DIVISION_LEADER / SECTION_MANAGER) via new capability `master-data:manage`. Members do not self-edit.
- Managed category types include **Wiki and Meeting Section** in addition to the four named domains.
- Keep a manual `order` field on categories (inline editable; no drag-drop in v1).

## 1. Navigation & permissions

- New capability `master-data:manage` added to `src/types/index.ts` `Capability` union and `src/lib/permissions.ts` `RULES` (= MANAGERS).
- New sidebar group **"Master Data"** in `src/components/layout/sidebar.tsx`, visible when `managerOnly(role)`, items:
  - **Danh mục** → `/master-data/categories` (icon `ListTree`)
  - **Skills** → `/master-data/skills` (icon `Wrench` / `Sparkles`)
  - **Chứng chỉ** → `/master-data/certificates` (icon `Award`)
  - **Hồ sơ thành viên** → `/master-data/members` (icon `IdCard`)
- Mirror the same entries in `src/lib/nav.ts` `NAV_ITEMS` (currently duplicated with the sidebar; keep both in sync). A `MANAGER_ONLY` visibility predicate already exists there.

## 2. Data model (`prisma/schema.prisma`)

```prisma
model MasterCategory {
  id        String   @id @default(cuid())
  type      String   // PROJECT | DOCUMENT | TOPIC | MEETING | MEETING_SECTION | WIKI
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
  level   Int    @default(1) // 1..5
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

`User` gains: `userSkills UserSkill[]` and `certificates UserCertificate[]`.

Migration via `npm run db:migrate` (prisma migrate dev). Prisma client regenerates to `src/generated/prisma`.

## 3. Category management & form integration

- New server-only helper `src/lib/master-data-db.ts`:
  - `CATEGORY_TYPES` constant + `CategoryType` type.
  - `getCategoryValues(type): Promise<string[]>` — returns active values ordered by `order, value`; **falls back to the matching constant list** in `master-data.ts` when the table has no rows for that type (forms never break).
  - `getCategoryMap(types[])` helper to fetch several at once for a page.
- Constant ↔ type mapping (seed + fallback source):
  - `PROJECT` ← `PROJECT_CATEGORIES`
  - `DOCUMENT` ← `DOCUMENT_CATEGORIES`
  - `TOPIC` ← topic categories (currently `["Kỹ thuật","Quản lý","Quy trình","Khách hàng","Đề xuất","Khác"]`, duplicated in `topics/page.tsx` and `topic-form.tsx` — consolidate into `master-data.ts` as `TOPIC_CATEGORIES`)
  - `MEETING` ← `MEETING_CATEGORIES`
  - `MEETING_SECTION` ← `MEETING_SECTIONS`
  - `WIKI` ← `WIKI_CATEGORIES`
- Forms changed to accept option arrays as **props** (default to the constant for safety), with their server pages calling `getCategoryValues`/`getCategoryMap`:
  - `meetings/meeting-form.tsx` (categories + sections) ← `meetings/new/page.tsx`, `meetings/[id]/edit/page.tsx`
  - `projects/project-form.tsx` (categories + sections) ← projects page
  - `knowledge/documents/document-upload-form.tsx` ← documents page
  - `knowledge/wiki/wiki-form.tsx` ← wiki new/edit pages
  - `topics/topic-form.tsx` + `topics/page.tsx`
  - `admin/page.tsx` section filter
- Pages: `/master-data/categories/page.tsx` lists categories grouped by type with inline add / edit value / toggle active / set order. Actions in `master-data/categories/actions.ts`.

## 4. Skills & Certificates pages

- `/master-data/skills` — CRUD Skill catalog (name, category, active). Actions: `createSkill`, `updateSkill`, `deleteSkill`.
- `/master-data/certificates` — CRUD CertificateType catalog (name, issuer, category, active). Actions: `createCertType`, `updateCertType`, `deleteCertType`.
- `/master-data/members` — paginated user list (reuse `Pagination`), link to `/master-data/members/[id]`.
- `/master-data/members/[id]` — manage one member's:
  - **Skills**: add skill (select from active catalog) + level 1–5; remove. Actions: `setUserSkill(userId, skillId, level)` (upsert), `removeUserSkill(userId, skillId)`.
  - **Certificates**: add record (select type, issuer, issuedAt, expiresAt, credentialId, optional file) + delete. Actions: `addUserCertificate(userId, form)`, `deleteUserCertificate(id)`. File upload reuses `uploadAttachmentFile` into `certificates/<userId>/<ts>_<name>`.

Level labels: 1 Beginner · 2 Basic · 3 Intermediate · 4 Advanced · 5 Expert (rendered from the int).

## 5. Server actions — guards

Every action file starts with a `requireMasterDataManager()` helper:
```ts
const session = await auth();
if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
```
Pages redirect to `/` when `!can(role, "master-data:manage")`. URL inputs validated; certificate `userId`/file path validated like `uploadAttachment` (cuid + sanitized filename).

## 6. Seed

`prisma/seed.ts` adds:
- `MasterCategory` rows for every constant list (idempotent upsert on `[type, value]` with incrementing `order`).
- A handful of sample `Skill` rows (e.g. Java, Spring Boot, AWS, React, PM) and `CertificateType` rows (e.g. AWS SAA, PMP, TOEIC) for demo.

## 7. Testing

- `tests/permissions.test.ts` — extend for `master-data:manage` (managers allowed, PM/MEMBER denied).
- `tests/nav.test.ts` — Master Data group visible to managers, hidden from PM/MEMBER.
- `tests/master-data-db.test.ts` — `getCategoryValues` returns DB rows ordered; falls back to constants when empty. (Mock `db`.)
- `tests/master-data-actions.test.ts` — auth-guard tests for each actions file (Forbidden for MEMBER/no session; allowed for ADMIN), mirroring existing `*-actions.test.ts` patterns.

## 8. Build order (incremental)

1. Models + migration + seed + `User` relations.
2. Capability + permissions + nav group (+ tests).
3. `master-data-db.ts` helper + `/master-data/categories` CRUD (+ test).
4. Convert forms/pages to DB-backed categories.
5. Skills catalog + member skill assignment.
6. Certificates catalog + member certificate records (with file upload).
7. Update `CLAUDE.md` system map (models, lib, actions, routes, nav).

## Out of scope (v1)

- Drag-drop reordering UI (manual `order` int only).
- Member self-service editing of own skills/certificates.
- Skill/certificate expiry notifications or dashboards.
- Bulk import/export.
