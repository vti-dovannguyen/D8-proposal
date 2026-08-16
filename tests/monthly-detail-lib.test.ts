import { describe, it, expect } from "vitest";
import {
  ee, eeDenominator, eeStatus, monthlyTotals, parseMonthlyPaste, EFFORT_FIELDS, type EffortFields,
} from "@/lib/monthly-detail";

const base: EffortFields = {
  billableProject: 0, billableDevelop: 0, warrantyEffort: 0,
  calendarMember: 0, calendarIntern: 0, calendarCollaborator: 0,
  otMemberEffort: 0, otInternEffort: 0, otCollaboratorEffort: 0, absent: 0,
};
const row = (o: Partial<EffortFields>): EffortFields => ({ ...base, ...o });

describe("eeDenominator", () => {
  it("counts intern calendar effort at half (1/2 of an official member)", () => {
    // 10 + (2 * 0.5) + 1 - 3 = 9
    expect(eeDenominator(row({ calendarMember: 10, calendarIntern: 2, otMemberEffort: 1, absent: 3 }))).toBe(9);
  });
});

describe("ee", () => {
  it("is billableProject / denominator * 100", () => {
    expect(ee(row({ billableProject: 9, calendarMember: 10 }))).toBe(90);
  });
  it("returns 0 when denominator is zero", () => {
    expect(ee(row({ billableProject: 5 }))).toBe(0);
  });
  it("returns 0 when denominator is negative", () => {
    expect(ee(row({ billableProject: 5, absent: 4 }))).toBe(0);
  });
});

describe("eeStatus", () => {
  it("green at >= 90, amber in [80,90), red below 80", () => {
    expect(eeStatus(90)).toBe("green");
    expect(eeStatus(89.99)).toBe("amber");
    expect(eeStatus(80)).toBe("amber");
    expect(eeStatus(79.99)).toBe("red");
  });
});

describe("monthlyTotals", () => {
  it("sums each effort field", () => {
    const t = monthlyTotals([row({ calendarMember: 28.43 }), row({ calendarMember: 26.69 })]);
    expect(t.calendarMember).toBeCloseTo(55.12, 5);
    for (const f of EFFORT_FIELDS) if (f !== "calendarMember") expect(t[f]).toBe(0);
  });
  it("returns all-zero totals for an empty list", () => {
    expect(monthlyTotals([]).calendarMember).toBe(0);
  });
});

describe("parseMonthlyPaste", () => {
  const line = (cells: (string | number)[]) => cells.join("\t");
  // month, bp, bd, we, cm, ci, cc, otm, oti, otc, absent, ee(ignored), eeToMonth
  const valid = line(["2026-01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 999, 42]);

  it("parses a valid tab-separated row, ignoring the ee column", () => {
    const { rows, errors } = parseMonthlyPaste(valid);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe("2026-01");
    expect(rows[0].billableProject).toBe(5);
    expect(rows[0].calendarMember).toBe(10);
    expect(rows[0].eeToMonth).toBe(42); // stored
  });
  it("skips a header line and blank lines", () => {
    const text = ["Months\tBillable Project", "", valid, "   "].join("\n");
    const { rows, errors } = parseMonthlyPaste(text);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
  it("reports a malformed month and drops that row", () => {
    const { rows, errors } = parseMonthlyPaste(line(["2026/01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/2026\/01/);
  });
  it("reports a non-numeric cell and drops that row", () => {
    const { rows, errors } = parseMonthlyPaste(line(["2026-01", "abc", 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
  it("treats empty cells as 0", () => {
    const { rows } = parseMonthlyPaste(line(["2026-01", "", "", "", 10, "", "", "", "", "", "", "", ""]));
    expect(rows[0].billableProject).toBe(0);
    expect(rows[0].eeToMonth).toBe(0);
  });
});
