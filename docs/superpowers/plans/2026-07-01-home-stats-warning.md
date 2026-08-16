# Home Stats + Warning Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the home page with a "Thống kê D8" stat block, file-type icons on recent documents, and a manager-only Warning section (projects missing this week's report + unallocated employees).

**Architecture:** Two new pure, unit-tested libs (`file-types.ts` for extension→icon-key mapping, `weekly-report.ts` for week-range parsing + deadline logic + missing-project computation) feed a server-component rewrite of `src/app/(portal)/page.tsx`. The Warning section's data is fetched server-side only for managers (`dashboard:view`).

**Tech Stack:** Next.js 16 App Router (server components), Prisma 7, lucide-react, Tailwind v4, Vitest.

## Global Constraints

- UI text is Vietnamese.
- Pure libs (`file-types.ts`, `weekly-report.ts`) must have NO imports and no React — safe to unit-test in isolation.
- Warning section is visible only to managers: `can(role, "dashboard:view")` (ADMIN/DIVISION_LEADER/SECTION_MANAGER/PM). Hidden for MEMBER.
- "Reported" matching is case-insensitive and trimmed.
- Deadline default is Friday 10:00, overridable via env `WEEKLY_REPORT_DEADLINE` (format `"FRI 10:00"`); computed in server-local time.
- Unallocated employees exclude ADMIN and DIVISION_LEADER and mean "no active `ProjectAllocation`".
- No schema changes. Conventional Commits.

---

## File structure

- Create `src/lib/file-types.ts` + `tests/file-types.test.ts`.
- Create `src/lib/weekly-report.ts` + `tests/weekly-report.test.ts`.
- Modify `src/app/(portal)/page.tsx` (full rewrite — stats block, file icons, Warning section).
- Modify `d8-portal/CLAUDE.md` (home page sections, new libs, env var).

---

## Task 1: `file-types.ts` pure helper

**Files:**
- Create: `src/lib/file-types.ts`
- Test: `tests/file-types.test.ts`

**Interfaces:**
- Produces:
  - `type FileTypeKey = "pdf" | "xls" | "doc" | "ppt" | "md" | "txt" | "csv" | "zip" | "image" | "file"`
  - `fileTypeMeta(fileName: string): { key: FileTypeKey; label: string; tone: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/file-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fileTypeMeta } from "@/lib/file-types";

describe("fileTypeMeta()", () => {
  it("maps common extensions to keys", () => {
    expect(fileTypeMeta("report.pdf").key).toBe("pdf");
    expect(fileTypeMeta("data.xlsx").key).toBe("xls");
    expect(fileTypeMeta("old.xls").key).toBe("xls");
    expect(fileTypeMeta("plan.docx").key).toBe("doc");
    expect(fileTypeMeta("deck.pptx").key).toBe("ppt");
    expect(fileTypeMeta("notes.md").key).toBe("md");
    expect(fileTypeMeta("readme.txt").key).toBe("txt");
    expect(fileTypeMeta("rows.csv").key).toBe("csv");
    expect(fileTypeMeta("bundle.zip").key).toBe("zip");
    expect(fileTypeMeta("photo.PNG").key).toBe("image");
  });
  it("is case-insensitive and uses the last dotted segment", () => {
    expect(fileTypeMeta("ARCHIVE.final.PDF").key).toBe("pdf");
    expect(fileTypeMeta("a.b.c.docx").key).toBe("doc");
  });
  it("falls back to 'file' for unknown or missing extensions", () => {
    expect(fileTypeMeta("noext").key).toBe("file");
    expect(fileTypeMeta("weird.xyz").key).toBe("file");
    expect(fileTypeMeta("").key).toBe("file");
  });
  it("sets label to the uppercased extension or FILE", () => {
    expect(fileTypeMeta("report.pdf").label).toBe("PDF");
    expect(fileTypeMeta("noext").label).toBe("FILE");
  });
  it("returns a tailwind tone string", () => {
    expect(fileTypeMeta("report.pdf").tone).toMatch(/bg-.*text-/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- file-types`
Expected: FAIL ("Cannot find module '@/lib/file-types'").

- [ ] **Step 3: Implement the helper**

Create `src/lib/file-types.ts`:

```typescript
export type FileTypeKey = "pdf" | "xls" | "doc" | "ppt" | "md" | "txt" | "csv" | "zip" | "image" | "file";

const EXT_TO_KEY: Record<string, FileTypeKey> = {
  pdf: "pdf",
  xlsx: "xls", xls: "xls", xlsm: "xls",
  docx: "doc", doc: "doc",
  pptx: "ppt", ppt: "ppt",
  md: "md", markdown: "md",
  txt: "txt",
  csv: "csv",
  zip: "zip", rar: "zip", "7z": "zip",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
};

const TONE: Record<FileTypeKey, string> = {
  pdf: "bg-rose-50 text-rose-700",
  xls: "bg-emerald-50 text-emerald-700",
  doc: "bg-blue-50 text-blue-700",
  ppt: "bg-orange-50 text-orange-700",
  md: "bg-violet-50 text-violet-700",
  txt: "bg-slate-100 text-slate-600",
  csv: "bg-teal-50 text-teal-700",
  zip: "bg-amber-50 text-amber-700",
  image: "bg-fuchsia-50 text-fuchsia-700",
  file: "bg-slate-100 text-slate-600",
};

/** Map a file name to a display key (icon group), uppercase label, and Tailwind tone. Pure. */
export function fileTypeMeta(fileName: string): { key: FileTypeKey; label: string; tone: string } {
  const name = fileName ?? "";
  const dot = name.lastIndexOf(".");
  const ext = dot > -1 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
  const key = EXT_TO_KEY[ext] ?? "file";
  const label = ext ? ext.toUpperCase() : "FILE";
  return { key, label, tone: TONE[key] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- file-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-types.ts tests/file-types.test.ts
git commit -m "feat: add file-types helper for document icon mapping"
```

---

## Task 2: `weekly-report.ts` pure helper

**Files:**
- Create: `src/lib/weekly-report.ts`
- Test: `tests/weekly-report.test.ts`

**Interfaces:**
- Produces:
  - `parseWeekRange(raw: string): { start: Date; end: Date } | null`
  - `isWithinWeek(range: { start: Date; end: Date }, today: Date): boolean`
  - `type DeadlineCfg = { weekday: number; hour: number; minute: number }` (weekday 1=Mon..7=Sun)
  - `parseDeadlineEnv(raw: string | undefined): DeadlineCfg` (default `{ weekday: 5, hour: 10, minute: 0 }`)
  - `weeklyDeadline(today: Date, cfg: DeadlineCfg): Date`
  - `isPastDeadline(today: Date, deadline: Date): boolean`
  - `missingReportProjectNames(activeProjectNames: string[], reportedNames: Set<string>): string[]` (reportedNames already lowercased + trimmed; returns original active names not present)

- [ ] **Step 1: Write the failing test**

Create `tests/weekly-report.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseWeekRange, isWithinWeek, parseDeadlineEnv, weeklyDeadline, isPastDeadline, missingReportProjectNames,
} from "@/lib/weekly-report";

describe("parseWeekRange()", () => {
  it("parses 'DD/MM – DD/MM/YYYY' (en-dash), inheriting the year for the start", () => {
    const r = parseWeekRange("08/06 – 12/06/2026")!;
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(5); // June (0-based)
    expect(r.start.getDate()).toBe(8);
    expect(r.end.getDate()).toBe(12);
  });
  it("parses a plain hyphen separator too", () => {
    expect(parseWeekRange("01/06 - 05/06/2026")).not.toBeNull();
  });
  it("returns null for unparseable input", () => {
    expect(parseWeekRange("không xác định")).toBeNull();
    expect(parseWeekRange("")).toBeNull();
  });
});

describe("isWithinWeek()", () => {
  const range = parseWeekRange("08/06 – 12/06/2026")!;
  it("is true for a day inside the range (inclusive ends)", () => {
    expect(isWithinWeek(range, new Date(2026, 5, 8, 9, 0))).toBe(true);
    expect(isWithinWeek(range, new Date(2026, 5, 12, 23, 0))).toBe(true);
    expect(isWithinWeek(range, new Date(2026, 5, 10))).toBe(true);
  });
  it("is false outside the range", () => {
    expect(isWithinWeek(range, new Date(2026, 5, 7))).toBe(false);
    expect(isWithinWeek(range, new Date(2026, 5, 13))).toBe(false);
  });
});

describe("parseDeadlineEnv()", () => {
  it("defaults to Friday 10:00 when missing or invalid", () => {
    expect(parseDeadlineEnv(undefined)).toEqual({ weekday: 5, hour: 10, minute: 0 });
    expect(parseDeadlineEnv("garbage")).toEqual({ weekday: 5, hour: 10, minute: 0 });
  });
  it("parses 'MON 08:30'", () => {
    expect(parseDeadlineEnv("MON 08:30")).toEqual({ weekday: 1, hour: 8, minute: 30 });
  });
});

describe("weeklyDeadline()", () => {
  it("returns the configured weekday/time within today's (Mon-start) week", () => {
    // Wed 2026-06-10 → Friday of that week is 2026-06-12 10:00
    const d = weeklyDeadline(new Date(2026, 5, 10, 15, 0), { weekday: 5, hour: 10, minute: 0 });
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(0);
  });
  it("handles Sunday as the last day of the week", () => {
    // Sun 2026-06-14 still belongs to the week Mon 06-08 .. Sun 06-14; Friday is 06-12
    const d = weeklyDeadline(new Date(2026, 5, 14, 12, 0), { weekday: 5, hour: 10, minute: 0 });
    expect(d.getDate()).toBe(12);
  });
});

describe("isPastDeadline()", () => {
  it("compares timestamps", () => {
    const deadline = new Date(2026, 5, 12, 10, 0);
    expect(isPastDeadline(new Date(2026, 5, 12, 10, 1), deadline)).toBe(true);
    expect(isPastDeadline(new Date(2026, 5, 12, 9, 59), deadline)).toBe(false);
  });
});

describe("missingReportProjectNames()", () => {
  it("returns active names not present in the reported set (case-insensitive, trimmed)", () => {
    const reported = new Set(["sbi trading platform"]);
    expect(missingReportProjectNames(["SBI Trading Platform", "  AEON Loyalty App "], reported))
      .toEqual(["  AEON Loyalty App "]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- weekly-report`
Expected: FAIL ("Cannot find module '@/lib/weekly-report'").

- [ ] **Step 3: Implement the helper**

Create `src/lib/weekly-report.ts`:

```typescript
export type DeadlineCfg = { weekday: number; hour: number; minute: number };

const WEEKDAYS: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };
const DEFAULT_CFG: DeadlineCfg = { weekday: 5, hour: 10, minute: 0 };

/** Parse "DD/MM – DD/MM/YYYY" (en-dash or hyphen) into start/end Dates. Null if unparseable. */
export function parseWeekRange(raw: string): { start: Date; end: Date } | null {
  if (!raw) return null;
  const parts = raw.split(/\s*[–-]\s*/);
  if (parts.length !== 2) return null;
  const left = parts[0].trim().split("/");
  const right = parts[1].trim().split("/");
  if (left.length < 2 || right.length !== 3) return null;
  const year = Number(right[2]);
  const sd = Number(left[0]), sm = Number(left[1]);
  const ed = Number(right[0]), em = Number(right[1]);
  if ([year, sd, sm, ed, em].some((n) => Number.isNaN(n))) return null;
  const start = new Date(year, sm - 1, sd, 0, 0, 0, 0);
  const end = new Date(year, em - 1, ed, 23, 59, 59, 999);
  return { start, end };
}

export function isWithinWeek(range: { start: Date; end: Date }, today: Date): boolean {
  const t = today.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/** Parse "FRI 10:00" → cfg. Falls back to Friday 10:00 on missing/invalid input. */
export function parseDeadlineEnv(raw: string | undefined): DeadlineCfg {
  if (!raw) return { ...DEFAULT_CFG };
  const tokens = raw.trim().toUpperCase().split(/\s+/);
  if (tokens.length !== 2) return { ...DEFAULT_CFG };
  const weekday = WEEKDAYS[tokens[0]];
  const time = tokens[1].split(":");
  const hour = Number(time[0]), minute = Number(time[1]);
  if (!weekday || time.length !== 2 || Number.isNaN(hour) || Number.isNaN(minute)) return { ...DEFAULT_CFG };
  return { weekday, hour, minute };
}

/** The configured weekday/time within today's Monday-started week, in server-local time. */
export function weeklyDeadline(today: Date, cfg: DeadlineCfg): Date {
  const dow = today.getDay(); // 0=Sun..6=Sat
  const isoToday = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (isoToday - 1));
  const deadline = new Date(monday);
  deadline.setDate(monday.getDate() + (cfg.weekday - 1));
  deadline.setHours(cfg.hour, cfg.minute, 0, 0);
  return deadline;
}

export function isPastDeadline(today: Date, deadline: Date): boolean {
  return today.getTime() >= deadline.getTime();
}

/** Active project names whose normalized form is absent from `reportedNames` (already normalized). */
export function missingReportProjectNames(activeProjectNames: string[], reportedNames: Set<string>): string[] {
  return activeProjectNames.filter((n) => !reportedNames.has(n.trim().toLowerCase()));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- weekly-report`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekly-report.ts tests/weekly-report.test.ts
git commit -m "feat: add weekly-report week-range + deadline helpers"
```

---

## Task 3: Home page — Thống kê D8, file icons, Warning section

**Files:**
- Modify: `src/app/(portal)/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `fileTypeMeta` + `FileTypeKey` (Task 1); `parseWeekRange`, `isWithinWeek`, `parseDeadlineEnv`, `weeklyDeadline`, `isPastDeadline`, `missingReportProjectNames` (Task 2); `can` from `@/lib/permissions`.
- Produces: the reworked home page. No exports consumed by other tasks.

- [ ] **Step 1: Replace the page**

Replace the ENTIRE contents of `src/app/(portal)/page.tsx` with:

```tsx
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  MessageSquare,
  Pin,
  TrendingUp,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
import { fileTypeMeta, type FileTypeKey } from "@/lib/file-types";
import {
  parseWeekRange,
  isWithinWeek,
  parseDeadlineEnv,
  weeklyDeadline,
  isPastDeadline,
  missingReportProjectNames,
} from "@/lib/weekly-report";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const FILE_ICONS: Record<FileTypeKey, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  ppt: FileText,
  md: FileText,
  txt: FileText,
  csv: FileText,
  xls: FileSpreadsheet,
  zip: FileArchive,
  image: FileImage,
  file: File,
};

function SectionHeader({ icon, title, href }: { icon: React.ReactNode; title: string; href?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between border-b border-[#dbe3ef] px-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
        <span className="text-[#0b72ff]">{icon}</span>
        {title}
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b72ff] hover:text-[#003c9e]">
          Xem tất cả
          <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const session = await auth();
  const name = session!.user.name ?? "User";
  const isManager = can(session!.user.role, "dashboard:view");

  const [
    openMeetings,
    docs,
    wikiPages,
    agents,
    officialUsers,
    internUsers,
    openProjects,
    closeProjects,
    announcements,
    recentDocs,
    topics,
    recentMeetings,
    topAgents,
  ] = await Promise.all([
    db.meeting.count({ where: { status: { not: "CLOSED" } } }),
    db.document.count(),
    db.wikiPage.count(),
    db.aIAgent.count(),
    db.user.count({ where: { employeeType: "OFFICIAL" } }),
    db.user.count({ where: { employeeType: "INTERN" } }),
    db.project.count({ where: { active: true } }),
    db.project.count({ where: { active: false } }),
    db.announcement.findMany({
      where: activeAnnouncementWhere(),
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
      include: { author: true },
    }),
    db.document.findMany({ orderBy: { updatedAt: "desc" }, take: 4, include: { author: true } }),
    db.topic.findMany({ orderBy: { updatedAt: "desc" }, take: 3, include: { author: true, _count: { select: { comments: true } } } }),
    db.meeting.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { owner: true } }),
    db.aIAgent.findMany({ orderBy: [{ rating: "desc" }, { createdAt: "desc" }], take: 3 }),
  ]);

  const totalUsers = officialUsers + internUsers;
  const totalProjects = openProjects + closeProjects;
  const featuredAnnouncement = announcements[0];

  // Manager-only Warning data
  let missingProjects: { id: string; name: string; pm: string }[] = [];
  let unallocated: { id: string; name: string; section: string | null; title: string | null }[] = [];
  let showMissing = false;
  if (isManager) {
    const today = new Date();
    const deadline = weeklyDeadline(today, parseDeadlineEnv(process.env.WEEKLY_REPORT_DEADLINE));
    showMissing = isPastDeadline(today, deadline);

    const [weekMeetings, activeProjects, unallocatedUsers] = await Promise.all([
      db.meeting.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { weekRange: true, eeRows: { select: { project: true } } } }),
      db.project.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, allocations: { where: { role: "PM", active: true }, select: { user: { select: { name: true } } } } },
      }),
      db.user.findMany({
        where: { role: { notIn: ["ADMIN", "DIVISION_LEADER"] }, allocations: { none: { active: true } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, section: true, title: true },
      }),
    ]);

    const reported = new Set<string>();
    for (const m of weekMeetings) {
      const range = parseWeekRange(m.weekRange);
      if (range && isWithinWeek(range, today)) {
        for (const ee of m.eeRows) reported.add(ee.project.trim().toLowerCase());
      }
    }
    const missingNames = new Set(missingReportProjectNames(activeProjects.map((p) => p.name), reported));
    missingProjects = activeProjects
      .filter((p) => missingNames.has(p.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        pm: p.allocations.map((a) => a.user?.name).filter(Boolean).join(", ") || "Chưa có PM",
      }));
    unallocated = unallocatedUsers;
  }

  const upcoming = [
    { day: "13", month: "06", title: "Release Rakuten EC v2.4", type: "Release" },
    { day: "15", month: "06", title: "Go-live PM Sharing Portal", type: "Sự kiện" },
    { day: "18", month: "06", title: "Khách Panasonic thăm office", type: "Khách hàng" },
    { day: "20", month: "06", title: "Deadline báo cáo Q2 các PM", type: "Deadline" },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#112b86_0%,#0f4ed0_55%,#2684ff_100%)] p-7 text-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-100">Thứ sáu, 12/06/2026 · Tuần 24</p>
            <h1 className="mt-3 text-3xl font-black leading-tight">Chào {name.split(" ").slice(-1)[0]}, đây là bản tin Division 8</h1>
            <p className="mt-2 text-sm text-blue-100">
              {openMeetings} meeting đang theo dõi · {recentDocs.length} tài liệu mới tuần này · {topics.length} topic bạn theo dõi có trả lời mới.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/12 p-5 shadow-inner">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-blue-100">
              <Bell size={15} />
              Thông báo ghim
            </div>
            <p className="font-bold">{featuredAnnouncement?.title ?? "Triển khai PM Sharing Portal - go-live nội bộ 15/06"}</p>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              {featuredAnnouncement ? htmlToText(featuredAnnouncement.body) : "Toàn bộ PM bắt đầu cập nhật Weekly Meeting trên Portal từ tuần 25. Dữ liệu Excel cũ sẽ được migrate xong trước 14/06."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Weekly Meeting", sub: "Tuần 24 đang mở", icon: CalendarDays, href: "/meetings" },
          { label: "Documents", sub: `${docs} tài liệu`, icon: FileText, href: "/knowledge/documents" },
          { label: "Wiki", sub: `${wikiPages} trang`, icon: BookOpen, href: "/knowledge/wiki" },
          { label: "AI Agents", sub: `${agents} agent`, icon: Bot, href: "/agents" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="flex items-center gap-4 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-xl bg-[#e8f2ff] text-[#0b72ff]">
                <Icon size={21} />
              </span>
              <span>
                <span className="block font-bold text-slate-950">{card.label}</span>
                <span className="text-sm text-slate-500">{card.sub}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<TrendingUp size={16} />} title="Thống kê D8" />
            <div className="grid divide-y divide-[#dbe3ef] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <div className="text-3xl font-black text-[#001845]">{totalUsers}</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">Tổng số nhân viên</div>
                <div className="mt-0.5 text-sm text-slate-500">{officialUsers} Chính thức · {internUsers} Intern</div>
              </div>
              <div className="p-5">
                <div className="text-3xl font-black text-[#001845]">{totalProjects}</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">Tổng số dự án</div>
                <div className="mt-0.5 text-sm text-slate-500">{openProjects} Open · {closeProjects} Close</div>
              </div>
            </div>
          </section>

          {isManager && (
            <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
              <SectionHeader icon={<AlertTriangle size={16} />} title="Warning" />
              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-[#dbe3ef]">
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <FolderKanban size={15} className="text-amber-600" />
                    Dự án chưa có báo cáo tuần
                  </div>
                  <div className="space-y-2">
                    {showMissing && missingProjects.map((p) => (
                      <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                        <p className="font-semibold text-slate-950">{p.name}</p>
                        <p className="text-slate-600">PM: {p.pm}</p>
                        <p className="font-medium text-amber-700">Cập nhật report ngay</p>
                      </div>
                    ))}
                    {showMissing && missingProjects.length === 0 && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Tất cả dự án đã có báo cáo tuần</p>
                    )}
                    {!showMissing && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Chưa đến hạn báo cáo tuần</p>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Users size={15} className="text-amber-600" />
                    Nhân viên chưa được phân bổ dự án
                  </div>
                  <div className="space-y-2">
                    {unallocated.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(u.name)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-950">{u.name}</span>
                          {(u.title || u.section) && (
                            <span className="block truncate text-slate-500">{[u.title, u.section].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {unallocated.length === 0 && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Tất cả nhân viên đã được phân bổ</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<Bell size={16} />} title="Thông báo" />
            <div className="divide-y divide-[#dbe3ef]">
              {announcements.map((item) => (
                <div key={item.id} className="flex gap-4 px-4 py-4">
                  <div className="w-20 shrink-0">
                    {item.pinned ? (
                      <span className="portal-pill bg-[#0f46c8] text-white">
                        <Pin size={12} />
                        Ghim
                      </span>
                    ) : (
                      <span className="portal-pill bg-slate-100 text-slate-500">{formatDate(item.createdAt)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{htmlToText(item.body)}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.author.name} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<FileText size={16} />} title="Tài liệu cập nhật gần đây" href="/knowledge/documents" />
            <div className="divide-y divide-[#dbe3ef]">
              {recentDocs.map((doc) => {
                const meta = fileTypeMeta(doc.title);
                const Icon = FILE_ICONS[meta.key];
                return (
                  <Link key={doc.id} href={`/knowledge/documents/${doc.id}`} className="grid gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 sm:grid-cols-[48px_1fr_160px_100px] sm:items-center">
                    <span className={`grid size-9 place-items-center rounded-lg ${meta.tone}`} title={meta.label}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-950">{doc.title}</span>
                      <span className="text-slate-500">{doc.category}</span>
                    </span>
                    <span className="text-slate-600">{doc.author.name}</span>
                    <span className="text-right text-slate-500">{formatDate(doc.updatedAt)}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<MessageSquare size={16} />} title="Topic thảo luận sôi nổi" href="/topics" />
            <div className="divide-y divide-[#dbe3ef]">
              {topics.map((topic) => (
                <Link key={topic.id} href={`/topics/${topic.id}`} className="flex items-center gap-4 px-4 py-4 transition hover:bg-slate-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0f46c8] text-xs font-bold text-white">{initials(topic.author.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-950">{topic.title}</span>
                    <span className="text-sm text-slate-500">
                      {topic.author.name} · {formatDate(topic.updatedAt)}
                    </span>
                  </span>
                  <span className="portal-pill bg-slate-100 text-slate-500">
                    <MessageSquare size={13} />
                    {topic._count.comments}
                  </span>
                  <span className="portal-pill bg-slate-100 text-slate-500">👍 {topic.likes}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<CalendarDays size={16} />} title="Sự kiện sắp tới" />
            <div className="space-y-3 p-4">
              {upcoming.map((event) => (
                <div key={event.title} className="flex gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-50 text-center text-xs font-bold text-[#0f46c8]">
                    <span>
                      {event.day}
                      <br />
                      <span className="font-medium text-slate-400">{event.month}</span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-950">{event.title}</p>
                    <p className="text-xs text-slate-500">{event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<Bot size={16} />} title="AI Agent mới" href="/agents" />
            <div className="divide-y divide-[#dbe3ef]">
              {topAgents.map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                  <span className="grid size-10 place-items-center rounded-lg bg-[#1764d8] text-white">
                    <Bot size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-950">{agent.name}</span>
                    <span className="text-xs text-amber-500">★★★★★</span>
                    <span className="ml-1 text-xs text-slate-500">
                      {agent.rating.toFixed(1)} ({agent.ratingCount})
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<TrendingUp size={16} />} title="Hoạt động gần đây" />
            <div className="space-y-4 p-4">
              {recentMeetings.map((meeting) => (
                <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block text-sm">
                  <span className="font-semibold text-slate-900">{meeting.owner.name}</span>
                  <span className="text-slate-500"> cập nhật </span>
                  <span className="font-semibold text-[#0b72ff]">Weekly Meeting - {meeting.week}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{formatDate(meeting.updatedAt)}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck / build**

Run: `npm run build`
Expected: compiles clean (30 routes). No type errors. Note: `npm run lint` has a known pre-existing Windows-path failure unrelated to this change — build passing is the gate.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(portal\)/page.tsx
git commit -m "feat: home Thống kê D8, file-type doc icons, manager Warning section"
```

---

## Task 4: Documentation

**Files:**
- Modify: `d8-portal/CLAUDE.md`

- [ ] **Step 1: Update the home page description**

In `d8-portal/CLAUDE.md`, under the directory-layout note for `src/app/(portal)/`, append to the home (`/`) description:

```
The `/` home page shows: a "Thống kê D8" block (total employees with Official/Intern split, total projects with Open/Close split), recent documents with file-type icons (via `file-types.ts`), and a manager-only "Warning" section (left: active projects missing the current week's report — name appears in no current-week `MeetingEE` row, shown only after the weekly deadline; right: users with no active allocation, excluding ADMIN/DIVISION_LEADER).
```

- [ ] **Step 2: Document the new libs**

In the `src/lib` function reference, add:

```
- **file-types.ts** — `fileTypeMeta(fileName)` (pure): extension → `{ key, label, tone }` for document icon rendering.
- **weekly-report.ts** — pure helpers for the home Warning section: `parseWeekRange` ("DD/MM – DD/MM/YYYY" → start/end), `isWithinWeek`, `parseDeadlineEnv` (env `WEEKLY_REPORT_DEADLINE`, default FRI 10:00), `weeklyDeadline`, `isPastDeadline`, `missingReportProjectNames`.
```

- [ ] **Step 3: Document the env var**

In `d8-portal/CLAUDE.md`, add a note (near the stack/commands section) documenting:

```
- `WEEKLY_REPORT_DEADLINE` (optional, default `"FRI 10:00"`) — weekly-report submission deadline; the home Warning section flags projects missing a current-week report only after this time in the current calendar week.
```

- [ ] **Step 4: Commit**

```bash
git add d8-portal/CLAUDE.md
git commit -m "docs: document home stats/warning sections and WEEKLY_REPORT_DEADLINE"
```

---

## Final verification

- [ ] Run the full unit suite: `npm test`
  Expected: PASS (file-types, weekly-report, and all existing specs).
- [ ] Run `npm run build`
  Expected: production build succeeds.
- [ ] Manual smoke (optional, `npm run dev`):
  - Home shows Thống kê D8 with correct employee/project splits and file-type icons on recent documents.
  - As a manager after the deadline: Warning left lists active projects missing a current-week report (with PM / "Chưa có PM"); right lists unallocated non-admin/non-leader users.
  - As a MEMBER: no Warning section.

## Self-review notes

- **Spec coverage:** §1 stats → Task 3; §2 file-types lib → Task 1, rendering → Task 3; §3 weekly-report lib → Task 2, Warning UI/queries → Task 3; §4 env → Task 4 (+ read in Task 3); §5 tests → Tasks 1–2; §6 docs → Task 4. Acceptance criteria covered by Final verification.
- **Type consistency:** `FileTypeKey` defined in Task 1 and used for `FILE_ICONS` in Task 3. `weekly-report.ts` signatures (Task 2) match their call sites in Task 3 (`weeklyDeadline(today, parseDeadlineEnv(env))`, `isWithinWeek(range, today)`, `missingReportProjectNames(names, Set)`). `can(role, "dashboard:view")` is an existing capability. Prisma `allocations: { none: { active: true } }` uses the existing `User.allocations` relation.
