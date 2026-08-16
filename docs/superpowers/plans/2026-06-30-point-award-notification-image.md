# Point Award Notification Image + Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers optionally attach an image (shown only when notifying) and always embed a fixed celebration GIF in the Point Award Google Chat card, so the notification stands out.

**Architecture:** Add a nullable `PointAward.imageUrl` (Supabase object path). The create form shows an optional image input only when the notify toggle is ON; `createPointAward` uploads it via existing `uploadDocumentFile`, stores the path, and at send time mints a signed URL plus an `APP_URL`-based celebration-GIF URL into the card. `buildPointAwardCard` renders both as Cards v2 image widgets. The web leaderboard is unchanged.

**Tech Stack:** Next.js 16 (Server Actions accept `File` in arg objects), Prisma 7, Supabase Storage, Vitest.

## Global Constraints

- Animation in Google Chat = animated GIF only (no CSS/JS). Both images are Cards v2 `image` widgets.
- Uploaded image is **chat-only**; the web leaderboard (Screen 2) is NOT changed.
- Image upload is accepted only when `sendNotification === true` AND a file is provided; otherwise ignored (`imageUrl` stays null).
- Allowed image extensions: `png, jpg, jpeg, gif, webp`; 50MB cap (enforced by `uploadDocumentFile`).
- `imageUrl` stores the Supabase **object path** (not a URL); sign on read via `getSignedUrl`.
- Celebration GIF URL = `${process.env.APP_URL}/point-award-celebration.gif`, omitted when `APP_URL` is unset. The uploaded-photo widget is omitted when there is no image.
- A notification/upload failure must not roll back the already-saved award (upsert happens before the notify block).
- UI text Vietnamese. Run tests with `npm test`; lint changed files with `npx eslint <files>` (the `npm run lint` script is pre-existing-broken in Next 16.2).
- Migration SQL style matches existing files in `prisma/migrations/`.

---

### Task 1: Add `PointAward.imageUrl` (schema + migration)

**Files:**
- Modify: `prisma/schema.prisma` (model `PointAward`)
- Create: `prisma/migrations/20260630020000_point_award_image/migration.sql`

**Interfaces:**
- Produces: `PointAward.imageUrl String?` (nullable); the `db.pointAward` delegate now accepts/returns `imageUrl`.

- [ ] **Step 1: Add the field to the model**

In `prisma/schema.prisma`, inside `model PointAward { ... }`, add `imageUrl` after the `reason` line:

```prisma
  reason      String
  imageUrl    String?
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260630020000_point_award_image/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "PointAward" ADD COLUMN "imageUrl" TEXT;
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client ... to .\src\generated\prisma`

- [ ] **Step 4: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 5: Apply the migration**

Run: `npx prisma migrate deploy`
Expected: applies `20260630020000_point_award_image` (or reports already applied). If the DB is unreachable, note it and continue — the migration file is committed for later deploy.

- [ ] **Step 6: Commit** (`src/generated/prisma` is gitignored — do NOT add it)

```bash
git add prisma/schema.prisma prisma/migrations/20260630020000_point_award_image
git commit -m "feat: add PointAward.imageUrl for notification image"
```

---

### Task 2: Card builder — image + celebration GIF widgets (`google-chat.ts`)

**Files:**
- Modify: `src/lib/google-chat.ts`
- Test: `tests/google-chat.test.ts`

**Interfaces:**
- Consumes: `formatMonth` (unchanged).
- Produces: `PointAwardCardPayload` gains optional `imageUrl?: string` and `celebrationGifUrl?: string`. `buildPointAwardCard` renders a GIF image widget first (when `celebrationGifUrl`) and an uploaded-photo image widget after the points line (when `imageUrl`). `sendPointAwardCard` signature unchanged (forwards the whole payload).

- [ ] **Step 1: Extend the tests (write them first)**

In `tests/google-chat.test.ts`, add these cases inside the existing `describe("buildPointAwardCard", ...)` block (after the existing two `it(...)` cases):

```ts
  it("includes the celebration GIF image when celebrationGifUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, celebrationGifUrl: "https://cdn.example/celebrate.gif" }));
    expect(card).toContain("https://cdn.example/celebrate.gif");
  });
  it("includes the uploaded photo image when imageUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, imageUrl: "https://signed.example/photo.png" }));
    expect(card).toContain("https://signed.example/photo.png");
  });
  it("renders no image widget when neither imageUrl nor celebrationGifUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard(payload));
    expect(card).not.toContain('"image":');
  });
  it("orders the GIF before the points line and the photo after it (before the reason)", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, celebrationGifUrl: "GIFURL", imageUrl: "PHOTOURL" }));
    expect(card.indexOf("GIFURL")).toBeLessThan(card.indexOf("Điểm thưởng"));
    expect(card.indexOf("PHOTOURL")).toBeGreaterThan(card.indexOf("Điểm thưởng"));
    expect(card.indexOf("PHOTOURL")).toBeLessThan(card.indexOf(payload.reason));
  });
```

- [ ] **Step 2: Run the tests to verify the new cases fail**

Run: `npx vitest run tests/google-chat.test.ts`
Expected: FAIL — the new image-widget assertions fail (the builder doesn't emit `image` widgets yet).

- [ ] **Step 3: Update the payload type and builder**

In `src/lib/google-chat.ts`, replace the `PointAwardCardPayload` type and the `buildPointAwardCard` function with:

```ts
export type PointAwardCardPayload = {
  targetName: string;
  targetKind: "PERSON" | "PROJECT";
  points: number;
  reason: string;
  month: string; // "YYYY-MM"
  awarderName: string;
  leaderboardUrl: string;
  imageUrl?: string;          // signed URL of the uploaded image
  celebrationGifUrl?: string; // public URL of the fixed celebration GIF
};

export function buildPointAwardCard(p: PointAwardCardPayload) {
  const icon = p.targetKind === "PERSON" ? "👤" : "📁";
  const kindLabel = p.targetKind === "PERSON" ? "Cá nhân" : "Dự án";
  const widgets: unknown[] = [];
  if (p.celebrationGifUrl) {
    widgets.push({ image: { imageUrl: p.celebrationGifUrl, altText: "🎉 Chúc mừng" } });
  }
  widgets.push({ decoratedText: { topLabel: kindLabel, text: `<b>${icon} ${p.targetName}</b>` } });
  widgets.push({ decoratedText: { topLabel: "Điểm thưởng", text: `<b>⭐ +${p.points} điểm</b>` } });
  if (p.imageUrl) {
    widgets.push({ image: { imageUrl: p.imageUrl, altText: p.targetName } });
  }
  widgets.push({ textParagraph: { text: `💬 ${p.reason}` } });
  widgets.push({ textParagraph: { text: `<i>— by ${p.awarderName}</i>` } });
  if (p.leaderboardUrl) {
    widgets.push({
      buttonList: { buttons: [{ text: "Xem bảng xếp hạng", onClick: { openLink: { url: p.leaderboardUrl } } }] },
    });
  }
  return {
    cardsV2: [
      {
        cardId: "point-award",
        card: {
          header: { title: "🏆 VINH DANH ĐIỂM THƯỞNG", subtitle: formatMonth(p.month) },
          sections: [{ widgets }],
        },
      },
    ],
  };
}
```

(Leave `sendPointAwardCard` unchanged — it already serializes the whole payload.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/google-chat.test.ts`
Expected: PASS (existing + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-chat.ts tests/google-chat.test.ts
git commit -m "feat: render uploaded image and celebration GIF in point-award chat card"
```

---

### Task 3: Server actions — upload, sign, GIF URL, delete cleanup (`point-award/actions.ts`)

**Files:**
- Modify: `src/app/(portal)/point-award/actions.ts`
- Test: `tests/point-award-actions.test.ts`

**Interfaces:**
- Consumes: `uploadDocumentFile`, `getSignedUrl`, `removeFromBucket` from `@/lib/storage`; the extended `PointAwardCardPayload` from Task 2; `PointAward.imageUrl` from Task 1.
- Produces: `CreatePointAwardInput` gains `imageFile?: File | null`. `createPointAward` uploads the image (only when notifying), stores `imageUrl`, and feeds signed image URL + celebration GIF URL into the card. `deletePointAward` best-effort removes the stored image.

- [ ] **Step 1: Extend the test file — mocks**

In `tests/point-award-actions.test.ts`, add storage mocks and a `findUnique` for delete. Add these mock fns near the top with the others:

```ts
const uploadMock = vi.fn();
const signMock = vi.fn();
const removeMock = vi.fn();
const findUniqueMock = vi.fn();
```

Add the storage module mock alongside the existing `vi.mock(...)` calls:

```ts
vi.mock("@/lib/storage", () => ({
  uploadDocumentFile: (...a: unknown[]) => uploadMock(...a),
  getSignedUrl: (...a: unknown[]) => signMock(...a),
  removeFromBucket: (...a: unknown[]) => removeMock(...a),
}));
```

Update the `@/lib/db` mock so `pointAward` also has `findUnique`:

```ts
vi.mock("@/lib/db", () => ({ db: {
  pointAward: {
    upsert: (...a: unknown[]) => upsertMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
    findUnique: (...a: unknown[]) => findUniqueMock(...a),
  },
  user: { findUnique: (...a: unknown[]) => userFindMock(...a) },
  project: { findUnique: (...a: unknown[]) => projectFindMock(...a) },
} }));
```

In the existing `beforeEach`, add resets and defaults (append after the current resets):

```ts
  uploadMock.mockReset(); signMock.mockReset(); removeMock.mockReset(); findUniqueMock.mockReset();
  signMock.mockResolvedValue("https://signed.example/photo.png");
  findUniqueMock.mockResolvedValue({ imageUrl: null });
```

- [ ] **Step 2: Extend the test file — new cases**

Add an image helper near the top (after `baseInput`):

```ts
const fakeImage = () => new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
```

Add these cases inside `describe("createPointAward", ...)`:

```ts
  it("uploads the image and stores imageUrl when notifying with a file", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(true);
    await createPointAward({ ...baseInput, sendNotification: true, imageFile: fakeImage() });
    expect(uploadMock).toHaveBeenCalledOnce();
    const path = uploadMock.mock.calls[0][0] as string;
    expect(path).toMatch(/^point-awards\/pa1\//);
    const updates = updateMock.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(updates.some((d) => d.imageUrl === path)).toBe(true);
    const cardArg = sendCardMock.mock.calls[0][0] as { imageUrl?: string };
    expect(cardArg.imageUrl).toBe("https://signed.example/photo.png");
  });
  it("does not upload when an image is provided but notification is off", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward({ ...baseInput, sendNotification: false, imageFile: fakeImage() });
    expect(uploadMock).not.toHaveBeenCalled();
  });
  it("rejects a non-image file when notifying", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    const bad = new File([new Uint8Array([1])], "evil.pdf", { type: "application/pdf" });
    await expect(createPointAward({ ...baseInput, sendNotification: true, imageFile: bad })).rejects.toThrow(/ảnh/i);
    expect(uploadMock).not.toHaveBeenCalled();
  });
```

Add these cases inside `describe("deletePointAward", ...)`:

```ts
  it("removes the stored image when the award had one", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: "point-awards/pa1/photo.png" });
    await deletePointAward("pa1");
    expect(removeMock).toHaveBeenCalledWith("point-awards/pa1/photo.png");
  });
  it("does not call remove when the award has no image", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: null });
    await deletePointAward("pa1");
    expect(removeMock).not.toHaveBeenCalled();
  });
  it("still succeeds when image cleanup throws", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: "point-awards/pa1/photo.png" });
    removeMock.mockRejectedValue(new Error("boom"));
    await expect(deletePointAward("pa1")).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "pa1" } });
  });
```

- [ ] **Step 3: Run the tests to verify the new cases fail**

Run: `npx vitest run tests/point-award-actions.test.ts`
Expected: FAIL — `createPointAward` doesn't handle `imageFile`; `deletePointAward` doesn't call `findUnique`/`removeFromBucket`.

- [ ] **Step 4: Rewrite `src/app/(portal)/point-award/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MONTH_RE } from "@/lib/monthly-detail";
import { validatePoints, POINT_AWARD_TYPES, type PointAwardType } from "@/lib/point-award";
import { sendPointAwardCard } from "@/lib/google-chat";
import { uploadDocumentFile, getSignedUrl, removeFromBucket } from "@/lib/storage";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];

async function requireAwarder() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "point:award")) throw new Error("Forbidden");
  return session.user;
}

export type CreatePointAwardInput = {
  month: string;
  type: PointAwardType;
  userId?: string;
  projectId?: string;
  points: number;
  reason: string;
  sendNotification: boolean;
  imageFile?: File | null;
};

export async function createPointAward(input: CreatePointAwardInput) {
  const awarder = await requireAwarder();
  if (!MONTH_RE.test(input.month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  if (!POINT_AWARD_TYPES.includes(input.type)) throw new Error("Validation: loại không hợp lệ");
  const points = validatePoints(input.points);
  const reason = input.reason.trim();
  if (!reason) throw new Error("Validation: lý do là bắt buộc");

  // Image is accepted only when notifying. Validate early so a bad file is rejected before any write.
  const imageFile = input.sendNotification && input.imageFile && input.imageFile.size > 0 ? input.imageFile : null;
  if (imageFile) {
    const ext = imageFile.name.slice(imageFile.name.lastIndexOf(".") + 1).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) throw new Error("Validation: ảnh phải là png/jpg/jpeg/gif/webp");
  }

  const targetUserId = input.type === "PERSON" ? (input.userId ?? "").trim() : "";
  const targetProjectId = input.type === "PROJECT" ? (input.projectId ?? "").trim() : "";
  if (input.type === "PERSON" && !targetUserId) throw new Error("Validation: chọn cá nhân");
  if (input.type === "PROJECT" && !targetProjectId) throw new Error("Validation: chọn dự án");

  const where =
    input.type === "PERSON"
      ? { month_userId: { month: input.month, userId: targetUserId } }
      : { month_projectId: { month: input.month, projectId: targetProjectId } };

  const award = await db.pointAward.upsert({
    where,
    create: {
      month: input.month,
      type: input.type,
      userId: targetUserId || null,
      projectId: targetProjectId || null,
      points,
      reason,
      createdById: awarder.id,
    },
    update: { points, reason, createdById: awarder.id },
  });

  if (input.sendNotification) {
    let imagePath: string | null = null;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      imagePath = `point-awards/${award.id}/${Date.now()}_${safeName}`;
      await uploadDocumentFile(imagePath, imageFile);
      await db.pointAward.update({ where: { id: award.id }, data: { imageUrl: imagePath } });
    }
    const targetName =
      input.type === "PERSON"
        ? (await db.user.findUnique({ where: { id: targetUserId }, select: { name: true } }))?.name ?? "N/A"
        : (await db.project.findUnique({ where: { id: targetProjectId }, select: { name: true } }))?.name ?? "N/A";
    const sent = await sendPointAwardCard({
      targetName,
      targetKind: input.type,
      points,
      reason,
      month: input.month,
      awarderName: awarder.name ?? "Quản lý",
      leaderboardUrl: process.env.APP_URL ? `${process.env.APP_URL}/point-award` : "",
      imageUrl: imagePath ? await getSignedUrl(imagePath) : undefined,
      celebrationGifUrl: process.env.APP_URL ? `${process.env.APP_URL}/point-award-celebration.gif` : "",
    });
    if (sent) {
      await db.pointAward.update({ where: { id: award.id }, data: { notified: true, notifiedAt: new Date() } });
    }
  }
  revalidatePath("/point-award");
}

export async function deletePointAward(id: string) {
  await requireAwarder();
  const existing = await db.pointAward.findUnique({ where: { id }, select: { imageUrl: true } });
  await db.pointAward.delete({ where: { id } });
  if (existing?.imageUrl) {
    try {
      await removeFromBucket(existing.imageUrl);
    } catch (e) {
      console.error("Failed to remove point-award image:", e);
    }
  }
  revalidatePath("/point-award");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/point-award-actions.test.ts`
Expected: PASS (existing + new image/delete cases).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(portal)/point-award/actions.ts" tests/point-award-actions.test.ts
git commit -m "feat: upload point-award image and clean it up on delete"
```

---

### Task 4: Create form — conditional image input (`point-award-form.tsx`)

**Files:**
- Modify: `src/app/(portal)/point-award/new/point-award-form.tsx`

**Interfaces:**
- Consumes: `createPointAward` with the new optional `imageFile` field (Task 3).
- Produces: a file input rendered only when the notify toggle is ON; the selected file is cleared when the toggle goes OFF and passed to `createPointAward`.

- [ ] **Step 1: Add image state**

After the `const [sendNotification, setSendNotification] = useState(true);` line, add:

```tsx
  const [imageFile, setImageFile] = useState<File | null>(null);
```

- [ ] **Step 2: Pass the file in the submit call**

Change the `createPointAward({ ... })` call inside `submit` to include `imageFile`:

```tsx
        await createPointAward({ month, type, userId, projectId, points, reason, sendNotification, imageFile });
```

- [ ] **Step 3: Make the notify toggle clear the file when turned off, and add the conditional file input**

Replace the existing notification `<label>...</label>` block:

```tsx
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sendNotification} onChange={(e) => setSendNotification(e.target.checked)} />
        Gửi thông báo đến Group chat Google
      </label>
```

with:

```tsx
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendNotification}
          onChange={(e) => {
            setSendNotification(e.target.checked);
            if (!e.target.checked) setImageFile(null);
          }}
        />
        Gửi thông báo đến Group chat Google
      </label>

      {sendNotification && (
        <div>
          <label className={labelCls}>Ảnh đính kèm (tùy chọn)</label>
          <input
            type="file"
            accept="image/*"
            className={inputCls}
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-slate-400">PNG/JPG/GIF/WEBP. GIF sẽ hiển thị động trong thông báo.</p>
        </div>
      )}
```

- [ ] **Step 4: Verify it builds and lints**

Run: `npx eslint "src/app/(portal)/point-award/new/point-award-form.tsx"`
Expected: no output (clean).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/point-award/new/point-award-form.tsx"
git commit -m "feat: add optional image upload to point-award form when notifying"
```

---

### Task 5: Docs + full verification

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: updated system map.

- [ ] **Step 1: Update `CLAUDE.md`**

- In the **Data model → Point Award** bullet, add `imageUrl` to the field list, e.g. append before the unique-index clause: `, optional `imageUrl` (Supabase path, chat-only notification image)`.
- In the **`src/lib` function reference**, update the `google-chat.ts` bullet to mention the new widgets, e.g.: `` **google-chat.ts** — `buildPointAwardCard` (pure Cards v2 JSON; renders an optional celebration GIF + uploaded photo image widget) + `sendPointAwardCard` (POST to `GOOGLE_CHAT_WEBHOOK_URL`; no-op/false when env unset; never throws). ``
- In the **Server actions → point-award** entry, note: `createPointAward` optionally uploads an image (only when notifying) shown in the chat card; `deletePointAward` cleans up the image.
- Add an env note where other env vars are mentioned (or in the point-award entry): the celebration GIF is served from `public/point-award-celebration.gif` via `APP_URL`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass (google-chat + point-award-actions include the new cases).

- [ ] **Step 3: Lint the changed source files + typecheck**

Run: `npx eslint src/lib/google-chat.ts "src/app/(portal)/point-award/actions.ts" "src/app/(portal)/point-award/new/point-award-form.tsx"`
Expected: no output (clean).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document point-award notification image + celebration GIF"
```

- [ ] **Step 5: Note the manual asset/env step (no code)**

Record for the user (do not block the task): they must add `public/point-award-celebration.gif` and set `APP_URL` for the celebration GIF and the leaderboard button to appear in the card. Both are omitted gracefully when missing.

---

## Self-Review

**Spec coverage:**
- `imageUrl` field + migration → Task 1. ✓
- Reuse `uploadDocumentFile`/`getSignedUrl`/`removeFromBucket`; upload only when notifying; allowed-ext check → Task 3. ✓
- `CreatePointAwardInput.imageFile`; signed URL + GIF URL into card; notify-block ordering; delete cleanup → Task 3. ✓
- Card builder GIF + photo widgets, ordering, omission when absent → Task 2. ✓
- Form conditional file input (only when notifying; cleared on toggle off; optional) → Task 4. ✓
- Assets/env (`public/point-award-celebration.gif`, `APP_URL`) → Task 5 Step 5 + Global Constraints. ✓
- Testing for builder + actions + delete cleanup → Tasks 2, 3. ✓
- Leaderboard unchanged (out of scope) — no task touches Screen 2. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; commands list expected output. The only non-code "manual step" (Task 5 Step 5) is explicitly a note, not a code placeholder.

**Type consistency:** `PointAwardCardPayload.imageUrl`/`celebrationGifUrl`, `CreatePointAwardInput.imageFile`, the storage helpers (`uploadDocumentFile`/`getSignedUrl`/`removeFromBucket`), and the upload path prefix `point-awards/{id}/` are used identically across Tasks 2–4 and their tests. The card payload built in Task 3 matches the type extended in Task 2.
