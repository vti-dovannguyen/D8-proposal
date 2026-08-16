import "server-only";
import { db } from "@/lib/db";
import { SUMMARY_WEEKLY_CATEGORY } from "@/lib/meetings";
import { htmlToText } from "@/lib/announcements";
import { generateAgentReply } from "@/lib/openai-agent";

// Builds the "Summary Weekly" rollup: every Weekly Meeting (across all
// sections/projects) whose Từ/Đến window overlaps the selected range,
// expanded to one row per project and grouped by section for the detail
// page's Accordion view.
//
// `queryWeeklySummaryReport` deliberately lives in a plain module (no "use
// server") rather than in meetings/actions.ts: it has no auth/authorization
// check of its own, so it must never be directly callable from the client.
// Both call sites (the SM/DL-gated `getWeeklySummaryReport` server action and
// the meeting detail page's read-only preload) enforce their own access
// rules before calling it.

export type SummaryProjectRow = {
  meetingId: string;
  section: string;
  projectName: string;
  ownerName: string;
  updatedAt: string; // ISO
  projectStatus: string;
  divisionEE: number | null;
  riskSummary: string;
  notes: string;
};

export type SummarySectionGroup = {
  section: string;
  rows: SummaryProjectRow[];
};

type RawRisk = { title: string; impact: string };

type RawMeeting = {
  id: string;
  section: string;
  updatedAt: Date;
  owner: { name: string };
  projectId: string | null;
  project: { name: string } | null;
  eeRows: { project: string }[];
  projectStatus: string;
  divisionEE: number | null;
  execSummary: string | null;
  risks: RawRisk[];
};

/**
 * Widen a Từ/Đến datetime-local range to full calendar days so the rollup
 * matches other sections' meetings by date only, ignoring time-of-day (PMs
 * rarely enter the exact same "Từ"/"Đến" clock time for the same week).
 * Returns null when either date is blank/invalid.
 */
export function dateOnlyRange(weekStart: string, weekEnd: string): { rangeStart: Date; rangeEnd: Date } | null {
  const startDate = weekStart?.trim().slice(0, 10);
  const endDate = weekEnd?.trim().slice(0, 10);
  if (!startDate || !endDate) return null;
  const rangeStart = new Date(`${startDate}T00:00:00.000`);
  const rangeEnd = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) return null;
  return { rangeStart, rangeEnd };
}

/** Unique, non-blank project names referenced by a meeting (EE rows first, falling back to its linked Project). */
export function uniqueProjectNames(meeting: Pick<RawMeeting, "eeRows" | "project">): string[] {
  const fromEe = meeting.eeRows.map((r) => r.project.trim()).filter(Boolean);
  const names = fromEe.length > 0 ? fromEe : meeting.project ? [meeting.project.name] : [];
  return [...new Set(names)];
}

/** Deterministic (no AI) Risk/Issues digest: count, High/Critical count, up to 3 titles. */
export function summarizeRisks(risks: RawRisk[]): string {
  if (risks.length === 0) return "Không có risk/issue.";
  const highCount = risks.filter((r) => r.impact === "HIGH" || r.impact === "CRITICAL").length;
  const shown = risks
    .slice(0, 3)
    .map((r) => r.title.trim())
    .filter(Boolean)
    .join(", ");
  const more = risks.length > 3 ? ` +${risks.length - 3} khác` : "";
  const highNote = highCount > 0 ? ` (${highCount} High/Critical)` : "";
  return `${risks.length} risk${risks.length > 1 ? "s" : ""}${highNote}: ${shown || "(không có tiêu đề)"}${more}`;
}

/** Truncates plain text to the first `maxWords` words, appending "…" when cut. */
export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Asks the LLM to compress Executive Summary plain text into one ~20-word
 * Vietnamese sentence. Returns null (never throws) on any failure — no API
 * key, network error, or the mock offline reply — so the caller always has
 * a deterministic fallback path.
 */
async function summarizeNotesWithAI(plainText: string): Promise<string | null> {
  try {
    const { text, mode } = await generateAgentReply({
      agent: {
        name: "Weekly Summary Notes",
        prompt:
          "Tóm tắt đoạn Executive Summary sau thành đúng 1 câu ngắn gọn, khoảng 20 từ, bằng tiếng Việt. Chỉ trả về văn bản thuần, không markdown, không trích dẫn, không tiêu đề.",
        description: null,
        useCase: null,
      },
      messages: [{ role: "user", text: plainText.slice(0, 4000) }],
    });
    if (mode !== "openai") return null; // offline mock reply isn't a real summary
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Notes column: AI summary of Executive Summary (~20 words), falling back to a plain truncation when the AI path is unavailable. */
export async function buildNotes(execSummaryHtml: string | null): Promise<string> {
  const plain = htmlToText(execSummaryHtml ?? "").trim();
  if (!plain) return "—";
  const aiSummary = await summarizeNotesWithAI(plain);
  return aiSummary ?? truncateWords(plain, 20);
}

/** Groups rows by section, sections sorted alphabetically. */
export function groupBySection(rows: SummaryProjectRow[]): SummarySectionGroup[] {
  const bySection = new Map<string, SummaryProjectRow[]>();
  for (const row of rows) {
    const list = bySection.get(row.section) ?? [];
    list.push(row);
    bySection.set(row.section, list);
  }
  return [...bySection.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([section, sectionRows]) => ({ section, rows: sectionRows }));
}

/** Expands one meeting into one row per referenced project name, sharing the meeting-level status/EE/risk/notes fields. */
async function buildProjectRows(m: RawMeeting): Promise<SummaryProjectRow[]> {
  const names = uniqueProjectNames(m);
  if (names.length === 0) return [];
  const [notes, riskSummary] = [await buildNotes(m.execSummary), summarizeRisks(m.risks)];
  return names.map((projectName) => ({
    meetingId: m.id,
    section: m.section,
    projectName,
    ownerName: m.owner.name,
    updatedAt: m.updatedAt.toISOString(),
    projectStatus: m.projectStatus,
    divisionEE: m.divisionEE,
    riskSummary,
    notes,
  }));
}

/**
 * Every Weekly Meeting (any section/project, excluding other Summary Weekly
 * rollups and — when given — the meeting the rollup itself belongs to) whose
 * Từ/Đến window overlaps the given range, expanded to one row per project and
 * grouped by section. Meetings created before the weekStart/weekEnd columns
 * existed (both null) can't be matched and are excluded.
 *
 * Not itself authorization-gated — see the module-level note above.
 */
export async function queryWeeklySummaryReport(
  weekStart: string,
  weekEnd: string,
  excludeMeetingId?: string,
): Promise<SummarySectionGroup[]> {
  const range = dateOnlyRange(weekStart, weekEnd);
  if (!range) throw new Error("Validation: cần nhập khoảng tuần (Từ / Đến) hợp lệ");
  const { rangeStart, rangeEnd } = range;
  if (rangeStart > rangeEnd) throw new Error("Validation: Từ phải trước Đến");

  const meetings = await db.meeting.findMany({
    where: {
      weekStart: { lte: rangeEnd },
      weekEnd: { gte: rangeStart },
      category: { not: SUMMARY_WEEKLY_CATEGORY },
      ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
    },
    include: {
      owner: { select: { name: true } },
      project: { select: { name: true } },
      eeRows: { select: { project: true } },
      risks: { select: { title: true, impact: true } },
    },
    orderBy: [{ section: "asc" }, { updatedAt: "desc" }],
  });

  const rows = (await Promise.all(meetings.map(buildProjectRows))).flat();
  return groupBySection(rows);
}
