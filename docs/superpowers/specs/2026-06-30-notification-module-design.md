# Notification Module — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan
**Approach:** Extend the existing `Announcement` feature in place (no parallel/duplicate module).

## Context

The portal already ships an `Announcement` feature ("Thông báo") that covers ~60% of the
requested notification module:

- Existing: `title`, `body` (plain text), `pinned` (Ghim), `author` (người đăng),
  `createdAt` (ngày đăng), `expiresAt`, home-page widget, manager/editor CRUD.
- Missing/different: rich-text content, ON/OFF status, manager-only permission, and a
  functioning header bell (currently a decorative static red dot).

Decision: **extend Announcement** rather than build a separate model. One "Thông báo"
concept, no duplication.

### Key decisions (from brainstorming)

1. **Scope:** Extend the existing Announcement feature in place.
2. **Status:** Add ON/OFF (`active`); **remove** `expiresAt` (ON/OFF replaces the expiry
   concept). Managers toggle visibility manually.
3. **Bell:** Dropdown list of latest active notifications (pinned first), **no per-user
   read tracking**. Red dot shows only when active notifications exist. Items link to
   `/announcements`.
4. **Rich text:** Reuse the existing TinyMCE form pattern (`@tinymce/tinymce-react`
   `Editor`, served locally from `/public/tinymce`, same config as `wiki-form.tsx`) +
   server-side `sanitizeRichTextHtml`. List/home/bell previews show plain text stripped
   from the HTML.
5. **Permission:** New capability `announcement:manage` = MANAGERS
   (ADMIN / DIVISION_LEADER / SECTION_MANAGER; **excludes PM**). Viewing stays open to all.

### Out of scope (YAGNI)

Per-user read/unread state, real-time push, email/Google-Chat fanout, scheduled publish.

## 1. Data model (`prisma/schema.prisma`)

Modify `Announcement`:

- `body String` — now stores **sanitized rich-text HTML** (was plain text).
- **Remove** `expiresAt DateTime?`.
- **Add** `active Boolean @default(true)` — the ON/OFF status.
- Keep `title`, `pinned`, `authorId`/`author`, `createdAt`.
- Add `@@index([active, pinned, createdAt])`.

Generate a Prisma migration that drops `expiresAt` and adds `active`.

## 2. Permissions (`src/lib/permissions.ts`, `src/types/index.ts`)

- Add `Capability` value `"announcement:manage"`.
- Rule: `"announcement:manage": (r) => MANAGERS.includes(r)`.
- Announcement create/update/delete actions and the CRUD/edit pages switch their guard
  from `content:edit` → `announcement:manage`.
- `content:edit` is left unchanged (still used by wiki/documents/agents).
- Viewing (home widget, bell, `/announcements` list) is available to all roles; only
  managers see edit/create/delete controls and OFF items.

## 3. Server actions (`src/app/(portal)/announcements/actions.ts`)

- Replace `requireEditor` with `requireManager` using `announcement:manage`.
- Remove `parseExpiry`.
- `validate`: title required, body required (non-empty after strip).
- `createAnnouncement` / `updateAnnouncement`: run `body` through `sanitizeRichTextHtml`
  before persisting; persist `active` and `pinned`.
- `deleteAnnouncement`: logic unchanged (guard updated).
- All mutating actions `revalidatePath("/")` and `revalidatePath("/announcements")` so the
  bell and home widget refresh.

## 4. Rich text

- `announcement-form.tsx`: replace the plain `<textarea>` with the TinyMCE `Editor`
  (`@tinymce/tinymce-react`, `tinymceScriptSrc="/tinymce/tinymce.min.js"`, same `init`
  config as `wiki-form.tsx`); add an ON/OFF toggle; keep the Ghim checkbox; remove the
  expiry date input.
- Update `AnnouncementFormData` type (`src/types/community.ts`): drop `expiresAt`, add
  `active: boolean`.
- Body is sanitized server-side with `sanitizeRichTextHtml` before storage. List/home/bell
  previews render plain text stripped from the HTML (`htmlToText` helper) — no
  `dangerouslySetInnerHTML` needed for the preview surfaces.

## 5. Pages

- `/announcements` (`page.tsx`): replace the "Hết hạn" column with "Trạng thái"
  (ON/OFF badge). Managers see all rows (ON + OFF); members see ON only. Content cell shows
  a stripped/clamped text preview of the HTML.
- `/announcements/[id]/edit`: guard with `announcement:manage`; preload `active` into the
  form.

## 6. Home widget (`src/components/home/announcement-list.tsx`)

- Query `where: { active: true }`, order `[{ pinned: "desc" }, { createdAt: "desc" }]`,
  `take: 5`. Render a clamped rich-text preview.
- `src/lib/announcements.ts`: replace `activeAnnouncementWhere` (expiry-based) with an
  active-based helper (e.g. `activeAnnouncementWhere(): { active: true }`), keeping a pure,
  testable shape.

## 7. Header bell (`src/components/layout/header.tsx` + new component)

- New client component `src/components/layout/notification-bell.tsx`.
- The shell/layout fetches active notifications (pinned first, ~5) and passes them to the
  bell as props (no read tracking).
- Red dot renders only when there is ≥1 active notification.
- Click → dropdown listing the notifications; each item links to `/announcements`. Empty
  state handled gracefully.
- Replace the current static `<button>` + red dot in `header.tsx` with this component.

## 8. Tests (`tests/`)

- `announcement-actions.test.ts`: manager-only permission (PM rejected), HTML
  sanitization on create/update, `active` persisted, expiry removed.
- `announcements-lib.test.ts`: new active-filter helper.

## 9. Docs

- Update `d8-portal/CLAUDE.md`: `Announcement` model fields (rich-text body, `active`,
  no `expiresAt`), new `announcement:manage` capability, and header-bell wiring.

## Acceptance criteria

- A MANAGER can create, read, and update a notification with a rich-text body, an ON/OFF
  status, and a Ghim flag. A PM and a MEMBER cannot create/update/delete (server-guarded).
- Setting a notification OFF hides it from the home widget, the header bell, and the
  member view of `/announcements`; it remains visible to managers in the list.
- The header bell shows a red dot only when ≥1 active notification exists, and its dropdown
  lists the latest active notifications (pinned first), each linking to `/announcements`.
- Rich-text body is sanitized server-side before storage; rendering does not allow script
  injection.
- `expiresAt` is fully removed (schema, type, form, queries, tests).
