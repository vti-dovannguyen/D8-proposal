# Weekly Report: Risks, Multi-file Attachments, Save Draft

## Context

The Weekly Report create/edit screen (`src/app/(portal)/meetings/new/page.tsx` and
`src/app/(portal)/meetings/[id]/edit/page.tsx`, both backed by the shared
`MeetingForm` in `src/app/(portal)/meetings/meeting-form.tsx`) currently supports
EE rows, RA rows, Division/Company Issues, and rich-text narrative fields. This
adds three requested capabilities:

1. A Risk management section on the create/edit form.
2. Multi-file attachment upload directly on the create/edit form (today,
   attachments can only be added after a meeting already exists, via the
   single-file uploader on the detail page).
3. A "Save Draft" button that persists an incomplete report without tripping
   today's required-field validation.

## 1. Risk management

### Data model

New `Risk` model, 1:N per meeting (cascade delete), following the same shape as
`MeetingEE`/`MeetingRA`:

```prisma
model Risk {
  id            String   @id @default(cuid())
  meetingId     String
  meeting       Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  category      String
  impact        Severity @default(MEDIUM)
  priority      Severity @default(MEDIUM)
  rootCause     String?
  status        String   @default("Open")
  actionPlan    String?
  supportNeeded String?
}
```

- `Meeting` gains `risks Risk[]`.
- `impact`/`priority` reuse the existing `Severity` enum (LOW/MEDIUM/HIGH/CRITICAL) —
  same scale already used for `Issue.severity`. No new enum.
- `category` and `status` are fixed string lists defined as UI constants
  (`RISK_CATEGORIES`, `RISK_STATUSES` in `src/lib/meetings.ts`), the same
  pattern `RA_STATUSES` already uses in `meeting-form.tsx` — no new Master
  Data type or admin screen.
  - `RISK_CATEGORIES = ["Technical", "Resource", "Schedule", "Budget", "External", "Quality", "Other"]`
  - `RISK_STATUSES = ["Open", "Mitigating", "Resolved", "Closed"]`

### Types

`src/types/meeting.ts`:

```ts
export type RiskInput = {
  title: string;
  description: string;
  category: string;
  impact: Severity;
  priority: Severity;
  rootCause: string;
  status: string;
  actionPlan: string;
  supportNeeded: string;
};
```

`MeetingFormData` gains `risks: RiskInput[]`.

### Form UI

A new `RiskEditor` component in `meeting-form.tsx`, placed after the Division/Company
Issues editors. Because a risk has 9 fields, each risk renders as a card (not a
table row, unlike EE/RA):

- Row 1: Title (text input), Category (select), Impact (select), Priority (select), Status (select).
- Below: Description, Root cause, Action Plan, Support Needed — each a small
  textarea, stacked or two-column grid.
- "+ Thêm risk" button adds a new empty card; each card has a "Xóa" button.

### Persistence

`createMeeting`/`updateMeeting` in `actions.ts` handle `risks` exactly like
`eeRows`: `create: form.risks` on create, `deleteMany: {}, create: form.risks`
on update.

### Detail view

`src/app/(portal)/meetings/[id]/page.tsx` gets a new read-only "Risks"
`SectionCard` (icon: reuse `TriangleAlert`, matching Issues), rendered as a list
of cards mirroring the form's fields, inserted after the Division/Company
Issues grid. Query includes `risks: true`.

## 2. Multi-file attachments on Create/Edit

### Form UI

`MeetingForm` gains a file-picker section (multiple files). Selected files are
staged client-side (name + size shown, each removable) — no upload happens
until the whole form is submitted, consistent with how EE/RA/Issue/Risk rows
are staged before submit.

### Submission contract change

`MeetingForm`'s `onSubmit` prop changes from

```ts
onSubmit: (data: MeetingFormData) => Promise<void>
```

to

```ts
onSubmit: (data: MeetingFormData, filesFormData: FormData) => Promise<void>
```

Files travel inside a `FormData` (each staged `File` appended under the key
`"files"`), matching the existing, already-working convention used by
`uploadAttachment(meetingId, formData: FormData)` — not as a raw `File[]`
argument.

### Server-side

`actions.ts` extracts a shared helper from today's `uploadAttachment`:

```ts
async function persistAttachments(meetingId: string, formData: FormData) {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${meetingId}/${Date.now()}_${safeName}`;
    await uploadAttachmentFile(path, file);
    await db.attachment.create({ data: { meetingId, fileName: file.name, fileUrl: path, fileSize: file.size } });
  }
}
```

`uploadAttachment` is refactored to call this helper. `createMeeting(form, filesFormData)`
calls it with the newly created meeting's id (after the `db.meeting.create`,
before `sendMeetingReportNotification`/redirect). `updateMeeting(id, form, filesFormData)`
calls it after `db.meeting.update` — existing attachments are untouched; new
files are appended.

The page-level wrapper actions in `new/page.tsx` and `[id]/edit/page.tsx`
(the inline `"use server"` closures passed as `onSubmit`) gain the second
`filesFormData` parameter and forward it.

The existing single-file "Tải lên" uploader on the detail page
(`attachment-upload.tsx`) is unchanged.

## 3. Save Draft

### Form UI

A second submit control, "Lưu nháp", next to "Lưu meeting":

- Rendered as `type="button"` (not `type="submit"`), always enabled — it does
  not check `isValid` / does not show the "missing fields" message.
- On click: submits `{ ...form, status: "DRAFT" }` (with `weekRange` still
  composed from `weekStart`/`weekEnd` if present) plus the staged files.
- Uses its own pending flag (or shares `pending`) so both buttons disable
  together while a submission is in flight.

### Server-side validation relaxation

`validate(form)` in `actions.ts`:

```ts
function validate(form: MeetingFormData) {
  if (form.status === "DRAFT") return; // drafts may be incomplete
  if (!form.week?.trim() || !meetingWeekRange(form) || !form.section?.trim() || !meetingCategory(form)) {
    throw new Error("Validation: week, weekRange and section are required");
  }
}
```

No schema change — `DRAFT` already exists on `MeetingStatus`. Draft saves
still go through `createMeeting`/`updateMeeting` normally (same redirect to
the detail page).

## Files touched

- `prisma/schema.prisma` (+ migration) — `Risk` model, `Meeting.risks`.
- `src/types/meeting.ts` — `RiskInput`, `MeetingFormData.risks`.
- `src/lib/meetings.ts` — `RISK_CATEGORIES`, `RISK_STATUSES` constants.
- `src/app/(portal)/meetings/meeting-form.tsx` — `RiskEditor`, file picker, Save Draft button, `onSubmit` signature change.
- `src/app/(portal)/meetings/actions.ts` — `persistAttachments` helper, `risks` persistence in create/update, relaxed `validate()`.
- `src/app/(portal)/meetings/new/page.tsx` — wrapper action signature, `risks: []` initial.
- `src/app/(portal)/meetings/[id]/edit/page.tsx` — wrapper action signature, `risks` mapped from `m.risks`.
- `src/app/(portal)/meetings/[id]/page.tsx` — read-only Risks `SectionCard`, `risks: true` include.
- `tests/meeting-actions.test.ts` — coverage for risk persistence, draft validation bypass, multi-file attachment persistence.

## Out of scope

- No delete/edit action for individual attachments (matches current behavior — none exists today).
- No Master Data admin screen for Risk category/status (fixed constants, per decision above).
- No change to the existing single-file uploader on the detail page.
