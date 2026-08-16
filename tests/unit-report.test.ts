import { describe, it, expect } from "vitest";
import { rollingMonths, aggregateUnitReport, monthLabel, type ProjMonthRow } from "@/lib/unit-report";

describe("rollingMonths", () => {
  it("returns the month of `from` plus the next two", () => {
    // Month is 0-based in the Date constructor: 5 = June.
    expect(rollingMonths(new Date(2026, 5, 27))).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
  it("rolls across the year boundary", () => {
    expect(rollingMonths(new Date(2026, 10, 1))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

const months = ["2026-06", "2026-07", "2026-08"];
const row = (o: Partial<ProjMonthRow>): ProjMonthRow => ({
  project: "P", month: "2026-06", billableProject: 0,
  calendarMember: 0, calendarIntern: 0, otMemberEffort: 0, absent: 0, ...o,
});

describe("aggregateUnitReport", () => {
  it("sums PO (billableProject) per month across projects", () => {
    const rows = [
      row({ project: "A", month: "2026-06", billableProject: 7 }),
      row({ project: "B", month: "2026-06", billableProject: 9 }),
      row({ project: "A", month: "2026-07", billableProject: 8 }),
    ];
    const { po } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(po).toEqual([16, 8, 0]);
  });
  it("computes EE = sum(billable) / sum(denominator) * 100", () => {
    const rows = [
      row({ project: "A", month: "2026-06", billableProject: 9, calendarMember: 10 }),
      row({ project: "B", month: "2026-06", billableProject: 9, calendarMember: 10 }),
    ];
    const { ee } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(ee[0]).toBeCloseTo(90, 5); // 18 / 20 * 100
  });
  it("returns EE 0 when the month's denominator is <= 0", () => {
    const rows = [row({ project: "A", month: "2026-06", billableProject: 5, absent: 4 })];
    const { ee } = aggregateUnitReport(rows, months, ["A"]);
    expect(ee[0]).toBe(0);
  });
  it("lists every project in order, 0 where a month has no row", () => {
    const rows = [row({ project: "A", month: "2026-07", billableProject: 8 })];
    const { projectRows } = aggregateUnitReport(rows, months, ["A", "B"]);
    expect(projectRows).toEqual([
      { project: "A", values: [0, 8, 0] },
      { project: "B", values: [0, 0, 0] },
    ]);
  });
});

describe("monthLabel", () => {
  it("is 'Tháng M' within a single year", () => {
    expect(monthLabel("2026-06", months)).toBe("Tháng 6");
  });
  it("appends the year when the window spans two years", () => {
    const span = ["2026-12", "2027-01", "2027-02"];
    expect(monthLabel("2027-01", span)).toBe("Tháng 1/2027");
  });
});
