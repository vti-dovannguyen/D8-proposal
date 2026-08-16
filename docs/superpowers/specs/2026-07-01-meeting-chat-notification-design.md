# Weekly Meeting → Google Chat Notification — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Surface:** `src/lib/google-chat.ts` + `src/app/(portal)/meetings/actions.ts`.

## Context

When a PM creates a weekly meeting (weekly report) in the portal, the D8 team should get a
Google Chat notification. The project already has a Google Chat integration pattern:
`src/lib/google-chat.ts` exports `sendPointAwardCard`, which POSTs to
`process.env.GOOGLE_CHAT_WEBHOOK_URL`, is a no-op returning `false` when the env var is
unset, and never throws. This feature adds a parallel, simpler text notification for meeting
creation, using its own webhook.

### Data model reality

A `Meeting` is **section-level**: it has an `ownerId` (the creator = "PM phụ trách"), a
`section`, a `week`/`weekRange`, and multiple `MeetingEE` project rows. There is no single
project per meeting. Per the brainstorming decision, the notification uses the meeting's
**section** as the grouping (not a single project name).

### Decisions (from brainstorming)

1. **Trigger:** fire once inside `createMeeting`, for any status (DRAFT/OPEN/CLOSED). Editing
   or cloning does NOT notify.
2. **"Project" slot:** the distinct project names from the meeting's `MeetingEE` rows,
   joined by `", "`, plus the meeting's `section`. When the meeting has no EE rows, the
   `của dự án ...` clause is dropped.
3. **Webhook:** a NEW env var `MEETING_CHAT_WEBHOOK_URL` (separate from the point-award
   `GOOGLE_CHAT_WEBHOOK_URL`), so meeting notifications can target a different space.
4. **Format:** plain-text Google Chat message (`{ text }`), not Cards v2.

### Out of scope (YAGNI)

Per-section/per-project webhook routing, Cards v2 formatting, notify-on-edit/close/clone,
retry/queue, delivery tracking.

## Message

Plain text, Vietnamese:

> `PM {pmName} của dự án {projects} trong section {section} đã viết report weekly. <{meetingUrl}|Nhấn vào đây để xem chi tiết>.`

- `{projects}` = the distinct, non-empty `MeetingEE.project` names joined by `", "`.
- When there are no project rows, the `của dự án {projects}` clause is dropped:
  `PM {pmName} trong section {section} đã viết report weekly. <...>`.
- `<url|label>` is Google Chat's inline-link syntax.
- When `meetingUrl` is empty (APP_URL unset), the message degrades gracefully to the same
  sentence without the trailing link.

## 1. `src/lib/google-chat.ts` (extend)

- `buildMeetingReportMessage(p: { pmName: string; projects: string[]; section: string; meetingUrl: string }): { text: string }`
  — pure. Joins `p.projects` (already distinct/non-empty) with `", "`; when empty, drops the
  `của dự án ...` clause. Includes the `<url|label>` link only when `p.meetingUrl` is a
  non-empty string.
- `sendMeetingReportNotification(p): Promise<boolean>` — reads
  `process.env.MEETING_CHAT_WEBHOOK_URL`; returns `false` immediately when unset (no-op);
  otherwise POSTs `JSON.stringify(buildMeetingReportMessage(p))` with
  `Content-Type: application/json` and returns `res.ok`; wraps the fetch in try/catch and
  logs via `console.error`, never throwing. Mirrors `sendPointAwardCard` exactly aside from
  the env var and the `{ text }` payload.

## 2. `src/app/(portal)/meetings/actions.ts` (wire in)

- Extend `requireEditor()` to also return the session user's display name:
  `{ id: string; role: Role; name: string }` where `name = session.user.name ?? "PM"`.
  (Additive; the other actions that call `requireEditor` ignore the new field.)
- In `createMeeting`, after `const created = await db.meeting.create(...)` and BEFORE
  `redirect(...)`, insert:

  ```ts
  const projects = [...new Set(form.eeRows.map((r) => r.project.trim()).filter(Boolean))];
  await sendMeetingReportNotification({
    pmName: user.name,
    projects,
    section: created.section,
    meetingUrl: process.env.APP_URL ? `${process.env.APP_URL}/meetings/${created.id}` : "",
  });
  ```

  Awaited (the POST is quick and the sender cannot throw), so it completes before the
  Next redirect unwinds. `updateMeeting`, `closeMeeting`, and `cloneMeeting` are unchanged.

## 3. Environment

- `MEETING_CHAT_WEBHOOK_URL` (optional) — Google Chat incoming-webhook URL for weekly-meeting
  notifications. Unset → the feature silently no-ops.
- `APP_URL` (already used by point-award) — needed to build the absolute meeting link; unset →
  message still sends, without a link.

## 4. Tests

- `tests/google-chat.test.ts`: add cases for `buildMeetingReportMessage`:
  - Produces the exact sentence with `pmName`, joined `projects`, and `section` interpolated,
    including `<{url}|Nhấn vào đây để xem chi tiết>` when `meetingUrl` is provided.
  - Drops the `của dự án ...` clause when `projects` is `[]`.
  - Omits the link (link-less fallback sentence) when `meetingUrl` is `""`.

## 5. Docs

- `CLAUDE.md`: add `buildMeetingReportMessage` + `sendMeetingReportNotification` to the
  `google-chat.ts` lib entry; note that `createMeeting` fires the meeting-report notification;
  add `MEETING_CHAT_WEBHOOK_URL` to the env-vars section.

## Acceptance criteria

- Creating a meeting POSTs a plain-text message to `MEETING_CHAT_WEBHOOK_URL` reading
  `PM {creator name} của dự án {projects} trong section {section} đã viết report weekly.`
  (with the `của dự án ...` clause dropped when there are no EE rows) and a clickable
  "Nhấn vào đây để xem chi tiết" link to `{APP_URL}/meetings/{id}`.
- With `MEETING_CHAT_WEBHOOK_URL` unset, meeting creation still succeeds and no request is
  made (no error).
- With `APP_URL` unset, the message sends without a link.
- Editing, closing, or cloning a meeting does not send a notification.
- The sender never throws — a webhook failure never breaks meeting creation.
- `buildMeetingReportMessage` is pure and unit-tested.
