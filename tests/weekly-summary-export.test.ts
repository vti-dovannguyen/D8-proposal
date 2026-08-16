import { describe, it, expect } from "vitest";
import { buildWeeklySummaryMarkdown } from "@/lib/weekly-summary-export";

describe("buildWeeklySummaryMarkdown()", () => {
  const base = {
    week: "Tuần 32",
    weekStart: new Date(2026, 7, 1),
    weekEnd: new Date(2026, 7, 7),
    weekRange: "01/08 – 07/08/2026",
    execSummary: "<p>Tình hình <strong>ổn định</strong>.</p>",
    eeRows: [{ project: "SBI", plan: 100, actual: 90, note: "ok" }],
    risks: [{ type: "Issue", title: "Thiếu QA", impact: "HIGH", actionPlan: "Bổ sung QA", status: "Open", planDate: new Date(2026, 7, 5) }],
    eeNorm: 90,
    summaryGroups: [
      {
        section: "D8.1",
        rows: [
          {
            meetingId: "m1",
            section: "D8.1",
            projectName: "SBI",
            ownerName: "Tam",
            updatedAt: new Date(2026, 7, 3).toISOString(),
            projectStatus: "On Schedule",
            divisionEE: 85,
            riskSummary: "1 risk: Thiếu QA",
            notes: "On track",
          },
        ],
      },
    ],
  };

  it("includes all required sections with the week name and time range", () => {
    const out = buildWeeklySummaryMarkdown(base);
    expect(out).toContain("# Tuần 32");
    expect(out).toContain("**Thời gian:** 01/08/2026 – 07/08/2026");
    expect(out).toContain("## Executive Summary");
    expect(out).toContain("Tình hình **ổn định**.");
    expect(out).toContain("## EE - Effort Efficiency");
    expect(out).toContain("| SBI | 100 | 90 | -10 | ok |");
    expect(out).toContain("## Issues / Risks");
    expect(out).toContain("| Issue | Thiếu QA | HIGH | Bổ sung QA | Open | 05/08/2026 |");
    expect(out).toContain("## Report nguồn được tổng hợp");
    expect(out).toContain("### D8.1");
    expect(out).toContain("SBI");
  });

  it("falls back to placeholders when there is no data", () => {
    const out = buildWeeklySummaryMarkdown({ ...base, execSummary: null, eeRows: [], risks: [], summaryGroups: [] });
    expect(out).toContain("Không có.");
    expect(out).toContain("Không có dữ liệu EE.");
    expect(out).toContain("Không có issue/risk.");
    expect(out).toContain("Không có report nào trong khoảng tuần đã chọn.");
  });
});
