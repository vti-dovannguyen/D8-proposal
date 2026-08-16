import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { formatDateOnlyRange } from "@/lib/meetings";
import type { SummarySectionGroup } from "@/lib/weekly-summary-report";

export type ExportEeRow = { project: string; plan: number; actual: number; note: string | null };
export type ExportRiskRow = {
  type: string;
  title: string;
  impact: string;
  actionPlan: string | null;
  status: string;
  planDate: Date | null;
};

export type WeeklySummaryExportInput = {
  week: string;
  weekStart: Date | null;
  weekEnd: Date | null;
  weekRange: string;
  execSummary: string | null;
  eeRows: ExportEeRow[];
  risks: ExportRiskRow[];
  eeNorm: number;
  summaryGroups: SummarySectionGroup[];
};

function formatDateOnly(date: Date | null): string {
  if (!date) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function mdEscape(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function eeEffortSection(rows: ExportEeRow[]): string {
  if (rows.length === 0) return "Không có dữ liệu EE.\n";
  const totalPlan = rows.reduce((s, r) => s + r.plan, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const lines = [
    "| Dự án | Plan | Actual | Chênh lệch | Ghi chú |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => {
      const variance = r.actual - r.plan;
      return `| ${mdEscape(r.project)} | ${r.plan} | ${r.actual} | ${variance > 0 ? "+" : ""}${variance} | ${mdEscape(r.note?.trim() || "—")} |`;
    }),
  ];
  const totalVariance = totalActual - totalPlan;
  lines.push(`| **Tổng** | **${totalPlan}** | **${totalActual}** | **${totalVariance > 0 ? "+" : ""}${totalVariance}** | |`);
  return `${lines.join("\n")}\n`;
}

function issuesRisksSection(rows: ExportRiskRow[]): string {
  if (rows.length === 0) return "Không có issue/risk.\n";
  const lines = [
    "| Type | Title | Priority | Mitigation / Action | Status | Plan Date |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${mdEscape(r.type)} | ${mdEscape(r.title)} | ${mdEscape(r.impact)} | ${mdEscape(r.actionPlan?.trim() || "—")} | ${mdEscape(r.status)} | ${formatDateOnly(r.planDate)} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function sourceReportSection(groups: SummarySectionGroup[], eeNorm: number): string {
  if (groups.length === 0) return "Không có report nào trong khoảng tuần đã chọn.\n";
  return groups
    .map((group) => {
      const lines = [
        `### ${group.section}`,
        "",
        "| Tên dự án | Tình trạng | Tình trạng EE | Risk/Issues | Notes |",
        "| --- | --- | --- | --- | --- |",
        ...group.rows.map((row) => {
          const ee = row.divisionEE != null ? `${row.divisionEE}%${row.divisionEE < eeNorm ? " ⚠" : ""}` : "—";
          return `| ${mdEscape(row.projectName)} | ${mdEscape(row.projectStatus)} | ${ee} | ${mdEscape(row.riskSummary)} | ${mdEscape(row.notes)} |`;
        }),
      ];
      return `${lines.join("\n")}\n`;
    })
    .join("\n");
}

/** Assembles the Markdown export for a "Summary Weekly" meeting detail page. */
export function buildWeeklySummaryMarkdown(input: WeeklySummaryExportInput): string {
  const sections = [
    `# ${input.week}`,
    "",
    `**Thời gian:** ${formatDateOnlyRange(input.weekStart, input.weekEnd, input.weekRange)}`,
    "",
    "## Executive Summary",
    "",
    htmlToMarkdown(input.execSummary ?? "") || "Không có.",
    "",
    "## EE - Effort Efficiency",
    "",
    eeEffortSection(input.eeRows),
    "",
    "## Issues / Risks",
    "",
    issuesRisksSection(input.risks),
    "",
    "## Report nguồn được tổng hợp",
    "",
    sourceReportSection(input.summaryGroups, input.eeNorm),
  ];
  return sections.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
