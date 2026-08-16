// Builds the Weekly Progress Report (Executive Summary) HTML from the tasks
// pulled by pm-integrations.fetchWeeklyTasks, following the team's fixed
// report template (Tổng quan / Progress / Issues-Risks / Actions / Plan /
// Appendix). All numeric/table content is computed deterministically from
// the fetched data so its accuracy never depends on an LLM; the three
// narrative slots (overallNote/escalationNote/nextWeekPlan) can optionally be
// supplied by an LLM (see buildNarrativePrompt/parseNarrativeResponse) and
// otherwise fall back to a plain deterministic sentence.

export type ReportTask = {
  key: string;
  title: string;
  status: string;
  assignee: string;
  hours: number;
  priority?: string;
  category?: string;
  milestone?: string;
  dueDate?: string | null;
  createdAt?: string;
};

export type TaskStage = "done" | "inProgress" | "notStarted";

const DONE_RE = /closed|resolved|done|complete|reject|hoàn thành|đóng/i;
const PROGRESS_RE = /progress|doing|đang làm|in-progress/i;
const BLOCKED_RE = /block|chặn|stuck/i;
const HIGH_RE = /high|cao|khẩn|urgent|critical/i;

export function taskStage(status: string): TaskStage {
  if (DONE_RE.test(status)) return "done";
  if (PROGRESS_RE.test(status)) return "inProgress";
  return "notStarted";
}

export function isBlockedStatus(status: string): boolean {
  return BLOCKED_RE.test(status);
}

export function isHighPriority(priority?: string | null): boolean {
  return Boolean(priority && HIGH_RE.test(priority));
}

/** Date-only comparison so an issue due "today" isn't flagged overdue. */
export function isOverdue(dueDate: string | null | undefined, today: Date): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d.getTime() < todayDateOnly.getTime();
}

export function isNewInRange(createdAt: string | null | undefined, weekStart: string, weekEnd: string): boolean {
  if (!createdAt) return false;
  const c = createdAt.slice(0, 10);
  return c >= weekStart && c <= weekEnd;
}

function stageCounts(tasks: ReportTask[]) {
  let done = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const t of tasks) {
    const stage = taskStage(t.status);
    if (stage === "done") done++;
    else if (stage === "inProgress") inProgress++;
    else notStarted++;
  }
  const total = tasks.length;
  return { total, done, inProgress, notStarted, completionPct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export type WeeklyReportStats = {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  completionPct: number;
  closedThisWeek: number;
  newThisWeek: number;
  overdue: number;
};

export function computeWeeklyReportStats(
  tasks: ReportTask[],
  weekStart: string,
  weekEnd: string,
  today: Date = new Date(),
): WeeklyReportStats {
  const counts = stageCounts(tasks);
  let overdue = 0;
  let newThisWeek = 0;
  for (const t of tasks) {
    if (taskStage(t.status) !== "done" && isOverdue(t.dueDate, today)) overdue++;
    if (isNewInRange(t.createdAt, weekStart, weekEnd)) newThisWeek++;
  }
  return { ...counts, closedThisWeek: counts.done, newThisWeek, overdue };
}

export type CategoryGroup = {
  name: string;
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  completionPct: number;
  statusEmoji: "🟢" | "🟡" | "🔴";
};

export function groupByCategory(tasks: ReportTask[], today: Date = new Date()): CategoryGroup[] {
  const map = new Map<string, ReportTask[]>();
  for (const t of tasks) {
    const key = (t.milestone || t.category || "Chưa phân loại").trim() || "Chưa phân loại";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return [...map.entries()]
    .map(([name, rows]) => {
      const counts = stageCounts(rows);
      const hasRisk = rows.some((r) => isBlockedStatus(r.status) || (taskStage(r.status) !== "done" && isOverdue(r.dueDate, today)));
      const statusEmoji: CategoryGroup["statusEmoji"] = hasRisk ? "🔴" : counts.completionPct >= 70 ? "🟢" : "🟡";
      return { name, ...counts, statusEmoji };
    })
    .sort((a, b) => b.total - a.total);
}

export type RiskLevel = "cao" | "tb";
export type RiskTask = { task: ReportTask; level: RiskLevel; reason: string };

/** Section 3 criteria: status = Blocked, HOẶC overdue, HOẶC priority = High mà chưa Done. */
export function selectRiskTasks(tasks: ReportTask[], today: Date = new Date()): RiskTask[] {
  const out: RiskTask[] = [];
  for (const t of tasks) {
    if (taskStage(t.status) === "done") continue;
    const blocked = isBlockedStatus(t.status);
    const overdue = isOverdue(t.dueDate, today);
    const highPriority = isHighPriority(t.priority);
    if (!blocked && !overdue && !highPriority) continue;
    const reasons: string[] = [];
    if (blocked) reasons.push("Đang bị block");
    if (overdue) reasons.push(`Quá hạn (due ${t.dueDate})`);
    if (highPriority) reasons.push("Priority cao chưa hoàn thành");
    out.push({ task: t, level: blocked || overdue ? "cao" : "tb", reason: reasons.join("; ") });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "cao" ? -1 : 1));
}

export function selectHighlights(tasks: ReportTask[]): ReportTask[] {
  return tasks.filter((t) => taskStage(t.status) === "done");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultOverallNote(emoji: string, stats: WeeklyReportStats, riskCount: number): string {
  if (emoji === "🔴") return `Có ${stats.overdue} issue quá hạn hoặc rủi ro cao cần xử lý ngay.`;
  if (emoji === "🟡") return `Có ${riskCount} issue cần theo dõi, tiến độ đạt ${stats.completionPct}%.`;
  return `Tiến độ ổn định, đạt ${stats.completionPct}% trong tuần, không có rủi ro nổi bật.`;
}

function defaultEscalationNote(risks: RiskTask[]): string {
  if (risks.length === 0) return "Không có vấn đề cần escalate trong tuần này.";
  const keys = risks.slice(0, 5).map((r) => r.task.key).join(", ");
  return `Cần hỗ trợ xử lý ${risks.length} issue rủi ro: ${keys}.`;
}

function defaultNextWeekPlan(tasks: ReportTask[]): string[] {
  const pending = tasks
    .filter((t) => taskStage(t.status) !== "done")
    .sort((a, b) => Number(isHighPriority(b.priority)) - Number(isHighPriority(a.priority)));
  if (pending.length === 0) return ["Chưa xác định — không có task đang mở trong tuần."];
  return pending.slice(0, 5).map((t) => `${t.key} – ${t.title}`);
}

export type WeeklyReportInput = {
  projectName: string;
  weekLabel: string;
  reporterName: string;
  weekStart: string;
  weekEnd: string;
  tasks: ReportTask[];
  today?: Date;
  /** Optional AI-authored overrides; falls back to a deterministic sentence when absent. */
  overallNote?: string;
  escalationNote?: string;
  nextWeekPlan?: string[];
};

/** Assemble the full Weekly Progress Report as sanitizer-safe HTML (see sanitizeRichTextHtml's allowlist). */
export function buildWeeklyReportHtml(input: WeeklyReportInput): string {
  const today = input.today ?? new Date();
  const { tasks, weekStart, weekEnd } = input;
  const stats = computeWeeklyReportStats(tasks, weekStart, weekEnd, today);
  const groups = groupByCategory(tasks, today);
  const risks = selectRiskTasks(tasks, today);
  const highlights = selectHighlights(tasks);

  const overallEmoji = risks.some((r) => r.level === "cao") ? "🔴" : risks.length > 0 ? "🟡" : "🟢";
  const overallNote = input.overallNote?.trim() || defaultOverallNote(overallEmoji, stats, risks.length);
  const escalationNote = input.escalationNote?.trim() || defaultEscalationNote(risks);
  const nextWeekPlan = input.nextWeekPlan?.length ? input.nextWeekPlan : defaultNextWeekPlan(tasks);

  const totalOpen = stats.inProgress + stats.notStarted;
  const sections: string[] = [];

  sections.push("<h2>1. Tổng quan (Executive Summary)</h2>");
  sections.push(
    "<ul>" +
      `<li><strong>Dự án:</strong> ${escapeHtml(input.projectName)}</li>` +
      `<li><strong>Tuần báo cáo:</strong> ${escapeHtml(input.weekLabel)}</li>` +
      `<li><strong>Người báo cáo:</strong> ${escapeHtml(input.reporterName)}</li>` +
      `<li><strong>Tình trạng chung:</strong> ${overallEmoji} — ${escapeHtml(overallNote)}</li>` +
      "</ul>",
  );
  sections.push(
    "<table><thead><tr><th>Chỉ số</th><th>Tuần này</th><th>Tuần trước</th><th>Xu hướng</th></tr></thead><tbody>" +
      `<tr><td>Tiến độ tổng thể (%)</td><td>${stats.completionPct}</td><td>—</td><td>—</td></tr>` +
      `<tr><td>Issue đóng trong tuần</td><td>${stats.closedThisWeek}</td><td>—</td><td>—</td></tr>` +
      `<tr><td>Issue mở mới</td><td>${stats.newThisWeek}</td><td>—</td><td>—</td></tr>` +
      `<tr><td>Tổng còn open</td><td>${totalOpen}</td><td>—</td><td>—</td></tr>` +
      `<tr><td>Quá hạn (overdue)</td><td>${stats.overdue}</td><td>—</td><td>—</td></tr>` +
      "</tbody></table>",
  );

  sections.push("<hr><h2>2. Tiến độ theo hạng mục (Progress)</h2>");
  if (groups.length > 0) {
    const groupRows = groups
      .map(
        (g) =>
          `<tr><td>${escapeHtml(g.name)}</td><td>${g.total}</td><td>${g.done}</td><td>${g.inProgress}</td><td>${g.notStarted}</td><td>${g.completionPct}%</td><td>${g.statusEmoji}</td></tr>`,
      )
      .join("");
    const totalRow = `<tr><td><strong>Tổng</strong></td><td>${stats.total}</td><td>${stats.done}</td><td>${stats.inProgress}</td><td>${stats.notStarted}</td><td>${stats.completionPct}%</td><td></td></tr>`;
    sections.push(
      "<table><thead><tr><th>Hạng mục / Milestone</th><th>Tổng</th><th>Done</th><th>Đang làm</th><th>Chưa bắt đầu</th><th>% hoàn thành</th><th>Status</th></tr></thead>" +
        `<tbody>${groupRows}${totalRow}</tbody></table>`,
    );
  } else {
    sections.push("<p>Không có task nào cập nhật trong tuần.</p>");
  }
  if (highlights.length > 0) {
    sections.push(
      "<p><strong>Highlight tuần này (đã hoàn thành):</strong></p><ul>" +
        highlights.map((h) => `<li>✅ ${escapeHtml(h.key)} – ${escapeHtml(h.title)}</li>`).join("") +
        "</ul>",
    );
  } else {
    sections.push("<p><strong>Highlight tuần này (đã hoàn thành):</strong> Không có issue nào hoàn thành trong tuần.</p>");
  }

  sections.push("<hr><h2>3. Vấn đề &amp; Rủi ro (Issues / Risks) ⚠️</h2>");
  if (risks.length > 0) {
    const riskRows = risks
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(r.task.key)}</td><td>${escapeHtml(r.reason)}</td><td>${
            r.level === "cao" ? "🔴 Cao" : "🟡 TB"
          }</td><td>${escapeHtml(r.task.milestone || r.task.category || "—")}</td><td>${escapeHtml(
            r.task.assignee || "—",
          )}</td><td>${escapeHtml(r.task.status)}</td></tr>`,
      )
      .join("");
    sections.push(
      "<table><thead><tr><th>#</th><th>Issue (key)</th><th>Mô tả vấn đề</th><th>Mức độ</th><th>Ảnh hưởng</th><th>Assignee</th><th>Status</th></tr></thead>" +
        `<tbody>${riskRows}</tbody></table>`,
    );
  } else {
    sections.push("<p>Không có issue nào bị block, quá hạn, hoặc priority cao chưa hoàn thành trong tuần.</p>");
  }

  sections.push("<hr><h2>4. Hành động cần làm (Actions / Next Steps) 🎯</h2>");
  if (risks.length > 0) {
    const actionRows = risks
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>Xử lý: ${escapeHtml(r.reason)}</td><td>${escapeHtml(r.task.key)}</td><td>${escapeHtml(
            r.task.assignee || "—",
          )}</td><td>${escapeHtml(r.task.dueDate || "—")}</td><td>🔄 Doing</td></tr>`,
      )
      .join("");
    sections.push(
      "<table><thead><tr><th>#</th><th>Hành động</th><th>Ứng với issue nào</th><th>Người phụ trách</th><th>Hạn (due)</th><th>Trạng thái</th></tr></thead>" +
        `<tbody>${actionRows}</tbody></table>`,
    );
  } else {
    sections.push("<p>Không có hành động khẩn cấp cần theo dõi.</p>");
  }
  sections.push(
    `<p><strong>Cần quyết định / hỗ trợ từ cấp trên:</strong></p><blockquote>${escapeHtml(escalationNote)}</blockquote>`,
  );

  sections.push("<hr><h2>5. Kế hoạch tuần tới (Plan for Next Week)</h2>");
  sections.push(`<ul>${nextWeekPlan.map((p) => `<li>🎯 ${escapeHtml(p)}</li>`).join("")}</ul>`);

  sections.push("<hr><h2>6. Phụ lục — Dữ liệu Backlog (Appendix)</h2>");
  sections.push(
    `<p>Báo cáo tổng hợp từ ${stats.total} issue có cập nhật trong khoảng ${escapeHtml(weekStart)} – ${escapeHtml(
      weekEnd,
    )}. Cột "Tuần trước" chưa có dữ liệu lịch sử để so sánh.</p>`,
  );

  return sections.join("");
}

// ---------- Optional AI narrative overlay ----------

export const NARRATIVE_SYSTEM_PROMPT = `Bạn là trợ lý viết báo cáo tiến độ dự án tuần cho D8 Portal.
Dựa trên số liệu đã được tính sẵn (không tự suy diễn số liệu khác, không bịa thêm issue), hãy trả về DUY NHẤT một JSON hợp lệ — không markdown, không code fence, không giải thích thêm — theo đúng cấu trúc:
{"overallNote": "1 câu ngắn gọn giải thích vì sao dự án đang ở trạng thái đó", "escalationNote": "1-2 câu về vấn đề cần escalate lên cấp trên, hoặc câu xác nhận không có vấn đề nếu danh sách rủi ro rỗng", "nextWeekPlan": ["mục tiêu 1", "mục tiêu 2"]}
Viết bằng tiếng Việt, ngắn gọn, đúng trọng tâm.`;

export function buildNarrativePrompt(input: {
  projectName: string;
  stats: WeeklyReportStats;
  risks: RiskTask[];
  groups: CategoryGroup[];
}): string {
  const riskLines = input.risks.length
    ? input.risks.map((r) => `- ${r.task.key} (${r.task.status}): ${r.reason}`).join("\n")
    : "Không có issue rủi ro.";
  const groupLines = input.groups.length
    ? input.groups.map((g) => `- ${g.name}: ${g.done}/${g.total} done (${g.completionPct}%)`).join("\n")
    : "Không có dữ liệu hạng mục.";
  return [
    `Dự án: ${input.projectName}`,
    `Số liệu tuần: tổng ${input.stats.total} issue, hoàn thành ${input.stats.done}, đang làm ${input.stats.inProgress}, chưa bắt đầu ${input.stats.notStarted}, % hoàn thành ${input.stats.completionPct}%, quá hạn ${input.stats.overdue}, mới mở ${input.stats.newThisWeek}.`,
    `Danh sách rủi ro:\n${riskLines}`,
    `Tiến độ theo hạng mục:\n${groupLines}`,
  ].join("\n\n");
}

export type NarrativeResponse = { overallNote: string; escalationNote: string; nextWeekPlan: string[] };

/** Parse the LLM's JSON reply, tolerating an accidental ```json fence. Returns null on any mismatch. */
export function parseNarrativeResponse(text: string): NarrativeResponse | null {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj: unknown = JSON.parse(cleaned);
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as Record<string, unknown>).overallNote === "string" &&
      typeof (obj as Record<string, unknown>).escalationNote === "string" &&
      Array.isArray((obj as Record<string, unknown>).nextWeekPlan) &&
      ((obj as Record<string, unknown>).nextWeekPlan as unknown[]).every((x) => typeof x === "string")
    ) {
      const o = obj as NarrativeResponse;
      return { overallNote: o.overallNote, escalationNote: o.escalationNote, nextWeekPlan: o.nextWeekPlan };
    }
    return null;
  } catch {
    return null;
  }
}
