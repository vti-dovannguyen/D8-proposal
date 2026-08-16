import { describe, it, expect } from "vitest";
import {
  taskStage,
  isBlockedStatus,
  isHighPriority,
  isOverdue,
  isNewInRange,
  computeWeeklyReportStats,
  groupByCategory,
  selectRiskTasks,
  selectHighlights,
  buildWeeklyReportHtml,
  buildNarrativePrompt,
  parseNarrativeResponse,
  type ReportTask,
} from "@/lib/weekly-report-template";

const TODAY = new Date("2026-06-20T00:00:00Z");

function task(o: Partial<ReportTask> & Pick<ReportTask, "key" | "status">): ReportTask {
  return { title: "Task", assignee: "Nam", hours: 0, ...o };
}

describe("taskStage", () => {
  it("maps closed/resolved-like statuses to done", () => {
    expect(taskStage("Closed")).toBe("done");
    expect(taskStage("Resolved")).toBe("done");
  });
  it("maps in-progress-like statuses to inProgress", () => {
    expect(taskStage("In Progress")).toBe("inProgress");
  });
  it("defaults anything else to notStarted", () => {
    expect(taskStage("Open")).toBe("notStarted");
  });
});

describe("isBlockedStatus / isHighPriority", () => {
  it("detects blocked statuses", () => {
    expect(isBlockedStatus("Blocked")).toBe(true);
    expect(isBlockedStatus("Open")).toBe(false);
  });
  it("detects high priority", () => {
    expect(isHighPriority("High")).toBe(true);
    expect(isHighPriority("Normal")).toBe(false);
    expect(isHighPriority(undefined)).toBe(false);
  });
});

describe("isOverdue", () => {
  it("flags a dueDate before today", () => {
    expect(isOverdue("2026-06-19", TODAY)).toBe(true);
  });
  it("does not flag today or a future date", () => {
    expect(isOverdue("2026-06-20", TODAY)).toBe(false);
    expect(isOverdue("2026-06-21", TODAY)).toBe(false);
  });
  it("returns false for missing/invalid dueDate", () => {
    expect(isOverdue(null, TODAY)).toBe(false);
    expect(isOverdue("not-a-date", TODAY)).toBe(false);
  });
});

describe("isNewInRange", () => {
  it("matches a createdAt within the week window", () => {
    expect(isNewInRange("2026-06-16T10:00:00Z", "2026-06-15", "2026-06-21")).toBe(true);
  });
  it("rejects a createdAt outside the window", () => {
    expect(isNewInRange("2026-06-01T10:00:00Z", "2026-06-15", "2026-06-21")).toBe(false);
  });
});

describe("computeWeeklyReportStats", () => {
  it("counts stages, overdue, and new-this-week correctly", () => {
    const tasks: ReportTask[] = [
      task({ key: "1", status: "Closed" }),
      task({ key: "2", status: "In Progress", dueDate: "2026-06-19" }), // overdue
      task({ key: "3", status: "Open", createdAt: "2026-06-16T00:00:00Z" }), // new this week
      task({ key: "4", status: "Closed", dueDate: "2026-06-01" }), // done -> never overdue
    ];
    const stats = computeWeeklyReportStats(tasks, "2026-06-15", "2026-06-21", TODAY);
    expect(stats).toEqual({
      total: 4,
      done: 2,
      inProgress: 1,
      notStarted: 1,
      completionPct: 50,
      closedThisWeek: 2,
      newThisWeek: 1,
      overdue: 1,
    });
  });
  it("returns 0% completion for an empty task list", () => {
    expect(computeWeeklyReportStats([], "2026-06-15", "2026-06-21", TODAY).completionPct).toBe(0);
  });
});

describe("groupByCategory", () => {
  it("groups by milestone, falling back to category then a placeholder", () => {
    const tasks: ReportTask[] = [
      task({ key: "1", status: "Closed", milestone: "Sprint 1" }),
      task({ key: "2", status: "Open", milestone: "Sprint 1" }),
      task({ key: "3", status: "Open", category: "Backend" }),
      task({ key: "4", status: "Open" }),
    ];
    const groups = groupByCategory(tasks, TODAY);
    expect(groups.map((g) => g.name)).toEqual(expect.arrayContaining(["Sprint 1", "Backend", "Chưa phân loại"]));
    const sprint1 = groups.find((g) => g.name === "Sprint 1")!;
    expect(sprint1).toMatchObject({ total: 2, done: 1, inProgress: 0, notStarted: 1, completionPct: 50 });
  });
  it("marks a group red when it has a blocked or overdue task", () => {
    const groups = groupByCategory([task({ key: "1", status: "Blocked", milestone: "M1" })], TODAY);
    expect(groups[0].statusEmoji).toBe("🔴");
  });
});

describe("selectRiskTasks", () => {
  it("selects blocked, overdue, and high-priority-not-done tasks only", () => {
    const tasks: ReportTask[] = [
      task({ key: "1", status: "Blocked" }),
      task({ key: "2", status: "Open", dueDate: "2026-06-01" }),
      task({ key: "3", status: "Open", priority: "High" }),
      task({ key: "4", status: "Closed", priority: "High" }), // done -> excluded
      task({ key: "5", status: "Open", priority: "Low" }), // no risk factor -> excluded
    ];
    const risks = selectRiskTasks(tasks, TODAY);
    expect(risks.map((r) => r.task.key)).toEqual(["1", "2", "3"]);
    expect(risks.find((r) => r.task.key === "1")!.level).toBe("cao");
    expect(risks.find((r) => r.task.key === "3")!.level).toBe("tb");
  });
  it("sorts cao level before tb", () => {
    const tasks: ReportTask[] = [
      task({ key: "low", status: "Open", priority: "High" }),
      task({ key: "high", status: "Blocked" }),
    ];
    const risks = selectRiskTasks(tasks, TODAY);
    expect(risks.map((r) => r.task.key)).toEqual(["high", "low"]);
  });
});

describe("selectHighlights", () => {
  it("returns only done tasks", () => {
    const tasks: ReportTask[] = [task({ key: "1", status: "Closed" }), task({ key: "2", status: "Open" })];
    expect(selectHighlights(tasks).map((t) => t.key)).toEqual(["1"]);
  });
});

describe("buildWeeklyReportHtml", () => {
  const baseInput = {
    projectName: "D8 Portal",
    weekLabel: "15/06 – 21/06",
    reporterName: "Nam",
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    today: TODAY,
  };

  it("renders all 6 template sections", () => {
    const html = buildWeeklyReportHtml({ ...baseInput, tasks: [] });
    for (const heading of [
      "1. Tổng quan (Executive Summary)",
      "2. Tiến độ theo hạng mục (Progress)",
      "3. Vấn đề &amp; Rủi ro (Issues / Risks)",
      "4. Hành động cần làm (Actions / Next Steps)",
      "5. Kế hoạch tuần tới (Plan for Next Week)",
      "6. Phụ lục — Dữ liệu Backlog (Appendix)",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("escapes task titles to prevent HTML injection", () => {
    const html = buildWeeklyReportHtml({
      ...baseInput,
      tasks: [task({ key: "1", status: "Closed", title: "<script>alert(1)</script>" })],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses green/yellow/red overall status based on risk severity", () => {
    const green = buildWeeklyReportHtml({ ...baseInput, tasks: [task({ key: "1", status: "Closed" })] });
    expect(green).toContain("🟢");

    const red = buildWeeklyReportHtml({ ...baseInput, tasks: [task({ key: "1", status: "Blocked" })] });
    expect(red).toContain("🔴");
  });

  it("prefers AI-supplied narrative overrides over the deterministic defaults", () => {
    const html = buildWeeklyReportHtml({
      ...baseInput,
      tasks: [task({ key: "1", status: "Open" })],
      overallNote: "Custom overall note",
      escalationNote: "Custom escalation note",
      nextWeekPlan: ["Custom plan item"],
    });
    expect(html).toContain("Custom overall note");
    expect(html).toContain("Custom escalation note");
    expect(html).toContain("Custom plan item");
  });

  it("falls back to a deterministic narrative when none is supplied", () => {
    const html = buildWeeklyReportHtml({ ...baseInput, tasks: [] });
    expect(html).toContain("Không có task nào cập nhật trong tuần.");
    expect(html).toContain("Không có vấn đề cần escalate trong tuần này.");
  });

  it("marks the 'Tuần trước' trend column as unavailable", () => {
    const html = buildWeeklyReportHtml({ ...baseInput, tasks: [] });
    expect(html).toContain("chưa có dữ liệu lịch sử để so sánh");
  });
});

describe("parseNarrativeResponse", () => {
  it("parses a well-formed JSON reply", () => {
    const json = JSON.stringify({ overallNote: "ok", escalationNote: "none", nextWeekPlan: ["a", "b"] });
    expect(parseNarrativeResponse(json)).toEqual({ overallNote: "ok", escalationNote: "none", nextWeekPlan: ["a", "b"] });
  });
  it("tolerates an accidental ```json code fence", () => {
    const json = "```json\n" + JSON.stringify({ overallNote: "ok", escalationNote: "none", nextWeekPlan: [] }) + "\n```";
    expect(parseNarrativeResponse(json)).toEqual({ overallNote: "ok", escalationNote: "none", nextWeekPlan: [] });
  });
  it("returns null for invalid JSON or a shape mismatch", () => {
    expect(parseNarrativeResponse("not json")).toBeNull();
    expect(parseNarrativeResponse(JSON.stringify({ overallNote: "ok" }))).toBeNull();
    expect(parseNarrativeResponse(JSON.stringify({ overallNote: "ok", escalationNote: "x", nextWeekPlan: [1, 2] }))).toBeNull();
  });
});

describe("buildNarrativePrompt", () => {
  it("includes the project name and computed numbers", () => {
    const prompt = buildNarrativePrompt({
      projectName: "D8 Portal",
      stats: computeWeeklyReportStats([], "2026-06-15", "2026-06-21", TODAY),
      risks: [],
      groups: [],
    });
    expect(prompt).toContain("D8 Portal");
    expect(prompt).toContain("Không có issue rủi ro.");
  });
});
