import { describe, it, expect, vi, beforeEach } from "vitest";

const generateAgentReplyMock = vi.fn();
vi.mock("@/lib/openai-agent", () => ({ generateAgentReply: (...a: unknown[]) => generateAgentReplyMock(...a) }));

import {
  uniqueProjectNames,
  summarizeRisks,
  truncateWords,
  groupBySection,
  buildNotes,
  dateOnlyRange,
  type SummaryProjectRow,
} from "@/lib/weekly-summary-report";

describe("dateOnlyRange", () => {
  it("widens a datetime-local range to full calendar days", () => {
    expect(dateOnlyRange("2026-06-15T09:30", "2026-06-21T17:00")).toEqual({
      rangeStart: new Date("2026-06-15T00:00:00.000"),
      rangeEnd: new Date("2026-06-21T23:59:59.999"),
    });
  });
  it("ignores the time-of-day so same-day picks with different clock times still match", () => {
    const a = dateOnlyRange("2026-06-15T09:30", "2026-06-15T09:30")!;
    const b = dateOnlyRange("2026-06-15T22:00", "2026-06-15T22:00")!;
    expect(a).toEqual(b);
  });
  it("returns null for blank or invalid input", () => {
    expect(dateOnlyRange("", "2026-06-21T17:00")).toBeNull();
    expect(dateOnlyRange("not-a-date", "2026-06-21T17:00")).toBeNull();
  });
});

describe("uniqueProjectNames", () => {
  it("dedupes and trims EE row project names", () => {
    expect(uniqueProjectNames({ eeRows: [{ project: "A" }, { project: "A " }, { project: "B" }], project: null })).toEqual(["A", "B"]);
  });
  it("drops blank EE row names", () => {
    expect(uniqueProjectNames({ eeRows: [{ project: "  " }, { project: "A" }], project: null })).toEqual(["A"]);
  });
  it("falls back to the linked project when there are no EE rows", () => {
    expect(uniqueProjectNames({ eeRows: [], project: { name: "Solo Project" } })).toEqual(["Solo Project"]);
  });
  it("returns an empty list when there are neither EE rows nor a linked project", () => {
    expect(uniqueProjectNames({ eeRows: [], project: null })).toEqual([]);
  });
});

describe("summarizeRisks", () => {
  it("reports no risks", () => {
    expect(summarizeRisks([])).toBe("Không có risk/issue.");
  });
  it("counts High/Critical and lists up to 3 titles", () => {
    const risks = [
      { title: "Vendor delay", impact: "HIGH" },
      { title: "API downtime", impact: "CRITICAL" },
      { title: "Minor bug", impact: "LOW" },
    ];
    expect(summarizeRisks(risks)).toBe("3 risks (2 High/Critical): Vendor delay, API downtime, Minor bug");
  });
  it("appends a +N more marker beyond 3 titles", () => {
    const risks = Array.from({ length: 5 }, (_, i) => ({ title: `Risk ${i}`, impact: "LOW" }));
    expect(summarizeRisks(risks)).toBe("5 risks: Risk 0, Risk 1, Risk 2 +2 khác");
  });
});

describe("truncateWords", () => {
  it("returns the text unchanged when within the word limit", () => {
    expect(truncateWords("a b c", 5)).toBe("a b c");
  });
  it("truncates and appends an ellipsis when over the limit", () => {
    expect(truncateWords("one two three four five", 3)).toBe("one two three…");
  });
  it("returns an empty string for blank input", () => {
    expect(truncateWords("   ", 5)).toBe("");
  });
});

describe("groupBySection", () => {
  const row = (section: string, projectName: string): SummaryProjectRow => ({
    meetingId: `m-${projectName}`, section, projectName, ownerName: "PM", updatedAt: "2026-06-16T00:00:00.000Z",
    projectStatus: "On Schedule", divisionEE: 90, riskSummary: "Không có risk/issue.", notes: "—",
  });

  it("groups rows by section, sections sorted alphabetically", () => {
    const groups = groupBySection([row("D8.2", "B"), row("D8.1", "A")]);
    expect(groups.map((g) => g.section)).toEqual(["D8.1", "D8.2"]);
    expect(groups[0].rows.map((r) => r.projectName)).toEqual(["A"]);
  });
  it("keeps multiple rows within the same section in original order", () => {
    const groups = groupBySection([row("D8.1", "A"), row("D8.1", "B")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((r) => r.projectName)).toEqual(["A", "B"]);
  });
});

describe("buildNotes", () => {
  beforeEach(() => generateAgentReplyMock.mockReset());

  it("returns em-dash for a blank Executive Summary", async () => {
    expect(await buildNotes(null)).toBe("—");
    expect(await buildNotes("")).toBe("—");
  });
  it("uses the AI summary when the agent reply mode is openai", async () => {
    generateAgentReplyMock.mockResolvedValue({ text: "Tóm tắt AI ngắn gọn.", mode: "openai" });
    expect(await buildNotes("<p>Nội dung report dài.</p>")).toBe("Tóm tắt AI ngắn gọn.");
  });
  it("falls back to a plain truncation when the agent reply is a mock (no API key)", async () => {
    generateAgentReplyMock.mockResolvedValue({ text: "mock reply", mode: "mock" });
    const html = `<p>${Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ")}</p>`;
    const result = await buildNotes(html);
    expect(result).not.toBe("mock reply");
    expect(result.endsWith("…")).toBe(true);
  });
});
