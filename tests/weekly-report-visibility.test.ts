import { describe, expect, it } from "vitest";
import { shouldHideWeeklyReportFields } from "@/lib/permissions";

describe("shouldHideWeeklyReportFields", () => {
  it.each([
    ["ADMIN", true],
    ["DIVISION_LEADER", true],
    ["SECTION_MANAGER", true],
    ["PM", false],
    ["MEMBER", false],
  ] as const)("returns %s for %s", (role, expected) => {
    expect(shouldHideWeeklyReportFields(role)).toBe(expected);
  });
});
