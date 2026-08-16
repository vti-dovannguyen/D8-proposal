# Weekly Report: Risks, Multi-file Attachments, Save Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Risk management section, multi-file attachment upload, and a "Save Draft" button to the Weekly Report create/edit screen.

**Architecture:** A new `Risk` Prisma model (1:N per meeting, cascade delete) persisted the same way `MeetingEE`/`Issue` rows are today. Multi-file attachments travel from the shared `MeetingForm` to `createMeeting`/`updateMeeting` as a `FormData` (same convention as the existing single-file uploader), uploaded via a shared helper after the meeting record is written. "Save Draft" is a second submit path that forces `status: "DRAFT"` and skips server-side required-field validation for that status only.

**Tech Stack:** Next.js 16.2 App Router + Server Actions, Prisma 7 (`@prisma/adapter-pg`), Vitest.

## Global Constraints

- Follow existing Vietnamese UI copy conventions in `meeting-form.tsx` / `[id]/page.tsx` (labels, buttons, error text are Vietnamese).
- `Impact`/`Priority` reuse the existing `Severity` enum (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) — do not add a new enum.
- `RISK_CATEGORIES` and `RISK_STATUSES` are fixed UI constants in `src/lib/meetings.ts`, not Master Data — no new admin screen.
- Multi-file uploads use the key `"files"` in a `FormData`; the existing single-file uploader (`attachment-upload.tsx`, key `"file"`) is untouched.
- `createMeeting`/`updateMeeting` gain an **optional** second/third `filesFormData?: FormData` parameter so all existing call sites (including the test suite) that don't pass files keep compiling and passing.
- No delete/edit action for individual attachments (matches current behavior).
- Task order matters here: the shared `MeetingForm` component's `onSubmit` prop type must be updated (Task 4) *before* the two page wrappers that call it with the new two-argument signature (Tasks 5-6) — otherwise the `<MeetingForm onSubmit={action} />` JSX call site in those pages fails `tsc` because the component still declares a one-argument callback.

---

### Task 1: Prisma schema — `Risk` model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `Risk` with fields `id, meetingId, meeting, title, description, category, impact, priority, rootCause, status, actionPlan, supportNeeded`; `Meeting.risks Risk[]`. Prisma Client exposes this as `db.risk` and `db.meeting.create/update({ data: { risks: { create: [...] } } })`.

- [ ] **Step 1: Add the `Risk` model and `Meeting.risks` relation**

In `prisma/schema.prisma`, find the `Meeting` model (starts at line ~126) and add a `risks` field next to the existing `raRows`/`divisionIssues` relations:

```prisma
model Meeting {
  id             String        @id @default(cuid())
  week           String
  weekRange      String
  weekStart      DateTime?
  weekEnd        DateTime?
  category       String        @default("Weekly")
  status         MeetingStatus @default(DRAFT)
  section        String
  ownerId        String
  owner          User          @relation(fields: [ownerId], references: [id])
  projectId      String?
  project        Project?      @relation(fields: [projectId], references: [id])
  execSummary    String?
  teamSummary    String?
  opportunities  String?
  otherInfo      String?
  additionalNote String?
  eeRows         MeetingEE[]
  raRows         MeetingRA[]
  risks          Risk[]
  divisionIssues Issue[]       @relation("DivisionIssues")
  companyIssues  Issue[]       @relation("CompanyIssues")
  attachments    Attachment[]
  // ...rest of the model is unchanged
}
```

Then add the new model directly after `model MeetingRA { ... }` (before `model Issue`):

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

- [ ] **Step 2: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name add_risk_model`
Expected: a new folder appears under `prisma/migrations/` (e.g. `2026...add_risk_model`) and the command ends with "Your database is now in sync with your schema." The Prisma Client is regenerated automatically as part of this command.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Risk model for weekly report risk tracking"
```

---

### Task 2: Risk UI constants

**Files:**
- Modify: `src/lib/meetings.ts`
- Test: `tests/meetings-lib.test.ts`

**Interfaces:**
- Produces: `RISK_CATEGORIES: string[]`, `RISK_STATUSES: string[]` exported from `@/lib/meetings`.

- [ ] **Step 1: Write the failing test**

Add to `tests/meetings-lib.test.ts` (add `RISK_CATEGORIES, RISK_STATUSES` to the import from `@/lib/meetings` at the top, then add a new `describe` block at the end of the file):

```ts
describe("risk constants", () => {
  it("exposes a fixed, non-empty list of risk categories", () => {
    expect(RISK_CATEGORIES.length).toBeGreaterThan(0);
    expect(RISK_CATEGORIES).toContain("Technical");
  });
  it("exposes a fixed, non-empty list of risk statuses starting with Open", () => {
    expect(RISK_STATUSES[0]).toBe("Open");
    expect(RISK_STATUSES).toContain("Closed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/meetings-lib.test.ts`
Expected: FAIL with "RISK_CATEGORIES is not defined" (or similar import error).

- [ ] **Step 3: Add the constants**

In `src/lib/meetings.ts`, add after the existing `SUMMARY_WEEKLY_CATEGORY` export (line 7):

```ts
/** Fixed risk category list for the Weekly Report Risk section (not Master-Data-driven). */
export const RISK_CATEGORIES = ["Technical", "Resource", "Schedule", "Budget", "External", "Quality", "Other"];

/** Fixed risk status list for the Weekly Report Risk section. */
export const RISK_STATUSES = ["Open", "Mitigating", "Resolved", "Closed"];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/meetings-lib.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/meetings.ts tests/meetings-lib.test.ts
git commit -m "feat: add RISK_CATEGORIES and RISK_STATUSES constants"
```

---

### Task 3: Types + `actions.ts` — risks persistence, multi-file attachments, draft validation bypass

**Files:**
- Modify: `src/types/meeting.ts`
- Modify: `src/app/(portal)/meetings/actions.ts`
- Test: `tests/meeting-actions.test.ts`

**Interfaces:**
- Consumes: `Risk` Prisma model from Task 1 (nested write via `db.meeting.create/update({ data: { risks: { create/set } } })`); `uploadAttachmentFile(path, file)` from `@/lib/storage` (already imported in `actions.ts`).
- Produces:
  - `RiskInput` type (exported from `@/types/meeting`): `{ title: string; description: string; category: string; impact: Severity; priority: Severity; rootCause: string; status: string; actionPlan: string; supportNeeded: string }`.
  - `MeetingFormData.risks: RiskInput[]` (required field, same shape family as `eeRows`).
  - `createMeeting(form: MeetingFormData, filesFormData?: FormData): Promise<void>`.
  - `updateMeeting(id: string, form: MeetingFormData, filesFormData?: FormData): Promise<void>`.
  - Internal helper `persistAttachmentFiles(meetingId: string, files: File[]): Promise<void>` (not exported, used by `createMeeting`/`updateMeeting`/`uploadAttachment`).

- [ ] **Step 1: Add `RiskInput` type and `risks` field**

In `src/types/meeting.ts`, add after `IssueInput` (line 5):

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

Add `risks: RiskInput[];` to `MeetingFormData`, right after `raRows: RARow[];` (line 22):

```ts
  eeRows: EERow[];
  raRows: RARow[];
  risks: RiskInput[];
  divisionIssues: IssueInput[];
  companyIssues: IssueInput[];
```

- [ ] **Step 2: Write the failing tests**

In `tests/meeting-actions.test.ts`:

1. Add `risks: []` to the `validForm` fixture (line ~49), right after `raRows: []`:

```ts
const validForm: MeetingFormData = {
  week: "Tuần 25", weekRange: "15/06 – 19/06/2026", section: "D8.1", status: "DRAFT",
  execSummary: "s", teamSummary: "t", opportunities: "o", otherInfo: "", additionalNote: "",
  eeRows: [{ project: "A", plan: 100, actual: 90, note: "" }],
  raRows: [], risks: [], divisionIssues: [], companyIssues: [],
};
```

2. Add these new `describe` blocks at the end of the file:

```ts
describe("createMeeting risks", () => {
  it("persists risk rows alongside the meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    const risks = [
      {
        title: "Vendor delay", description: "d", category: "External", impact: "HIGH" as const,
        priority: "MEDIUM" as const, rootCause: "r", status: "Open", actionPlan: "a", supportNeeded: "s",
      },
    ];
    await expect(createMeeting({ ...validForm, risks })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { risks: { create: unknown[] } } };
    expect(arg.data.risks.create).toEqual(risks);
  });
});

describe("createMeeting draft validation bypass", () => {
  it("allows an incomplete DRAFT to be saved without required fields", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, week: "", weekRange: "", status: "DRAFT" })).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
  it("still requires week/weekRange when status is not DRAFT", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, week: "", status: "OPEN" })).rejects.toThrow("Validation");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("createMeeting multi-file attachments", () => {
  it("uploads every staged file under the new meeting id", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }));
    fd.append("files", new File([new Uint8Array([2])], "b.png", { type: "image/png" }));
    await expect(createMeeting(validForm, fd)).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(uploadAttachmentFileMock).toHaveBeenCalledTimes(2);
    expect(attachmentCreate).toHaveBeenCalledTimes(2);
    const firstPath = attachmentCreate.mock.calls[0][0].data.fileUrl as string;
    expect(firstPath.startsWith("new1/")).toBe(true);
  });
  it("does nothing when no filesFormData is passed", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting(validForm)).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(uploadAttachmentFileMock).not.toHaveBeenCalled();
    expect(attachmentCreate).not.toHaveBeenCalled();
  });
});

describe("updateMeeting multi-file attachments", () => {
  it("uploads staged files against the existing meeting id", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "u3" });
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([1])], "c.pdf", { type: "application/pdf" }));
    await expect(updateMeeting("m1", validForm, fd)).rejects.toThrow("REDIRECT:/meetings/m1");
    expect(uploadAttachmentFileMock).toHaveBeenCalledTimes(1);
    const path = attachmentCreate.mock.calls[0][0].data.fileUrl as string;
    expect(path.startsWith("m1/")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/meeting-actions.test.ts`
Expected: FAIL — `arg.data.risks` undefined, and the draft/attachment tests fail because `createMeeting`/`updateMeeting` don't yet accept a second/third argument or persist risks.

- [ ] **Step 4: Implement `persistAttachmentFiles`, risks persistence, draft validation bypass**

In `src/app/(portal)/meetings/actions.ts`:

1. Add the shared helper right after the `validate` function (after line 76):

```ts
async function persistAttachmentFiles(meetingId: string, files: File[]) {
  for (const file of files) {
    if (file.size === 0) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${meetingId}/${Date.now()}_${safeName}`;
    await uploadAttachmentFile(path, file);
    await db.attachment.create({ data: { meetingId, fileName: file.name, fileUrl: path, fileSize: file.size } });
  }
}

function filesFrom(formData: FormData | undefined, key: string): File[] {
  if (!formData) return [];
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}
```

2. Relax `validate` (replace the existing function, lines 72-76):

```ts
function validate(form: MeetingFormData) {
  if (form.status === "DRAFT") return; // drafts may be incomplete
  if (!form.week?.trim() || !meetingWeekRange(form) || !form.section?.trim() || !meetingCategory(form)) {
    throw new Error("Validation: week, weekRange and section are required");
  }
}
```

3. Update `createMeeting`'s signature and body (replace lines 78-127):

```ts
export async function createMeeting(form: MeetingFormData, filesFormData?: FormData) {
  const user = await requireEditor();
  validate(form);
  await assertProjectAccess(user.role, user.id, form.projectId || null, user.id);
  const created = await db.meeting.create({
    data: {
      week: form.week.trim(),
      weekRange: meetingWeekRange(form),
      weekStart: parseWeekDate(form.weekStart),
      weekEnd: parseWeekDate(form.weekEnd),
      category: meetingCategory(form),
      section: form.section.trim(),
      status: form.status,
      execSummary: sanitizeRichTextHtml(form.execSummary),
      teamSummary: sanitizeRichTextHtml(form.teamSummary),
      opportunities: sanitizeRichTextHtml(form.opportunities),
      otherInfo: sanitizeRichTextHtml(form.otherInfo),
      additionalNote: form.additionalNote,
      ownerId: user.id,
      projectId: form.projectId || null,
      eeRows: { create: form.eeRows },
      raRows: { create: form.raRows },
      risks: { create: form.risks },
      divisionIssues: {
        create: form.divisionIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
      companyIssues: {
        create: form.companyIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
    },
  });
  await persistAttachmentFiles(created.id, filesFrom(filesFormData, "files"));
  const projects = [...new Set(form.eeRows.map((r) => r.project.trim()).filter(Boolean))];
  await sendMeetingReportNotification({
    pmName: user.name,
    projects,
    section: created.section,
    meetingUrl: process.env.APP_URL ? `${process.env.APP_URL}/meetings/${created.id}` : "",
  });
  revalidatePath("/meetings");
  redirect(`/meetings/${created.id}`);
}
```

4. Update `updateMeeting`'s signature and body (replace lines 129-180):

```ts
export async function updateMeeting(id: string, form: MeetingFormData, filesFormData?: FormData) {
  const user = await requireEditor();
  validate(form);
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  if (!canEditMeeting(user.role, existing.status)) {
    throw new Error("This meeting is locked (CLOSED)");
  }
  await assertProjectAccess(user.role, user.id, existing.projectId, existing.ownerId);
  await assertProjectAccess(user.role, user.id, form.projectId || null, existing.ownerId);
  await db.meeting.update({
    where: { id },
    data: {
      week: form.week.trim(),
      weekRange: meetingWeekRange(form),
      weekStart: parseWeekDate(form.weekStart),
      weekEnd: parseWeekDate(form.weekEnd),
      category: meetingCategory(form),
      section: form.section.trim(),
      status: form.status,
      execSummary: sanitizeRichTextHtml(form.execSummary),
      teamSummary: sanitizeRichTextHtml(form.teamSummary),
      opportunities: sanitizeRichTextHtml(form.opportunities),
      otherInfo: sanitizeRichTextHtml(form.otherInfo),
      additionalNote: form.additionalNote,
      projectId: form.projectId || null,
      eeRows: { deleteMany: {}, create: form.eeRows },
      raRows: { deleteMany: {}, create: form.raRows },
      risks: { deleteMany: {}, create: form.risks },
      divisionIssues: {
        set: [],
        create: form.divisionIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
      companyIssues: {
        set: [],
        create: form.companyIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
    },
  });
  await persistAttachmentFiles(id, filesFrom(filesFormData, "files"));
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  redirect(`/meetings/${id}`);
}
```

5. Simplify `uploadAttachment` to reuse the helper (replace the body from `const safeName = ...` through `await db.attachment.create(...)`, lines 332-337):

```ts
export async function uploadAttachment(meetingId: string, formData: FormData) {
  const user = await requireEditor();
  if (!/^[a-z0-9]{20,}$/i.test(meetingId)) throw new Error("Validation: bad meeting id");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: no file");

  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Not found");
  if (!canEditMeeting(user.role, meeting.status)) {
    throw new Error("This meeting is locked (CLOSED)");
  }
  await assertProjectAccess(user.role, user.id, meeting.projectId, meeting.ownerId);

  await persistAttachmentFiles(meetingId, [file]);
  revalidatePath(`/meetings/${meetingId}`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/meeting-actions.test.ts`
Expected: PASS (all existing + new tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/meeting.ts src/app/\(portal\)/meetings/actions.ts tests/meeting-actions.test.ts
git commit -m "feat: persist weekly report risks, multi-file attachments, and relax draft validation"
```

---

### Task 4: Form UI — Risk editor, file picker, Save Draft button

**Files:**
- Modify: `src/app/(portal)/meetings/meeting-form.tsx`

**Interfaces:**
- Consumes: `RiskInput` type, `MeetingFormData.risks` (Task 3); `RISK_CATEGORIES`, `RISK_STATUSES` (Task 2).
- Produces: `MeetingForm`'s `onSubmit` prop is now `(data: MeetingFormData, filesFormData: FormData) => Promise<void>` — this is what Tasks 5-6 will call with two arguments.

- [ ] **Step 1: Update imports and the `onSubmit` prop type**

In `src/app/(portal)/meetings/meeting-form.tsx`, update the imports (lines 1-11):

```tsx
"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { MeetingFormData, EERow, IssueInput, RiskInput } from "@/types/meeting";
import type { Severity } from "@/generated/prisma/enums";
import type { Role } from "@/types";
import { type ProjectOption } from "@/lib/master-data";
import { htmlToText } from "@/lib/announcements";
import { SUMMARY_WEEKLY_CATEGORY, RISK_CATEGORIES, RISK_STATUSES } from "@/lib/meetings";
import { syncWeeklyTasks } from "./actions";
import { SummaryWeeklyReport } from "./summary-weekly-report";
```

Update the `MeetingForm` props signature (lines 18-36), changing only the `onSubmit` type:

```tsx
export function MeetingForm({
  initial,
  people,
  projects,
  categories,
  sections,
  role,
  currentUserId,
  onSubmit,
}: {
  initial: MeetingFormData;
  people: Person[];
  projects: ProjectOption[];
  categories: string[];
  sections: string[];
  role: Role;
  currentUserId: string;
  onSubmit: (data: MeetingFormData, filesFormData: FormData) => Promise<void>;
}) {
```

- [ ] **Step 2: Add staged-files state and a `buildFilesFormData` helper**

Right after the `const [form, setForm] = useState...` line (line 37), add:

```tsx
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  function buildFilesFormData(): FormData {
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append("files", f));
    return fd;
  }
```

- [ ] **Step 3: Wire `submit` and add a `saveDraft` handler**

Replace the existing `submit` function (lines 99-103):

```tsx
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    start(() => onSubmit({ ...form, weekRange: composeWeekRange(form.weekStart, form.weekEnd, form.weekRange) }, buildFilesFormData()));
  }

  function saveDraft() {
    start(() =>
      onSubmit(
        { ...form, status: "DRAFT", weekRange: composeWeekRange(form.weekStart, form.weekEnd, form.weekRange) },
        buildFilesFormData(),
      ),
    );
  }
```

- [ ] **Step 4: Add the Risk editor section**

In the JSX, right after the `IssueEditor` block for Company Issues (line 182), add:

```tsx
      <RiskEditor rows={form.risks} onChange={(rows) => set("risks", rows)} />
```

- [ ] **Step 5: Add the file-staging section**

Right after the `RiskEditor` line just added, add:

```tsx
      <FileStager files={pendingFiles} onChange={setPendingFiles} />
```

- [ ] **Step 6: Add the Save Draft button**

In the submit-button footer (lines 190-200), add a Save Draft button before "Lưu meeting":

```tsx
      <div className="flex items-center justify-end gap-2">
        {!isValid && <span className="text-xs text-slate-500">Vui lòng nhập đủ Tuần, Từ, Đến và Executive Summary.</span>}
        <button
          type="button"
          onClick={saveDraft}
          disabled={pending}
          className="rounded-lg border border-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-[var(--vti-deep,#0A3CA8)] disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu nháp"}
        </button>
        <button
          type="submit"
          disabled={pending || !isValid}
          title={!isValid ? "Vui lòng nhập đủ Tuần, Từ, Đến và Executive Summary." : undefined}
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu meeting"}
        </button>
      </div>
```

- [ ] **Step 7: Implement the `RiskEditor` component**

Add this new component after `IssueEditor` (after line 336, before `composeWeekRange`):

```tsx
function RiskEditor({ rows, onChange }: { rows: RiskInput[]; onChange: (rows: RiskInput[]) => void }) {
  const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const emptyRisk: RiskInput = {
    title: "", description: "", category: RISK_CATEGORIES[0], impact: "MEDIUM", priority: "MEDIUM",
    rootCause: "", status: RISK_STATUSES[0], actionPlan: "", supportNeeded: "",
  };
  function update(i: number, patch: Partial<RiskInput>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Risks</h3>
        <button type="button" className="text-sm text-[var(--vti-deep,#0A3CA8)]" onClick={() => onChange([...rows, { ...emptyRisk }])}>
          + Thêm risk
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-400">Chưa có risk nào.</p>}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded border border-[var(--vti-line,#E7DED2)] p-3">
            <div className="grid grid-cols-12 gap-2">
              <input
                className="col-span-12 rounded border px-2 py-1 text-sm sm:col-span-4"
                placeholder="Tiêu đề"
                value={row.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <select className="col-span-6 rounded border px-2 py-1 text-sm sm:col-span-2" value={row.category} onChange={(e) => update(i, { category: e.target.value })}>
                {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="col-span-6 rounded border px-2 py-1 text-sm sm:col-span-2" value={row.impact} onChange={(e) => update(i, { impact: e.target.value as Severity })}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="col-span-6 rounded border px-2 py-1 text-sm sm:col-span-2" value={row.priority} onChange={(e) => update(i, { priority: e.target.value as Severity })}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="col-span-6 rounded border px-2 py-1 text-sm sm:col-span-2" value={row.status} onChange={(e) => update(i, { status: e.target.value })}>
                {RISK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <textarea className="rounded border px-2 py-1 text-sm" placeholder="Mô tả" rows={2} value={row.description} onChange={(e) => update(i, { description: e.target.value })} />
              <textarea className="rounded border px-2 py-1 text-sm" placeholder="Nguyên nhân gốc rễ" rows={2} value={row.rootCause} onChange={(e) => update(i, { rootCause: e.target.value })} />
              <textarea className="rounded border px-2 py-1 text-sm" placeholder="Kế hoạch xử lý" rows={2} value={row.actionPlan} onChange={(e) => update(i, { actionPlan: e.target.value })} />
              <textarea className="rounded border px-2 py-1 text-sm" placeholder="Hỗ trợ cần thiết" rows={2} value={row.supportNeeded} onChange={(e) => update(i, { supportNeeded: e.target.value })} />
            </div>
            <div className="mt-2 text-right">
              <button type="button" className="text-xs font-semibold text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                Xóa risk
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Implement the `FileStager` component**

Add this new component right after `RiskEditor`:

```tsx
function FileStager({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Tệp đính kèm</h3>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="text-sm"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) onChange([...files, ...picked]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm text-slate-600">
              <span className="truncate">{f.name} ({Math.ceil(f.size / 1024)} KB)</span>
              <button type="button" className="text-xs font-semibold text-red-500" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Type-check and run the full test suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the two page wrappers still call `onSubmit`/`action` with one argument at this point — that remains valid, since a caller may always omit trailing parameters the callee declares... note: this will actually be fixed by construction since Tasks 5-6 haven't run yet. If `tsc` reports the two page wrappers' `action` functions as incompatible because they still only take one argument, that's expected and resolved by Task 5/6 — re-run this check after those tasks instead.)

Run: `npx vitest run tests/meeting-actions.test.ts tests/meetings-lib.test.ts`
Expected: all tests PASS (this file has no dedicated component tests today — the underlying logic is covered by `tests/meeting-actions.test.ts` and `tests/meetings-lib.test.ts`).

- [ ] **Step 10: Commit**

```bash
git add src/app/\(portal\)/meetings/meeting-form.tsx
git commit -m "feat: add Risk editor, multi-file attachment picker, and Save Draft to the weekly report form"
```

---

### Task 5: Create screen (`new/page.tsx`)

**Files:**
- Modify: `src/app/(portal)/meetings/new/page.tsx`

**Interfaces:**
- Consumes: `MeetingFormData.risks` (Task 3), `createMeeting(form, filesFormData?)` (Task 3), the two-argument `onSubmit` type on `MeetingForm` (Task 4).

- [ ] **Step 1: Add `risks: []` to the initial form data and forward `filesFormData`**

In `src/app/(portal)/meetings/new/page.tsx`, add `risks: [],` to the `initial` object (after `raRows: [],`, line 43):

```ts
  const initial: MeetingFormData = {
    week: "",
    weekRange: "",
    weekStart: "",
    weekEnd: "",
    section: sections[1] ?? sections[0] ?? "",
    category: categories[0] ?? "",
    status: "OPEN",
    execSummary: "",
    teamSummary: "",
    opportunities: "",
    otherInfo: "",
    additionalNote: "",
    eeRows: [],
    raRows: [],
    risks: [],
    divisionIssues: [],
    companyIssues: [],
  };
```

Update the inline server action (lines 48-51) to accept and forward the files `FormData`:

```ts
  async function action(data: MeetingFormData, filesFormData: FormData) {
    "use server";
    await createMeeting(data, filesFormData);
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`MeetingForm`'s `onSubmit` prop already expects two arguments as of Task 4, so `action` now matches it exactly.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(portal\)/meetings/new/page.tsx
git commit -m "feat: initialize risks and forward attachment files on weekly report create"
```

---

### Task 6: Edit screen (`[id]/edit/page.tsx`)

**Files:**
- Modify: `src/app/(portal)/meetings/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `MeetingFormData.risks` (Task 3), `updateMeeting(id, form, filesFormData?)` (Task 3), Prisma `Meeting.risks` relation (Task 1), the two-argument `onSubmit` type on `MeetingForm` (Task 4).

- [ ] **Step 1: Include `risks` in the Prisma query and map them into `initial`**

In `src/app/(portal)/meetings/[id]/edit/page.tsx`, add `risks: true,` to the `include` clause (line 17):

```ts
  const m = await db.meeting.findUnique({
    where: { id },
    include: { eeRows: true, raRows: true, risks: true, divisionIssues: true, companyIssues: true, project: { select: { picPms: { select: { id: true } } } } },
  });
```

Add `risks` mapping to the `initial` object, right after `raRows` (line 45):

```ts
    eeRows: m.eeRows.map((r) => ({ project: r.project, plan: r.plan, actual: r.actual, note: r.note ?? "" })),
    raRows: m.raRows.map((r) => ({ name: r.name, project: r.project, from: r.from, effort: r.effort, status: r.status })),
    risks: m.risks.map((r) => ({
      title: r.title,
      description: r.description ?? "",
      category: r.category,
      impact: r.impact,
      priority: r.priority,
      rootCause: r.rootCause ?? "",
      status: r.status,
      actionPlan: r.actionPlan ?? "",
      supportNeeded: r.supportNeeded ?? "",
    })),
```

- [ ] **Step 2: Forward `filesFormData` in the inline server action**

Replace the `action` function (lines 50-53):

```ts
  async function action(data: MeetingFormData, filesFormData: FormData) {
    "use server";
    await updateMeeting(id, data, filesFormData);
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(portal\)/meetings/\[id\]/edit/page.tsx
git commit -m "feat: load risks and forward attachment files on weekly report edit"
```

---

### Task 7: Detail view — read-only Risks section

**Files:**
- Modify: `src/app/(portal)/meetings/[id]/page.tsx`

**Interfaces:**
- Consumes: `Meeting.risks` (Task 1), `Severity` labels already defined in this file (`severityLabel`, `severityClass`).

- [ ] **Step 1: Include `risks` in the detail-page query**

Add `risks: true,` to the `include` clause (line 152):

```ts
  const m = await db.meeting.findUnique({
    where: { id },
    include: {
      owner: true,
      project: { include: { picPms: { select: { id: true } } } },
      eeRows: true,
      raRows: true,
      risks: true,
      divisionIssues: { include: { owner: true } },
      companyIssues: { include: { owner: true } },
      attachments: true,
    },
  });
```

- [ ] **Step 2: Add a read-only Risks `SectionCard`**

Insert this new section right after the Division/Company Issues grid (after line 291, before the "Team Summary" `SectionCard`):

```tsx
      <SectionCard title={`Risks (${m.risks.length})`} icon={<TriangleAlert size={15} />}>
        {m.risks.length === 0 ? (
          <p className="text-sm text-slate-400">Không có risk.</p>
        ) : (
          <ul className="space-y-4">
            {m.risks.map((risk) => (
              <li key={risk.id} className="rounded border border-[#dbe3ef] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`portal-pill ${severityClass(risk.impact)}`}>Impact: {severityLabel(risk.impact)}</span>
                  <span className={`portal-pill ${severityClass(risk.priority)}`}>Priority: {severityLabel(risk.priority)}</span>
                  <span className="portal-pill bg-slate-100 text-slate-600">{risk.category}</span>
                  <span className="portal-pill bg-amber-50 text-amber-700">{risk.status}</span>
                </div>
                <p className="mt-2 font-semibold text-slate-950">{risk.title}</p>
                {risk.description && <p className="mt-1 text-sm text-slate-700">{risk.description}</p>}
                <dl className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div><dt className="font-semibold text-slate-500">Root cause</dt><dd>{risk.rootCause || "—"}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Action plan</dt><dd>{risk.actionPlan || "—"}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Support needed</dt><dd>{risk.supportNeeded || "—"}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (`severityLabel`/`severityClass` already accept the `Severity` union used by `risk.impact`/`risk.priority`).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(portal\)/meetings/\[id\]/page.tsx
git commit -m "feat: show risks on the weekly report detail page"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, including the new risk/attachment/draft tests from Task 3 and the constants test from Task 2.

- [ ] **Step 2: Full project type-check and build**

Run: `npm run build`
Expected: build completes with no type errors across `meeting-form.tsx`, both page wrappers, `actions.ts`, and the detail page.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in a browser:
1. Go to `/meetings/new`. Add a Risk row, fill Title/Description/Root cause/Action Plan/Support Needed, pick Category/Impact/Priority/Status. Select two files in "Tệp đính kèm". Fill required fields (Tuần, Từ, Đến, Executive Summary) and click "Lưu meeting" — confirm redirect to the new meeting's detail page, that the Risk appears in the "Risks" section, and both files appear in "Attachments".
2. Go to `/meetings/new` again, leave Tuần/Từ/Đến blank, click "Lưu nháp" — confirm it saves without a validation error and the created meeting shows status "Bản nháp".
3. Open the meeting from step 1 in Edit, add a second Risk row and one more file, save — confirm both risks and all three attachments now show on the detail page.

- [ ] **Step 4: Commit** (only if the smoke test surfaced fixes; otherwise skip — nothing to commit)
