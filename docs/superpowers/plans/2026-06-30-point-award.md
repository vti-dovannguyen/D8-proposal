# Point Award Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Point Award" feature where SM/DL/Admin award monthly points (0–100) to a person or project, optionally push a Google Chat Card v2 notification, and everyone sees a per-month leaderboard (podium + ranked list, Cá nhân / Dự án tabs).

**Architecture:** One `PointAward` table with a `type` enum + two nullable FKs (`userId`/`projectId`), upserted per (month, target) via NULL-distinct unique indexes. Pure helpers for ranking/formatting/validation and a pure Google Chat card builder are unit-tested in isolation; server actions wire auth + persistence + notification; two App Router pages render the form and the leaderboard.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Prisma 7 (pg adapter), Postgres, Tailwind v4, lucide-react, Vitest.

## Global Constraints

- This is a breaking Next.js version — read `node_modules/next/dist/docs/` before writing framework code (per `AGENTS.md`). Middleware is named `proxy`.
- UI text is Vietnamese.
- Prisma client is generated to `src/generated/prisma` (never hand-edit); run `npx prisma generate` after schema edits.
- `month` is stored as `"YYYY-MM"`; validate with `MONTH_RE` from `src/lib/monthly-detail.ts`.
- `points` is an integer, `0 ≤ points ≤ 100`.
- Permission capability for create/delete: `point:award` → MANAGERS (ADMIN, DIVISION_LEADER, SECTION_MANAGER).
- Google Chat webhook env var: `GOOGLE_CHAT_WEBHOOK_URL`. When unset, notification is silently skipped (never throws, never blocks award creation).
- Server actions guard auth first and throw `new Error("Forbidden")` for unauthorized roles (existing pattern).
- Tests live in `tests/` mirroring lib/actions; run with `npm test` (Vitest). Lint with `npm run lint`.

---

### Task 1: Data model — `PointAward` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (User model ~line 49–75, after Role enum ~line 83, and Project model)
- Create: `prisma/migrations/20260630010000_point_award/migration.sql`

**Interfaces:**
- Produces: Prisma model `PointAward` with fields `id, month, type (PointAwardType), userId?, projectId?, points, reason, notified, notifiedAt, createdById, createdAt, updatedAt`; enum `PointAwardType { PERSON, PROJECT }`; delegate `db.pointAward` with `.upsert/.update/.delete/.findMany`; unique keys `month_userId` and `month_projectId`. Relations: `User.pointAwards`, `User.pointAwardsCreated`, `Project.pointAwards`.

- [ ] **Step 1: Add the enum and model to `prisma/schema.prisma`**

After the `Role` enum block, add:

```prisma
enum PointAwardType {
  PERSON
  PROJECT
}

model PointAward {
  id          String         @id @default(cuid())
  month       String         // "YYYY-MM"
  type        PointAwardType
  userId      String?
  user        User?          @relation("PointAwardTarget", fields: [userId], references: [id], onDelete: Cascade)
  projectId   String?
  project     Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  points      Int
  reason      String
  notified    Boolean        @default(false)
  notifiedAt  DateTime?
  createdById String
  createdBy   User           @relation("PointAwardCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([month, userId])
  @@unique([month, projectId])
  @@index([month, type])
}
```

- [ ] **Step 2: Add back-relations to `User`**

Inside `model User { ... }`, alongside the other relation fields (e.g. after `allocations ProjectAllocation[]`), add:

```prisma
  pointAwards        PointAward[] @relation("PointAwardTarget")
  pointAwardsCreated PointAward[] @relation("PointAwardCreatedBy")
```

- [ ] **Step 3: Add the back-relation to `Project`**

Inside `model Project { ... }`, alongside its relation fields (e.g. after `allocations ProjectAllocation[]`), add:

```prisma
  pointAwards PointAward[]
```

- [ ] **Step 4: Write the migration SQL**

Create `prisma/migrations/20260630010000_point_award/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "PointAwardType" AS ENUM ('PERSON', 'PROJECT');

-- CreateTable
CREATE TABLE "PointAward" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" "PointAwardType" NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointAward_month_userId_key" ON "PointAward"("month", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PointAward_month_projectId_key" ON "PointAward"("month", "projectId");

-- CreateIndex
CREATE INDEX "PointAward_month_type_idx" ON "PointAward"("month", "type");

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client ... to .\src\generated\prisma`

- [ ] **Step 6: Verify schema validity**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 7: Apply the migration to the database**

Run: `npx prisma migrate deploy`
Expected: applies `20260630010000_point_award` (or reports already applied). If the DB is unreachable in this environment, note it and continue — the migration file is committed for later deploy.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260630010000_point_award src/generated/prisma
git commit -m "feat: add PointAward model and migration"
```

---

### Task 2: Pure helpers — `src/lib/point-award.ts`

**Files:**
- Create: `src/lib/point-award.ts`
- Test: `tests/point-award-lib.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `POINT_AWARD_TYPES = ["PERSON", "PROJECT"] as const`; `type PointAwardType`; `POINT_AWARD_TYPE_LABELS: Record<PointAwardType, string>` (`PERSON→"Cá nhân"`, `PROJECT→"Dự án"`).
  - `POINT_MIN = 0`, `POINT_MAX = 100`.
  - `validatePoints(value: number): number` — returns the integer or throws.
  - `rankAwards<T extends { points: number; createdAt: Date | string }>(rows: T[]): T[]` — points desc, tie-break createdAt asc.
  - `splitPodium<T>(rows: T[]): { podium: T[]; rest: T[] }` — first 3 vs the remainder.
  - `formatMonth(month: string): string` → `"Tháng M/YYYY"`.

- [ ] **Step 1: Write the failing test**

Create `tests/point-award-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validatePoints, rankAwards, splitPodium, formatMonth,
  POINT_AWARD_TYPE_LABELS,
} from "@/lib/point-award";

describe("validatePoints", () => {
  it("accepts integers within 0..100", () => {
    expect(validatePoints(0)).toBe(0);
    expect(validatePoints(100)).toBe(100);
    expect(validatePoints(42)).toBe(42);
  });
  it("rejects out-of-range, non-integer, or NaN", () => {
    expect(() => validatePoints(-1)).toThrow(/point/i);
    expect(() => validatePoints(101)).toThrow(/point/i);
    expect(() => validatePoints(3.5)).toThrow(/point/i);
    expect(() => validatePoints(NaN)).toThrow(/point/i);
  });
});

describe("rankAwards", () => {
  it("sorts by points desc, breaking ties by earlier createdAt", () => {
    const rows = [
      { id: "a", points: 50, createdAt: "2026-06-02" },
      { id: "b", points: 90, createdAt: "2026-06-03" },
      { id: "c", points: 90, createdAt: "2026-06-01" },
    ];
    expect(rankAwards(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("does not mutate the input array", () => {
    const rows = [{ id: "a", points: 1, createdAt: "2026-06-01" }];
    rankAwards(rows);
    expect(rows[0].id).toBe("a");
  });
});

describe("splitPodium", () => {
  it("splits the first three from the rest", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(splitPodium(rows)).toEqual({ podium: [1, 2, 3], rest: [4, 5] });
  });
  it("handles fewer than three", () => {
    expect(splitPodium([1])).toEqual({ podium: [1], rest: [] });
    expect(splitPodium([])).toEqual({ podium: [], rest: [] });
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM as 'Tháng M/YYYY'", () => {
    expect(formatMonth("2026-06")).toBe("Tháng 6/2026");
    expect(formatMonth("2026-12")).toBe("Tháng 12/2026");
  });
});

describe("POINT_AWARD_TYPE_LABELS", () => {
  it("maps enum values to Vietnamese labels", () => {
    expect(POINT_AWARD_TYPE_LABELS.PERSON).toBe("Cá nhân");
    expect(POINT_AWARD_TYPE_LABELS.PROJECT).toBe("Dự án");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/point-award-lib.test.ts`
Expected: FAIL — cannot resolve `@/lib/point-award`.

- [ ] **Step 3: Implement `src/lib/point-award.ts`**

```ts
export const POINT_AWARD_TYPES = ["PERSON", "PROJECT"] as const;
export type PointAwardType = (typeof POINT_AWARD_TYPES)[number];
export const POINT_AWARD_TYPE_LABELS: Record<PointAwardType, string> = {
  PERSON: "Cá nhân",
  PROJECT: "Dự án",
};

export const POINT_MIN = 0;
export const POINT_MAX = 100;

export function validatePoints(value: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < POINT_MIN || n > POINT_MAX) {
    throw new Error(`Validation: point phải là số nguyên trong khoảng ${POINT_MIN}..${POINT_MAX}`);
  }
  return n;
}

type Rankable = { points: number; createdAt: Date | string };
export function rankAwards<T extends Rankable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function splitPodium<T>(rows: T[]): { podium: T[]; rest: T[] } {
  return { podium: rows.slice(0, 3), rest: rows.slice(3) };
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `Tháng ${Number(m)}/${year}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/point-award-lib.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/point-award.ts tests/point-award-lib.test.ts
git commit -m "feat: add point-award pure helpers"
```

---

### Task 3: Google Chat card — `src/lib/google-chat.ts`

**Files:**
- Create: `src/lib/google-chat.ts`
- Test: `tests/google-chat.test.ts`

**Interfaces:**
- Consumes: `formatMonth` from `@/lib/point-award`.
- Produces:
  - `type PointAwardCardPayload = { targetName: string; targetKind: "PERSON"|"PROJECT"; points: number; reason: string; month: string; awarderName: string; leaderboardUrl: string }`.
  - `buildPointAwardCard(p: PointAwardCardPayload): object` — pure Cards v2 JSON. Omits the button widget when `leaderboardUrl` is empty.
  - `sendPointAwardCard(p: PointAwardCardPayload): Promise<boolean>` — POSTs to `GOOGLE_CHAT_WEBHOOK_URL`; returns `false` when env unset or on any error; `true` on a 2xx response.

- [ ] **Step 1: Write the failing test**

Create `tests/google-chat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPointAwardCard, sendPointAwardCard, type PointAwardCardPayload } from "@/lib/google-chat";

const payload: PointAwardCardPayload = {
  targetName: "Nguyễn Văn A",
  targetKind: "PERSON",
  points: 85,
  reason: "Hoàn thành xuất sắc dự án X",
  month: "2026-06",
  awarderName: "Section Manager",
  leaderboardUrl: "https://portal.example/point-award",
};

describe("buildPointAwardCard", () => {
  it("builds a Cards v2 payload with header, points and button", () => {
    const card = JSON.stringify(buildPointAwardCard(payload));
    expect(card).toContain("cardsV2");
    expect(card).toContain("VINH DANH");
    expect(card).toContain("Tháng 6/2026");
    expect(card).toContain("+85");
    expect(card).toContain("Nguyễn Văn A");
    expect(card).toContain("https://portal.example/point-award");
  });
  it("omits the button when leaderboardUrl is empty", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, leaderboardUrl: "" }));
    expect(card).not.toContain("buttonList");
  });
});

describe("sendPointAwardCard", () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  beforeEach(() => { delete process.env.GOOGLE_CHAT_WEBHOOK_URL; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realEnv === undefined) delete process.env.GOOGLE_CHAT_WEBHOOK_URL;
    else process.env.GOOGLE_CHAT_WEBHOOK_URL = realEnv;
  });

  it("returns false and does not fetch when the webhook env is unset", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const ok = await sendPointAwardCard(payload);
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("posts to the webhook and returns true on a 2xx response", async () => {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = "https://chat.example/hook";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const ok = await sendPointAwardCard(payload);
    expect(ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
  it("returns false when fetch rejects", async () => {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = "https://chat.example/hook";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    expect(await sendPointAwardCard(payload)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/google-chat.test.ts`
Expected: FAIL — cannot resolve `@/lib/google-chat`.

- [ ] **Step 3: Implement `src/lib/google-chat.ts`**

```ts
import { formatMonth } from "@/lib/point-award";

export type PointAwardCardPayload = {
  targetName: string;
  targetKind: "PERSON" | "PROJECT";
  points: number;
  reason: string;
  month: string; // "YYYY-MM"
  awarderName: string;
  leaderboardUrl: string;
};

export function buildPointAwardCard(p: PointAwardCardPayload) {
  const icon = p.targetKind === "PERSON" ? "👤" : "📁";
  const kindLabel = p.targetKind === "PERSON" ? "Cá nhân" : "Dự án";
  const widgets: unknown[] = [
    { decoratedText: { topLabel: kindLabel, text: `<b>${icon} ${p.targetName}</b>` } },
    { decoratedText: { topLabel: "Điểm thưởng", text: `<b>⭐ +${p.points} điểm</b>` } },
    { textParagraph: { text: `💬 ${p.reason}` } },
    { textParagraph: { text: `<i>— by ${p.awarderName}</i>` } },
  ];
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

export async function sendPointAwardCard(p: PointAwardCardPayload): Promise<boolean> {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPointAwardCard(p)),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send Google Chat point-award card:", e);
    return false;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/google-chat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-chat.ts tests/google-chat.test.ts
git commit -m "feat: add Google Chat point-award card builder and sender"
```

---

### Task 4: Permissions capability + server actions

**Files:**
- Modify: `src/types/index.ts` (Capability union ~line 6–14)
- Modify: `src/lib/permissions.ts` (RULES ~line 6–15)
- Modify: `tests/permissions.test.ts` (add a case)
- Create: `src/app/(portal)/point-award/actions.ts`
- Test: `tests/point-award-actions.test.ts`

**Interfaces:**
- Consumes: `can`, `auth`, `db`, `MONTH_RE`, `validatePoints`, `POINT_AWARD_TYPES`, `PointAwardType`, `sendPointAwardCard`.
- Produces:
  - Capability literal `"point:award"`.
  - `type CreatePointAwardInput = { month: string; type: PointAwardType; userId?: string; projectId?: string; points: number; reason: string; sendNotification: boolean }`.
  - `createPointAward(input: CreatePointAwardInput): Promise<void>`.
  - `deletePointAward(id: string): Promise<void>`.

- [ ] **Step 1: Add the capability to the type union**

In `src/types/index.ts`, add `"point:award"` to the `Capability` union:

```ts
export type Capability =
  | "dashboard:view"
  | "meeting:edit"
  | "project:manage"
  | "ai-account:manage"
  | "content:edit"
  | "topic:create"
  | "admin:access"
  | "master-data:manage"
  | "point:award";
```

- [ ] **Step 2: Add the rule in `permissions.ts`**

In `src/lib/permissions.ts`, add to the `RULES` map (after `"master-data:manage"`):

```ts
  "point:award": (r) => MANAGERS.includes(r),
```

- [ ] **Step 3: Add a permissions test and run it**

In `tests/permissions.test.ts`, inside `describe("can()", ...)`, add:

```ts
  it("lets managers award points, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "point:award")).toBe(true);
    expect(can("PM", "point:award")).toBe(false);
    expect(can("MEMBER", "point:award")).toBe(false);
  });
```

Run: `npx vitest run tests/permissions.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing actions test**

Create `tests/point-award-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const userFindMock = vi.fn();
const projectFindMock = vi.fn();
const sendCardMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/google-chat", () => ({ sendPointAwardCard: (...a: unknown[]) => sendCardMock(...a) }));
vi.mock("@/lib/db", () => ({ db: {
  pointAward: {
    upsert: (...a: unknown[]) => upsertMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
  },
  user: { findUnique: (...a: unknown[]) => userFindMock(...a) },
  project: { findUnique: (...a: unknown[]) => projectFindMock(...a) },
} }));

import { createPointAward, deletePointAward } from "../src/app/(portal)/point-award/actions";

const baseInput = {
  month: "2026-06", type: "PERSON" as const, userId: "user2",
  points: 85, reason: "Tốt", sendNotification: false,
};

beforeEach(() => {
  authMock.mockReset(); upsertMock.mockReset(); updateMock.mockReset();
  deleteMock.mockReset(); userFindMock.mockReset(); projectFindMock.mockReset(); sendCardMock.mockReset();
  upsertMock.mockResolvedValue({ id: "pa1" });
  userFindMock.mockResolvedValue({ name: "Nguyễn Văn A" });
  projectFindMock.mockResolvedValue({ name: "Dự án X" });
});

describe("createPointAward", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createPointAward(baseInput)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("rejects out-of-range points", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, points: 101 })).rejects.toThrow(/point/i);
  });
  it("rejects an empty reason", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, reason: "   " })).rejects.toThrow(/lý do/i);
  });
  it("requires a person when type is PERSON", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, userId: "" })).rejects.toThrow(/cá nhân/i);
  });
  it("upserts on (month, userId) and skips notification when flag is off", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward(baseInput);
    const arg = upsertMock.mock.calls[0][0] as { where: unknown; create: { userId: string | null; projectId: string | null } };
    expect(arg.where).toEqual({ month_userId: { month: "2026-06", userId: "user2" } });
    expect(arg.create.userId).toBe("user2");
    expect(arg.create.projectId).toBeNull();
    expect(sendCardMock).not.toHaveBeenCalled();
  });
  it("upserts on (month, projectId) for a PROJECT award", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward({ month: "2026-06", type: "PROJECT", projectId: "proj9", points: 30, reason: "OK", sendNotification: false });
    const arg = upsertMock.mock.calls[0][0] as { where: unknown };
    expect(arg.where).toEqual({ month_projectId: { month: "2026-06", projectId: "proj9" } });
  });
  it("sends a notification and marks notified when the flag is on and send succeeds", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(true);
    await createPointAward({ ...baseInput, sendNotification: true });
    expect(sendCardMock).toHaveBeenCalledOnce();
    const upd = updateMock.mock.calls[0][0] as { data: { notified: boolean } };
    expect(upd.data.notified).toBe(true);
  });
  it("does not mark notified when send fails, and still saves the award", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(false);
    await createPointAward({ ...baseInput, sendNotification: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("deletePointAward", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(deletePointAward("pa1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("lets a manager delete", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await deletePointAward("pa1");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "pa1" } });
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/point-award-actions.test.ts`
Expected: FAIL — cannot resolve the actions module.

- [ ] **Step 6: Implement `src/app/(portal)/point-award/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MONTH_RE } from "@/lib/monthly-detail";
import { validatePoints, POINT_AWARD_TYPES, type PointAwardType } from "@/lib/point-award";
import { sendPointAwardCard } from "@/lib/google-chat";

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
};

export async function createPointAward(input: CreatePointAwardInput) {
  const awarder = await requireAwarder();
  if (!MONTH_RE.test(input.month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  if (!POINT_AWARD_TYPES.includes(input.type)) throw new Error("Validation: loại không hợp lệ");
  const points = validatePoints(input.points);
  const reason = input.reason.trim();
  if (!reason) throw new Error("Validation: lý do là bắt buộc");

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
    });
    if (sent) {
      await db.pointAward.update({ where: { id: award.id }, data: { notified: true, notifiedAt: new Date() } });
    }
  }
  revalidatePath("/point-award");
}

export async function deletePointAward(id: string) {
  await requireAwarder();
  await db.pointAward.delete({ where: { id } });
  revalidatePath("/point-award");
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/point-award-actions.test.ts tests/permissions.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/lib/permissions.ts tests/permissions.test.ts src/app/(portal)/point-award/actions.ts tests/point-award-actions.test.ts
git commit -m "feat: add point:award capability and point-award server actions"
```

---

### Task 5: Screen 1 — create form

**Files:**
- Create: `src/app/(portal)/point-award/new/page.tsx` (server component)
- Create: `src/app/(portal)/point-award/new/point-award-form.tsx` (client component)

**Interfaces:**
- Consumes: `createPointAward` from `../actions`; `POINT_AWARD_TYPE_LABELS` from `@/lib/point-award`; `can` / `auth` / `db`.
- Produces: routes `/point-award/new`. No exports consumed by later tasks.

- [ ] **Step 1: Implement the server page**

Create `src/app/(portal)/point-award/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PointAwardForm } from "./point-award-form";

export default async function NewPointAwardPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "point:award")) redirect("/point-award");

  const [users, projects] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tạo thưởng point</h1>
          <p className="portal-page-subtitle">Vinh danh cá nhân hoặc dự án theo tháng.</p>
        </div>
      </div>
      <PointAwardForm users={users} projects={projects} />
    </div>
  );
}
```

- [ ] **Step 2: Implement the client form**

Create `src/app/(portal)/point-award/new/point-award-form.tsx`:

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { POINT_AWARD_TYPE_LABELS, type PointAwardType } from "@/lib/point-award";
import { createPointAward } from "../actions";

type Opt = { id: string; name: string };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PointAwardForm({ users, projects }: { users: Opt[]; projects: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<PointAwardType>("PERSON");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState("");
  const [sendNotification, setSendNotification] = useState(true);

  const labelCls = "text-sm font-medium text-slate-700";
  const inputCls = "mt-1 block w-full rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm";

  const submit = () => {
    setError("");
    if (!reason.trim()) { setError("Lý do là bắt buộc"); return; }
    if (type === "PERSON" && !userId) { setError("Vui lòng chọn cá nhân"); return; }
    if (type === "PROJECT" && !projectId) { setError("Vui lòng chọn dự án"); return; }
    if (!Number.isInteger(points) || points < 0 || points > 100) { setError("Point phải là số nguyên 0..100"); return; }
    start(async () => {
      try {
        await createPointAward({ month, type, userId, projectId, points, reason, sendNotification });
        router.push("/point-award");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="max-w-xl space-y-4 rounded-xl border border-[#dbe3ef] bg-white p-5 shadow-sm"
    >
      <div>
        <label className={labelCls}>Tháng</label>
        <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div>
        <span className={labelCls}>Loại</span>
        <div className="mt-1 flex gap-4">
          {(["PERSON", "PROJECT"] as PointAwardType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
              {POINT_AWARD_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      {type === "PERSON" ? (
        <div>
          <label className={labelCls}>Cá nhân</label>
          <select className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Chọn cá nhân —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className={labelCls}>Dự án</label>
          <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Chọn dự án —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>Point (0–100)</label>
        <input type="number" min={0} max={100} step={1} className={inputCls} value={points}
          onChange={(e) => setPoints(Number(e.target.value))} />
      </div>

      <div>
        <label className={labelCls}>Lý do thưởng</label>
        <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sendNotification} onChange={(e) => setSendNotification(e.target.checked)} />
        Gửi thông báo đến Group chat Google
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Đang tạo…" : "Tạo"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npx eslint "src/app/(portal)/point-award/new/page.tsx" "src/app/(portal)/point-award/new/point-award-form.tsx"`
Expected: no output (clean).

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/point-award/new"
git commit -m "feat: add point award create form (screen 1)"
```

---

### Task 6: Screen 2 — leaderboard

**Files:**
- Create: `src/app/(portal)/point-award/page.tsx` (server component)
- Create: `src/app/(portal)/point-award/point-award-board.tsx` (client component: tabs + delete)

**Interfaces:**
- Consumes: `rankAwards`, `splitPodium`, `formatMonth`, `POINT_AWARD_TYPE_LABELS` from `@/lib/point-award`; `deletePointAward` from `./actions`; `can` / `auth` / `db`.
- Produces: route `/point-award`.

- [ ] **Step 1: Implement the server page**

Create `src/app/(portal)/point-award/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { rankAwards, formatMonth } from "@/lib/point-award";
import { PointAwardBoard, type BoardRow } from "./point-award-board";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PointAwardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canManage = can(session.user.role, "point:award");

  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? (sp.month as string) : currentMonth();

  const awards = await db.pointAward.findMany({
    where: { month },
    include: { user: { select: { name: true, image: true } }, project: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  const toRows = (kind: "PERSON" | "PROJECT"): BoardRow[] =>
    rankAwards(awards.filter((a) => a.type === kind)).map((a) => ({
      id: a.id,
      name: kind === "PERSON" ? a.user?.name ?? "N/A" : a.project?.name ?? "N/A",
      image: kind === "PERSON" ? a.user?.image ?? null : null,
      points: a.points,
      reason: a.reason,
      awarder: a.createdBy?.name ?? "",
    }));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Point Award</h1>
          <p className="portal-page-subtitle">Bảng xếp hạng điểm thưởng — {formatMonth(month)}.</p>
        </div>
        <div className="flex items-center gap-3">
          <form>
            <input type="month" name="month" defaultValue={month}
              className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" />
          </form>
          {canManage && (
            <Link href="/point-award/new"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-semibold text-white">
              ＋ Tạo thưởng
            </Link>
          )}
        </div>
      </div>

      <PointAwardBoard person={toRows("PERSON")} project={toRows("PROJECT")} canManage={canManage} />
    </div>
  );
}
```

Note: the month `<form>` uses default GET submission, appending `?month=YYYY-MM` — matching the `/admin` filter pattern (no submit button needed; pressing Enter or change+Enter submits; add an explicit submit if desired during review).

- [ ] **Step 2: Implement the client board (tabs + podium + list + delete)**

Create `src/app/(portal)/point-award/point-award-board.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { splitPodium, POINT_AWARD_TYPE_LABELS, type PointAwardType } from "@/lib/point-award";
import { deletePointAward } from "./actions";

export type BoardRow = {
  id: string;
  name: string;
  image: string | null;
  points: number;
  reason: string;
  awarder: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];

function Avatar({ row }: { row: BoardRow }) {
  if (row.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.image} alt={row.name} className="h-12 w-12 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-500">
      {row.name.charAt(0).toUpperCase()}
    </div>
  );
}

function Podium({ rows, canManage, onDelete }: { rows: BoardRow[]; canManage: boolean; onDelete: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {rows.map((r, i) => (
        <div key={r.id} className="relative rounded-xl border border-[#dbe3ef] bg-white p-4 text-center shadow-sm">
          <div className="text-3xl">{MEDAL[i]}</div>
          <div className="mt-2 flex justify-center"><Avatar row={r} /></div>
          <div className="mt-2 font-semibold text-slate-900">{r.name}</div>
          <div className="text-2xl font-black text-[var(--vti-deep,#0A3CA8)]">{r.points} điểm</div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500" title={r.reason}>{r.reason}</p>
          {canManage && (
            <button type="button" onClick={() => onDelete(r.id)} className="absolute right-2 top-2 text-xs text-red-500">Xóa</button>
          )}
        </div>
      ))}
    </div>
  );
}

function RestTable({ rows, startRank, canManage, onDelete }: {
  rows: BoardRow[]; startRank: number; canManage: boolean; onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="portal-table-card">
      <table className="portal-table">
        <thead><tr><th>#</th><th>Tên</th><th>Point</th><th>Lý do</th><th>Người thưởng</th>{canManage && <th></th>}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="font-semibold text-slate-500">{startRank + i}</td>
              <td className="font-semibold text-slate-900">{r.name}</td>
              <td>{r.points}</td>
              <td className="portal-table-muted">{r.reason}</td>
              <td className="portal-table-muted">{r.awarder}</td>
              {canManage && <td className="text-right"><button type="button" className="text-red-600" onClick={() => onDelete(r.id)}>Xóa</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PointAwardBoard({ person, project, canManage }: { person: BoardRow[]; project: BoardRow[]; canManage: boolean }) {
  const [tab, setTab] = useState<PointAwardType>("PERSON");
  const [pending, start] = useTransition();
  const rows = tab === "PERSON" ? person : project;
  const { podium, rest } = splitPodium(rows);
  const onDelete = (id: string) => { if (confirm("Xóa bản ghi thưởng này?")) start(() => deletePointAward(id)); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["PERSON", "PROJECT"] as PointAwardType[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={"rounded-lg px-4 py-1.5 text-sm font-semibold " + (tab === t ? "bg-[var(--vti-deep,#0A3CA8)] text-white" : "bg-slate-100 text-slate-600")}>
            {POINT_AWARD_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dbe3ef] bg-white px-4 py-12 text-center text-slate-400">
          Chưa có point thưởng trong tháng này.
        </div>
      ) : (
        <div className={"space-y-4 " + (pending ? "opacity-60" : "")}>
          <Podium rows={podium} canManage={canManage} onDelete={onDelete} />
          <RestTable rows={rest} startRank={podium.length + 1} canManage={canManage} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
```

Note on `confirm()`: this is a browser dialog. It is used here only for a user-initiated delete click (acceptable in this app's client components). If the project prefers the existing `components/ui/confirm-button`, swap it in during review.

- [ ] **Step 3: Verify it builds and lints**

Run: `npx eslint "src/app/(portal)/point-award/page.tsx" "src/app/(portal)/point-award/point-award-board.tsx"`
Expected: no output (clean).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/point-award/page.tsx" "src/app/(portal)/point-award/point-award-board.tsx"
git commit -m "feat: add point award leaderboard (screen 2)"
```

---

### Task 7: Navigation + docs

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (imports ~line 5–21; groups array ~line 45–86)
- Modify: `src/lib/nav.ts` (NAV_ITEMS ~line 15–31)
- Modify: `CLAUDE.md` (data model, lib reference, server actions, nav sections)

**Interfaces:**
- Consumes: nothing new.
- Produces: a visible "Point Award" sidebar entry for all roles.

- [ ] **Step 1: Add the `Trophy` icon import in `sidebar.tsx`**

In the `lucide-react` import list, add `Trophy`:

```tsx
  Grid3x3,
  Trophy,
} from "lucide-react";
```

- [ ] **Step 2: Add the nav item to the first group in `sidebar.tsx`**

In the first group's `items` array (the one starting with "Trang chủ"), add after the "Dashboard" line:

```tsx
      { label: "Point Award", href: "/point-award", icon: Trophy },
```

- [ ] **Step 3: Mirror the item in `src/lib/nav.ts`**

In `NAV_ITEMS`, add after the Dashboard entry:

```ts
  { label: "Point Award", href: "/point-award", icon: "Trophy", visible: ALL },
```

- [ ] **Step 4: Update `CLAUDE.md` system map**

- Under **Data model**, add to the model list: ``PointAward` (monthly point award: `month` "YYYY-MM", `type` PERSON/PROJECT, nullable `userId`/`projectId` target, `points` 0–100, `reason`, `notified`/`notifiedAt`, `createdById`; unique `[month,userId]` and `[month,projectId]`)`.
- Under **`src/lib` function reference**, add:
  - ``point-award.ts` — pure helpers for the Point Award screens: `validatePoints` (int 0–100), `rankAwards` (points desc, tie-break earlier createdAt), `splitPodium` (top 3 vs rest), `formatMonth`, `POINT_AWARD_TYPES`/`POINT_AWARD_TYPE_LABELS`.`
  - ``google-chat.ts` — `buildPointAwardCard` (pure Cards v2 JSON) + `sendPointAwardCard` (POST to `GOOGLE_CHAT_WEBHOOK_URL`; no-op/false when env unset; never throws).`
- Under **Server actions**, add: ``point-award`: `createPointAward` (upsert per month+target, optional Google Chat notify), `deletePointAward`. Both guard `point:award`.`
- Under **Roles & permissions**, add `point:award` to the capability list (MANAGERS).
- Under **Directory layout / routes**, note `/point-award` (leaderboard, all roles) and `/point-award/new` (create form, managers).

- [ ] **Step 5: Run the full suite and lint**

Run: `npm test`
Expected: all tests pass (including the new lib/actions/permissions specs).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/sidebar.tsx src/lib/nav.ts CLAUDE.md
git commit -m "feat: add Point Award nav item and update system map"
```

---

## Self-Review

**Spec coverage:**
- Screen 1 form (month, type, conditional target, points 0–100, reason, notify toggle, Tạo) → Task 5. ✓
- Screen 2 leaderboard (month filter default current, Top 1/2/3 podium, list from #4, Cá nhân/Dự án tabs) → Task 6. ✓
- Create restricted to SM/DL/Admin; leaderboard for all; delete on board for managers → `point:award` (Task 4) + page guards (Tasks 5/6). ✓
- One award per (month, target), upsert → schema unique indexes (Task 1) + action upsert (Task 4). ✓
- Google Chat Card v2, attractive format, gated by toggle + env → Task 3 + Task 4. ✓
- Webhook env `GOOGLE_CHAT_WEBHOOK_URL`, silent skip when unset → Tasks 3/4. ✓
- Tests + migration + CLAUDE.md → Tasks 1–7. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code; every command lists expected output. ✓

**Type consistency:** `CreatePointAwardInput`, `PointAwardCardPayload`, `BoardRow`, `PointAwardType`, helper names (`rankAwards`/`splitPodium`/`formatMonth`/`validatePoints`), upsert keys (`month_userId`/`month_projectId`) are used identically across tasks. ✓

**Open item for review (non-blocking):** the leaderboard month filter relies on default GET form submission (no submit button), matching `/admin`. If a button is preferred, add one in Task 6 Step 1. The card button URL uses an optional `APP_URL` env; when unset the button is omitted (card still sends). Note `APP_URL` in `.env` if you want the "Xem bảng xếp hạng" button to appear.
