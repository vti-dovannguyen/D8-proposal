# Point Award — Notification Image + Animation Design Spec

**Date:** 2026-06-30
**Status:** Approved (design)
**Builds on:** `2026-06-30-point-award-design.md` (the Point Award feature already shipped).

## 1. Summary

Enhance the Point Award **Google Chat notification** so it stands out:

1. When creating an award **with notification ON**, the manager can optionally **upload an image**, which is embedded in the Google Chat card.
2. The card always embeds a **fixed celebration GIF** (confetti/trophy) for an animated, eye-catching look.

Key constraints / decisions:
- **Animation = animated GIF only.** Google Chat Cards v2 support no CSS/JS animation; the only motion possible is an animated GIF in an image widget. (Rich CSS animation would only be possible on the web leaderboard, which is explicitly out of scope here.)
- The uploaded image is **chat-only** — it is NOT shown on the web leaderboard (Screen 2 is unchanged).
- The image upload UI is shown **only when the "Gửi thông báo Google Chat" toggle is ON**. Toggle off ⇒ element hidden, no upload, `imageUrl` stays null. So `imageUrl` is only ever set for notified awards.
- Image is **optional** even when notifying.

## 2. Data model

Add one nullable field to `PointAward`:

```prisma
  imageUrl    String?   // Supabase object PATH (not a URL); signed on read. Set only for notified awards with an uploaded image.
```

Migration `prisma/migrations/<ts>_point_award_image/migration.sql`:

```sql
ALTER TABLE "PointAward" ADD COLUMN "imageUrl" TEXT;
```

## 3. Upload & storage (reuse existing infra)

- Storage reuses `src/lib/storage.ts`:
  - Upload via **`uploadDocumentFile(path, file)`** — serves inline with real mime; the allowlist already includes `png/jpg/jpeg/gif/webp`. Path: `point-awards/{awardId}/{Date.now()}_{safeName}`.
  - Read via **`getSignedUrl(path)`** — inline signed URL (7-day TTL). Google Chat fetches and caches the image at message-post time, so the TTL is sufficient.
  - Delete cleanup via **`removeFromBucket(path)`**.
- An uploaded file is only accepted/stored when `sendNotification === true` AND a file is present. If `sendNotification === false`, any provided file is ignored.
- Validation: reject non-image extensions (only `png/jpg/jpeg/gif/webp`); the 50MB cap is enforced inside `uploadDocumentFile`.

## 4. Server action changes (`point-award/actions.ts`)

`CreatePointAwardInput` gains one optional field:

```ts
  imageFile?: File | null;
```

(Next.js Server Actions accept `File` in argument objects; no switch to FormData is needed, which preserves the existing action tests. The 50MB Server Action body limit is already configured — commit `ff9b78a`.)

`createPointAward` flow (additions in **bold**):
1. Auth + validation (unchanged).
2. Upsert the award (unchanged) → gives `award.id`.
3. **If `input.sendNotification` and `input.imageFile` is a non-empty File: validate it's an allowed image, upload via `uploadDocumentFile("point-awards/{award.id}/{ts}_{safeName}", file)`, then `db.pointAward.update({ where:{id}, data:{ imageUrl: path } })`.**
4. If `input.sendNotification`: resolve target/awarder names (unchanged), **mint `imageSignedUrl = imageUrl ? await getSignedUrl(imageUrl) : undefined`**, **compute `celebrationGifUrl = process.env.APP_URL ? \`${process.env.APP_URL}/point-award-celebration.gif\` : ""`**, call `sendPointAwardCard({ ...existing, imageUrl: imageSignedUrl, celebrationGifUrl })`; set `notified/notifiedAt` on success (unchanged).
5. `revalidatePath("/point-award")`.

`deletePointAward`: before deleting, read the award's `imageUrl`; after delete, if set, best-effort `removeFromBucket(imageUrl)` inside try/catch (same pattern as `deleteUserCertificate`). A cleanup failure must not fail the delete.

## 5. Google Chat card (`google-chat.ts`)

`PointAwardCardPayload` gains two optional fields:

```ts
  imageUrl?: string;          // signed URL of the uploaded image
  celebrationGifUrl?: string; // public URL of the fixed celebration GIF
```

`buildPointAwardCard` widget order (each image widget added only when its URL is non-empty):

1. **Celebration GIF** — `{ image: { imageUrl: celebrationGifUrl, altText: "🎉" } }` (only if `celebrationGifUrl`).
2. `decoratedText` — kind label + target name (existing).
3. `decoratedText` — `⭐ +N điểm` (existing).
4. **Uploaded photo** — `{ image: { imageUrl, altText: targetName } }` (only if `imageUrl`).
5. `textParagraph` — `💬 reason` (existing).
6. `textParagraph` — `— by awarder` (existing).
7. `buttonList` — "Xem bảng xếp hạng" (existing; only if `leaderboardUrl`).

`sendPointAwardCard` is unchanged except it forwards the two new payload fields (still no-ops when the webhook env is unset; still never throws).

## 6. Form (`point-award/new/point-award-form.tsx`)

- Add an optional `<input type="file" accept="image/*">` rendered **only when `sendNotification === true`**.
- Keep an `imageFile` state; clear it when the notification toggle is turned off.
- On submit, pass `imageFile` in the existing typed call: `createPointAward({ ...fields, imageFile })`.
- Client-side: image remains optional; existing validation unchanged. (Server enforces the image-type allowlist.)

## 7. Assets & env

- User adds `public/point-award-celebration.gif` (the confetti/trophy GIF).
- `APP_URL` must be set for the celebration GIF (and the existing "Xem bảng xếp hạng" button) to appear; both are omitted gracefully if unset.

## 8. Testing

- `tests/google-chat.test.ts` (extend): card includes the celebration GIF widget when `celebrationGifUrl` is given and omits it when absent; includes the uploaded-photo image widget when `imageUrl` is given and omits it when absent; widget order matches Section 5.
- `tests/point-award-actions.test.ts` (extend): with `sendNotification:true` + an image File, `uploadDocumentFile` is called and `pointAward.update` sets `imageUrl`, and `getSignedUrl` feeds the card payload; with `sendNotification:false` + a File, no upload happens; existing no-image cases still pass. `deletePointAward` calls `removeFromBucket` when the award had an `imageUrl` and skips it otherwise; a cleanup throw does not fail the delete.

## 9. Out of scope (YAGNI)

- Showing the uploaded image on the web leaderboard (Screen 2 unchanged).
- CSS/JS animation in the card (impossible in Google Chat).
- Multiple images / galleries per award.
- Per-award custom GIF selection (single fixed celebration GIF).

## 10. Assumptions & decisions

- `imageUrl` stores the Supabase object path; signed on read (matches documents/certificates).
- Image accepted only when notifying; element hidden when toggle off.
- Image optional; allowed types png/jpg/jpeg/gif/webp; ≤50MB.
- Celebration GIF served from `public/point-award-celebration.gif` via `APP_URL`; omitted if `APP_URL` unset.
- `createPointAward` keeps its typed-object signature with an added optional `imageFile`; no FormData switch.
