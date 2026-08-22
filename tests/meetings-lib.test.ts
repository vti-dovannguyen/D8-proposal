import { describe, it, expect, afterEach } from "vitest";
import { canDeleteMeeting, canEditMeeting, eeTotals, buildClonePayload, formatDateOnlyRange, RISK_TYPES, RISK_STATUSES, PROJECT_STATUSES, EE_NORM_DEFAULT, getEeNorm } from "@/lib/meetings";

describe("formatDateOnlyRange()", () => {
  it("formats a dd/MM/yyyy – dd/MM/yyyy range from weekStart/weekEnd, dropping the time", () => {
    expect(formatDateOnlyRange(new Date(2026, 5, 15, 9, 30), new Date(2026, 5, 19, 17, 0), "raw")).toBe("15/06/2026 – 19/06/2026");
  });
  it("falls back to the raw stored weekRange when either date is missing", () => {
    expect(formatDateOnlyRange(null, new Date(2026, 5, 19), "15/06 – 19/06/2026")).toBe("15/06 – 19/06/2026");
    expect(formatDateOnlyRange(new Date(2026, 5, 15), null, "raw")).toBe("raw");
  });
});

describe("canEditMeeting()", () => {
  it("lets an editor role edit a DRAFT", () => {
    expect(canEditMeeting("PM", "DRAFT")).toBe(true);
  });
  it("lets an editor role edit an OPEN meeting", () => {
    expect(canEditMeeting("SECTION_MANAGER", "OPEN")).toBe(true);
  });
  it("locks a CLOSED meeting even for editors", () => {
    expect(canEditMeeting("PM", "CLOSED")).toBe(false);
    expect(canEditMeeting("ADMIN", "CLOSED")).toBe(false);
  });
  it("never lets a Member edit", () => {
    expect(canEditMeeting("MEMBER", "DRAFT")).toBe(false);
    expect(canEditMeeting("MEMBER", "OPEN")).toBe(false);
  });
});

describe("canDeleteMeeting()", () => {
  it("lets a PM delete a report they created regardless of status", () => {
    expect(canDeleteMeeting("PM", "pm-1", "pm-1")).toBe(true);
  });

  it("does not let a PM delete another user's report", () => {
    expect(canDeleteMeeting("PM", "pm-1", "pm-2")).toBe(false);
  });

  it("lets managers delete any report and never lets a Member delete", () => {
    for (const role of ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER"] as const) {
      expect(canDeleteMeeting(role, "manager", "pm-1")).toBe(true);
    }
    expect(canDeleteMeeting("MEMBER", "member", "member")).toBe(false);
  });
});

describe("eeTotals()", () => {
  it("sums plan and actual and computes variance", () => {
    const rows = [
      { project: "A", plan: 100, actual: 90, note: "" },
      { project: "B", plan: 50, actual: 60, note: "" },
    ];
    expect(eeTotals(rows)).toEqual({ plan: 150, actual: 150, variance: 0 });
  });
  it("handles empty rows", () => {
    expect(eeTotals([])).toEqual({ plan: 0, actual: 0, variance: 0 });
  });
  it("variance is actual minus plan", () => {
    expect(eeTotals([{ project: "A", plan: 100, actual: 80, note: "" }]).variance).toBe(-20);
  });
});

describe("buildClonePayload()", () => {
  const source = {
    week: "Tuần 24", weekRange: "08/06 – 12/06/2026", section: "D8.1",
    execSummary: "x", teamSummary: "t", opportunities: "o", otherInfo: "i", additionalNote: "n",
    eeRows: [{ project: "A", plan: 100, actual: 90, note: "" }],
    raRows: [{ name: "Dev", project: "A", from: "01/07", effort: "2 MM", status: "open" }],
    risks: [],
    milestones: [],
    nextWeekPlans: [],
    groups: [],
  };
  it("copies content fields but resets identity to a new draft", () => {
    const out = buildClonePayload(source, { week: "Tuần 25", weekRange: "15/06 – 19/06/2026" });
    expect(out.status).toBe("DRAFT");
    expect(out.week).toBe("Tuần 25");
    expect(out.weekRange).toBe("15/06 – 19/06/2026");
    expect(out.section).toBe("D8.1");
    expect(out.execSummary).toBe("x");
    expect(out.eeRows).toEqual(source.eeRows);
    expect(out.raRows).toEqual(source.raRows);
    expect(out.risks).toEqual(source.risks);
  });
  it("does not carry over an id", () => {
    const out = buildClonePayload(source, { week: "Tuần 25", weekRange: "..." });
    expect((out as Record<string, unknown>).id).toBeUndefined();
  });
  it("carries over projectStatus, defaulting to the first option when missing", () => {
    expect(buildClonePayload({ ...source, projectStatus: "Late" }, { week: "Tuần 25", weekRange: "..." }).projectStatus).toBe("Late");
    expect(buildClonePayload(source, { week: "Tuần 25", weekRange: "..." }).projectStatus).toBe(PROJECT_STATUSES[0]);
  });
  it("carries over divisionEE, defaulting to null when missing", () => {
    expect(buildClonePayload({ ...source, divisionEE: 85 }, { week: "Tuần 25", weekRange: "..." }).divisionEE).toBe(85);
    expect(buildClonePayload(source, { week: "Tuần 25", weekRange: "..." }).divisionEE).toBeNull();
  });
});

describe("PROJECT_STATUSES", () => {
  it("exposes the fixed On Schedule / Late / Issues list", () => {
    expect(PROJECT_STATUSES).toEqual(["On Schedule", "Late", "Issues"]);
  });
});

describe("getEeNorm()", () => {
  const realNorm = process.env.NORM;
  afterEach(() => {
    if (realNorm === undefined) delete process.env.NORM;
    else process.env.NORM = realNorm;
  });

  it("reads a numeric NORM env var", () => {
    process.env.NORM = "85";
    expect(getEeNorm()).toBe(85);
  });
  it("falls back to the default when NORM is unset", () => {
    delete process.env.NORM;
    expect(getEeNorm()).toBe(EE_NORM_DEFAULT);
  });
  it("falls back to the default when NORM is not a number", () => {
    process.env.NORM = "not-a-number";
    expect(getEeNorm()).toBe(EE_NORM_DEFAULT);
  });
});

describe("risk constants", () => {
  it("exposes the fixed Issue/Risk type list", () => {
    expect(RISK_TYPES).toEqual(["Issue", "Risk"]);
  });
  it("exposes a fixed, non-empty list of risk statuses starting with Open", () => {
    expect(RISK_STATUSES[0]).toBe("Open");
    expect(RISK_STATUSES).toContain("Closed");
  });
});
