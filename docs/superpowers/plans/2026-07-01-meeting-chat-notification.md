# Weekly Meeting → Google Chat Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a PM creates a weekly meeting, post a plain-text Google Chat notification ("PM {name} của dự án {projects} trong section {section} đã viết report weekly." + a detail link) to a dedicated webhook.

**Architecture:** Add a pure message builder + a fire-and-forget sender to `src/lib/google-chat.ts` (mirroring the existing `sendPointAwardCard` pattern), then call the sender from `createMeeting` after the DB insert. New env var `MEETING_CHAT_WEBHOOK_URL`; the link uses the existing `APP_URL`.

**Tech Stack:** Next.js 16 server actions, `fetch` to a Google Chat incoming webhook, Vitest.

## Global Constraints

- UI/message text is Vietnamese.
- The sender is a no-op returning `false` when `MEETING_CHAT_WEBHOOK_URL` is unset, and NEVER throws (a webhook failure must never break meeting creation). Mirror `sendPointAwardCard`.
- Fire only inside `createMeeting`, for any status. `updateMeeting`/`closeMeeting`/`cloneMeeting` are untouched.
- `{projects}` = distinct, non-empty `MeetingEE.project` names joined by `", "`; when empty, the `của dự án ...` clause is dropped.
- The message link uses `APP_URL`; when `APP_URL` is unset the message sends without a link.
- Conventional Commits. No schema changes.

---

## File structure

- Modify `src/lib/google-chat.ts` — add `buildMeetingReportMessage` (pure) + `sendMeetingReportNotification`.
- Modify `tests/google-chat.test.ts` — add tests for both.
- Modify `src/app/(portal)/meetings/actions.ts` — `requireEditor` returns `name`; `createMeeting` calls the sender.
- Modify `tests/meeting-actions.test.ts` — mock the sender, assert it fires on create.
- Modify `d8-portal/CLAUDE.md` — lib entry, createMeeting note, env var.

---

## Task 1: Google Chat message builder + sender

**Files:**
- Modify: `src/lib/google-chat.ts`
- Test: `tests/google-chat.test.ts`

**Interfaces:**
- Produces:
  - `type MeetingReportPayload = { pmName: string; projects: string[]; section: string; meetingUrl: string }`
  - `buildMeetingReportMessage(p: MeetingReportPayload): { text: string }` (pure)
  - `sendMeetingReportNotification(p: MeetingReportPayload): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

In `tests/google-chat.test.ts`, extend the existing import on line 2 to also import the new symbols. Replace:

```typescript
import { buildPointAwardCard, sendPointAwardCard, type PointAwardCardPayload } from "@/lib/google-chat";
```

with:

```typescript
import {
  buildPointAwardCard,
  sendPointAwardCard,
  buildMeetingReportMessage,
  sendMeetingReportNotification,
  type PointAwardCardPayload,
  type MeetingReportPayload,
} from "@/lib/google-chat";
```

Then append these two `describe` blocks to the end of the file:

```typescript
const meetingPayload: MeetingReportPayload = {
  pmName: "Nguyễn Văn B",
  projects: ["SBI Trading Platform", "AEON Loyalty App"],
  section: "D8.1",
  meetingUrl: "https://portal.example/meetings/m1",
};

describe("buildMeetingReportMessage", () => {
  it("interpolates pm, joined projects, section, and the detail link", () => {
    const { text } = buildMeetingReportMessage(meetingPayload);
    expect(text).toBe(
      "PM Nguyễn Văn B của dự án SBI Trading Platform, AEON Loyalty App trong section D8.1 đã viết report weekly. <https://portal.example/meetings/m1|Nhấn vào đây để xem chi tiết>."
    );
  });
  it("drops the 'của dự án' clause when there are no projects", () => {
    const { text } = buildMeetingReportMessage({ ...meetingPayload, projects: [] });
    expect(text).toBe(
      "PM Nguyễn Văn B trong section D8.1 đã viết report weekly. <https://portal.example/meetings/m1|Nhấn vào đây để xem chi tiết>."
    );
  });
  it("omits the link when meetingUrl is empty", () => {
    const { text } = buildMeetingReportMessage({ ...meetingPayload, meetingUrl: "" });
    expect(text).toBe(
      "PM Nguyễn Văn B của dự án SBI Trading Platform, AEON Loyalty App trong section D8.1 đã viết report weekly."
    );
    expect(text).not.toContain("<");
  });
});

describe("sendMeetingReportNotification", () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.MEETING_CHAT_WEBHOOK_URL;
  beforeEach(() => { delete process.env.MEETING_CHAT_WEBHOOK_URL; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realEnv === undefined) delete process.env.MEETING_CHAT_WEBHOOK_URL;
    else process.env.MEETING_CHAT_WEBHOOK_URL = realEnv;
  });

  it("returns false and does not fetch when the webhook env is unset", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("posts to the webhook and returns true on a 2xx response", async () => {
    process.env.MEETING_CHAT_WEBHOOK_URL = "https://chat.example/meeting-hook";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
  it("returns false when fetch rejects", async () => {
    process.env.MEETING_CHAT_WEBHOOK_URL = "https://chat.example/meeting-hook";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- google-chat`
Expected: FAIL (`buildMeetingReportMessage`/`sendMeetingReportNotification` not exported).

- [ ] **Step 3: Implement the builder + sender**

Append to `src/lib/google-chat.ts`:

```typescript
export type MeetingReportPayload = {
  pmName: string;
  projects: string[];   // distinct, non-empty MeetingEE project names
  section: string;
  meetingUrl: string;   // absolute link, or "" when APP_URL is unset
};

/** Pure: plain-text Google Chat notification for a newly created weekly meeting. */
export function buildMeetingReportMessage(p: MeetingReportPayload): { text: string } {
  const projectClause = p.projects.length ? ` của dự án ${p.projects.join(", ")}` : "";
  const sentence = `PM ${p.pmName}${projectClause} trong section ${p.section} đã viết report weekly.`;
  const link = p.meetingUrl ? ` <${p.meetingUrl}|Nhấn vào đây để xem chi tiết>.` : "";
  return { text: sentence + link };
}

export async function sendMeetingReportNotification(p: MeetingReportPayload): Promise<boolean> {
  const url = process.env.MEETING_CHAT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildMeetingReportMessage(p)),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send Google Chat meeting-report notification:", e);
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- google-chat`
Expected: PASS (existing point-award tests + the new meeting tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-chat.ts tests/google-chat.test.ts
git commit -m "feat: add meeting-report Google Chat message builder and sender"
```

---

## Task 2: Fire the notification on meeting creation

**Files:**
- Modify: `src/app/(portal)/meetings/actions.ts`
- Test: `tests/meeting-actions.test.ts`

**Interfaces:**
- Consumes: `sendMeetingReportNotification` (Task 1).
- Produces: `createMeeting` posts a notification after insert; `requireEditor()` now returns `{ id: string; role: Role; name: string }`.

- [ ] **Step 1: Write the failing test**

In `tests/meeting-actions.test.ts`:

Add a mock handle near the other `const ...Mock = vi.fn();` declarations (after line 8):

```typescript
const sendMeetingNotifMock = vi.fn();
```

Add a module mock alongside the other `vi.mock(...)` calls (after the `@/lib/storage` mock, ~line 28):

```typescript
vi.mock("@/lib/google-chat", () => ({
  sendMeetingReportNotification: (...a: unknown[]) => sendMeetingNotifMock(...a),
}));
```

Add resets to the `beforeEach` block (after the existing `*.mockReset()` lines):

```typescript
  sendMeetingNotifMock.mockReset();
  sendMeetingNotifMock.mockResolvedValue(true);
```

Append this `describe` block to the end of the file:

```typescript
describe("createMeeting notification", () => {
  it("posts a meeting-report notification with pm, projects, section and link", async () => {
    const realAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://portal.example";
    try {
      authMock.mockResolvedValue({ user: { id: "u3", role: "PM", name: "Nguyễn B" } });
      createMock.mockResolvedValue({ id: "new1", section: "D8.1" });
      await expect(createMeeting(validForm)).rejects.toThrow("REDIRECT:/meetings/new1");
      expect(sendMeetingNotifMock).toHaveBeenCalledTimes(1);
      expect(sendMeetingNotifMock.mock.calls[0][0]).toEqual({
        pmName: "Nguyễn B",
        projects: ["A"],
        section: "D8.1",
        meetingUrl: "https://portal.example/meetings/new1",
      });
    } finally {
      if (realAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = realAppUrl;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- meeting-actions`
Expected: FAIL (`sendMeetingReportNotification` is not called by `createMeeting` yet).

- [ ] **Step 3: Wire the sender into `createMeeting`**

In `src/app/(portal)/meetings/actions.ts`:

Add the import (after the existing `@/lib/openai-agent` import, ~line 9):

```typescript
import { sendMeetingReportNotification } from "@/lib/google-chat";
```

Change `requireEditor` to also return the display name. Replace:

```typescript
async function requireEditor(): Promise<{ id: string; role: Role }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "meeting:edit")) {
    throw new Error("Forbidden");
  }
  return { id: session.user.id, role: session.user.role };
}
```

with:

```typescript
async function requireEditor(): Promise<{ id: string; role: Role; name: string }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "meeting:edit")) {
    throw new Error("Forbidden");
  }
  return { id: session.user.id, role: session.user.role, name: session.user.name ?? "PM" };
}
```

In `createMeeting`, insert the notification between the `db.meeting.create(...)` assignment and `revalidatePath("/meetings")`. Replace:

```typescript
  revalidatePath("/meetings");
  redirect(`/meetings/${created.id}`);
}
```

with (this is the tail of `createMeeting` only — the first occurrence):

```typescript
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

Note: `createMeeting` is the FIRST function ending with `revalidatePath("/meetings"); redirect(\`/meetings/${created.id}\`);` — `updateMeeting` redirects to `/meetings/${id}` (different variable) and `cloneMeeting` redirects to `/meetings/${created.id}/edit`. Match `createMeeting`'s exact tail (uses `created.id`, no `/edit`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- meeting-actions`
Expected: PASS (existing meeting-actions tests + the new notification test).

- [ ] **Step 5: Typecheck / build**

Run: `npm run build`
Expected: compiles clean. (`npm run lint` has a known pre-existing Windows-path failure unrelated to this change — build passing is the gate.)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(portal\)/meetings/actions.ts tests/meeting-actions.test.ts
git commit -m "feat: notify Google Chat when a PM creates a weekly meeting"
```

---

## Task 3: Documentation

**Files:**
- Modify: `d8-portal/CLAUDE.md`

- [ ] **Step 1: Update the `google-chat.ts` lib entry**

In `d8-portal/CLAUDE.md`, replace the `google-chat.ts` bullet:

```
- **google-chat.ts** — `buildPointAwardCard` (pure Cards v2 JSON; renders an optional celebration GIF + uploaded photo image widget) + `sendPointAwardCard` (POST to `GOOGLE_CHAT_WEBHOOK_URL`; no-op/false when env unset; never throws).
```

with:

```
- **google-chat.ts** — `buildPointAwardCard` (pure Cards v2 JSON; renders an optional celebration GIF + uploaded photo image widget) + `sendPointAwardCard` (POST to `GOOGLE_CHAT_WEBHOOK_URL`; no-op/false when env unset; never throws). `buildMeetingReportMessage` (pure plain-text) + `sendMeetingReportNotification` (POST to `MEETING_CHAT_WEBHOOK_URL`; no-op/false when unset; never throws) — fired on weekly-meeting creation.
```

- [ ] **Step 2: Note the createMeeting behavior**

In the meetings server-actions bullet, update the `createMeeting` mention to note the notification. Replace:

```
- **meetings**: `createMeeting`, `updateMeeting`, `closeMeeting`, `cloneMeeting`, `uploadAttachment`,
```

with:

```
- **meetings**: `createMeeting` (also posts a Google Chat meeting-report notification to `MEETING_CHAT_WEBHOOK_URL`), `updateMeeting`, `closeMeeting`, `cloneMeeting`, `uploadAttachment`,
```

- [ ] **Step 3: Document the env var**

In the `## Environment variables (runtime)` section, add:

```
- `MEETING_CHAT_WEBHOOK_URL` (optional) — Google Chat incoming-webhook URL; `createMeeting` posts a plain-text weekly-report notification here (needs `APP_URL` for the clickable detail link). Unset → silently no-ops.
```

- [ ] **Step 4: Commit**

```bash
git add d8-portal/CLAUDE.md
git commit -m "docs: document meeting-report Google Chat notification + MEETING_CHAT_WEBHOOK_URL"
```

---

## Final verification

- [ ] Run the full unit suite: `npm test`
  Expected: PASS (google-chat, meeting-actions, and all existing specs).
- [ ] Run `npm run build`
  Expected: production build succeeds.

## Self-review notes

- **Spec coverage:** §1 builder+sender → Task 1; §2 wiring (requireEditor name, createMeeting call, projects derivation) → Task 2; §3 env → Task 2 (read) + Task 3 (doc); §4 tests → Task 1 (builder) + Task 2 (wiring); §5 docs → Task 3. Acceptance criteria (no-op when unset, no-link when APP_URL unset, no re-notify on edit/close/clone, never throws) covered by Task 1 tests + Task 2 create-only wiring.
- **Type consistency:** `MeetingReportPayload` fields (`pmName`, `projects: string[]`, `section`, `meetingUrl`) defined in Task 1 and constructed identically in Task 2's `createMeeting` call and the Task 2 test's `toEqual`. `requireEditor` return type gains `name` and `createMeeting` reads `user.name`. Message text asserted in Task 1 exactly matches the builder's template.
