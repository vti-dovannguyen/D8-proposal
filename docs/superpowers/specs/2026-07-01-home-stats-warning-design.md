# Home Page — Thống kê D8, File-Type Icons, Warning Section — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Surface:** `src/app/(portal)/page.tsx` (the authenticated home page) + two new pure libs.

## Context

The home page (`src/app/(portal)/page.tsx`) is a server component shown to all authenticated
users. This change reworks three areas of it:

1. The "Tổng quan tuần (quản lý)" 4-metric block → a "Thống kê D8" block with 2 stat cards.
2. The "Tài liệu cập nhật gần đây" list → first column shows a file-type icon instead of a
   text extension badge.
3. A new manager-only "Warning" section with two columns: projects missing the current
   week's report, and employees not allocated to any project.

### Relevant data model (existing, unchanged)

- `Meeting` is a **per-section** weekly report (`week` free-text label, `weekRange` free-text
  like `"08/06 – 12/06/2026"`, `section`, `ownerId` = "PM phụ trách", `status`). Projects
  appear only as **name strings** inside `MeetingEE.project` (effort rows). There is no
  Meeting↔Project foreign key.
- `Project` has `name`, `section`, `active` (Open = true / Close = false). No PM field; a
  project's PM is a `ProjectAllocation` with `role = "PM"`.
- `ProjectAllocation`: `projectId`, optional `userId`/`user`, `role` (free string), `active`.
- `User`: `role` (ADMIN/DIVISION_LEADER/SECTION_MANAGER/PM/MEMBER), `employeeType`
  (OFFICIAL/INTERN), `section`, `title`, `allocations` relation.

### Key decisions (from brainstorming)

1. **Stats:** 2 cards — total employees (x Chính thức / y Intern) and total projects
   (x Open / y Close). Drop the old 4 metrics.
2. **Missing-report rule:** A project is "reported" if its `name` appears in any
   `MeetingEE` row of a meeting whose parsed `weekRange` contains **today**. Active projects
   not in that set are "missing".
3. **Deadline gating:** The Warning left panel renders **only when now ≥ the deadline**.
   Deadline = Friday at the env time of **today's calendar week** (computed from today, not
   from a meeting's `weekRange`). Env var `WEEKLY_REPORT_DEADLINE`, default `"FRI 10:00"`.
   Before the deadline the left panel is empty. If no current-week meeting exists, the
   reported set is empty → all active projects are flagged (once past the deadline).
4. **PM source:** user(s) on a `ProjectAllocation` with `role = "PM"` (active). Multiple →
   join names; none → "Chưa có PM".
5. **Unallocated employees:** `User`s with no active `ProjectAllocation`, **excluding**
   ADMIN and DIVISION_LEADER.
6. **Warning visibility:** managers only (`can(role, "dashboard:view")` — ADMIN /
   DIVISION_LEADER / SECTION_MANAGER / PM). Hidden for MEMBER. The Thống kê D8 and document
   sections stay visible to all.

### Out of scope (YAGNI)

No schema changes, no project↔meeting linkage, no email/notification on missing reports,
no per-section configurable deadlines, no real-time refresh.

## 1. `src/lib/file-types.ts` (new, pure, tested)

```
type FileTypeKey = "pdf" | "xls" | "doc" | "ppt" | "md" | "txt" | "csv" | "zip" | "image" | "file";
fileTypeMeta(fileName: string): { key: FileTypeKey; label: string; tone: string }
```

- Extracts the lowercase extension from `fileName` and maps it:
  - `pdf` → pdf; `xlsx`/`xls` → xls; `docx`/`doc` → doc; `pptx`/`ppt` → ppt; `md`/`markdown`
    → md; `txt` → txt; `csv` → csv; `zip`/`rar`/`7z` → zip;
    `png`/`jpg`/`jpeg`/`gif`/`webp`/`svg` → image; anything else / no extension → file.
- `label` is the uppercase extension (or `"FILE"`); `tone` is a Tailwind class pair
  (`bg-… text-…`) per key.
- Pure: no imports, no React. The page maps `key` → a lucide icon component.

## 2. `src/lib/weekly-report.ts` (new, pure, tested)

```
parseWeekRange(raw: string): { start: Date; end: Date } | null
isWithinWeek(range: {start;end}, today: Date): boolean
parseDeadlineEnv(raw: string | undefined): { weekday: number; hour: number; minute: number }   // default FRI 10:00
weeklyDeadline(today: Date, cfg): Date            // the configured weekday/time of today's week
isPastDeadline(today: Date, deadline: Date): boolean
missingReportProjectNames(activeProjectNames: string[], reportedNames: Set<string>): string[]
```

- `parseWeekRange` parses `"DD/MM – DD/MM/YYYY"` (en-dash or hyphen, optional spaces) into a
  start/end `Date`. The start `DD/MM` takes the year from the end token. Returns `null` on
  unparseable input (caller skips that meeting).
- `parseDeadlineEnv("FRI 10:00")` → `{ weekday: 5, hour: 10, minute: 0 }`. Accepts a 3-letter
  English weekday (MON..SUN) + `HH:MM`. Falls back to Friday 10:00 on missing/invalid input.
- `weeklyDeadline(today, cfg)` returns the `Date` for the configured weekday within the same
  calendar week as `today` (week starts Monday), at the configured time, in server-local time.
- Name matching is case-insensitive and trimmed.

## 3. `src/app/(portal)/page.tsx` changes

### 3a. Thống kê D8 section
- Add to `Promise.all`: `db.user.groupBy({ by: ["employeeType"], _count: true })` and
  `db.project.groupBy({ by: ["active"], _count: true })` (or two pairs of counts).
- Render 2 cards: "Tổng số nhân viên" → `total` with sub `"{official} Chính thức · {intern} Intern"`;
  "Tổng số dự án" → `total` with sub `"{open} Open · {close} Close"`.
- Replace the existing `<section>` titled "Tổng quan tuần (quản lý)" (header "Thống kê D8",
  no `/dashboard` link).

### 3b. File-type icons
- Replace the `extBadge` helper usage in the documents list. For each `doc`, compute
  `fileTypeMeta(doc.title)`; render a lucide icon chosen by `key` inside the existing
  `size`-styled span with `tone` classes, instead of the text badge.
- Icon map (page-local): pdf/doc/ppt/txt/md/csv → `FileText`-family; xls → `FileSpreadsheet`;
  zip → `FileArchive`; image → `FileImage`; file → `File`. (Exact lucide names finalized in
  the plan; all exist in `lucide-react`.)

### 3c. Warning section (managers only)
- Compute `isManager = can(session.user.role, "dashboard:view")`. Only when true, run the
  Warning queries and render the section.
- Queries:
  - Current-week meetings: `db.meeting.findMany({ orderBy: { createdAt: "desc" }, take: 30,
    include: { eeRows: { select: { project: true } } } })`, then filter in JS to those whose
    `parseWeekRange(weekRange)` `isWithinWeek(today)`. Collect EE project names → `reported` set.
  - Active projects + PM: `db.project.findMany({ where: { active: true },
    include: { allocations: { where: { role: "PM", active: true },
    include: { user: { select: { name: true } } } } } })`.
  - Unallocated users: `db.user.findMany({ where: { role: { notIn: ["ADMIN",
    "DIVISION_LEADER"] }, allocations: { none: { active: true } } },
    select: { id, name, section, title }, orderBy: { name: "asc" } })`.
- Deadline: `cfg = parseDeadlineEnv(process.env.WEEKLY_REPORT_DEADLINE)`;
  `deadline = weeklyDeadline(today, cfg)`; `showMissing = isPastDeadline(today, deadline)`.
- Left panel: when `showMissing`, list active projects whose name ∉ `reported`. Row =
  project name · PM names (or "Chưa có PM") · pill/text "Cập nhật report ngay". When not past
  deadline, render an empty/placeholder state ("Chưa đến hạn báo cáo" or empty).
- Right panel: list unallocated users. Empty state "Tất cả nhân viên đã được phân bổ".

## 4. Environment

- `WEEKLY_REPORT_DEADLINE` (optional, default `"FRI 10:00"`). Document in `.env.example` (if
  present) and `CLAUDE.md`. Read server-side only in `page.tsx`.

## 5. Tests

- `tests/file-types.test.ts`: extension mapping incl. case-insensitivity, multi-dot names,
  no-extension fallback, image/zip groups.
- `tests/weekly-report.test.ts`: `parseWeekRange` (valid en-dash/hyphen, year inheritance,
  invalid → null), `parseDeadlineEnv` (valid, invalid/missing → FRI 10:00), `weeklyDeadline`
  (correct weekday/time within today's week), `isWithinWeek`, `isPastDeadline`,
  `missingReportProjectNames` (case-insensitive, trim).

## 6. Docs

- `CLAUDE.md`: home page section description (Thống kê D8 + Warning), new libs
  (`file-types.ts`, `weekly-report.ts`), and the `WEEKLY_REPORT_DEADLINE` env var.

## Acceptance criteria

- Thống kê D8 shows correct total employees with Chính thức/Intern split and total projects
  with Open/Close split.
- The documents list shows a file-type icon matching each document's extension (pdf, xlsx,
  docx, md, txt, etc.), with a generic icon for unknown types.
- For a manager, after Friday 10:00 (configurable) of the current week, the Warning left
  panel lists active projects whose name does not appear in any current-week meeting's EE
  rows, each with its PM (or "Chưa có PM") and "Cập nhật report ngay". Before the deadline the
  panel is empty.
- The Warning right panel lists users with no active allocation, excluding ADMIN and
  DIVISION_LEADER.
- The entire Warning section is absent for MEMBER.
- `weekly-report.ts` and `file-types.ts` are pure and unit-tested; no schema changes.
