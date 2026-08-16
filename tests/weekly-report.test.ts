import { describe, it, expect } from "vitest";
import {
  parseWeekRange, isWithinWeek, parseDeadlineEnv, weeklyDeadline, isPastDeadline, missingReportProjectNames,
} from "@/lib/weekly-report";

describe("parseWeekRange()", () => {
  it("parses 'DD/MM – DD/MM/YYYY' (en-dash), inheriting the year for the start", () => {
    const r = parseWeekRange("08/06 – 12/06/2026")!;
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(5); // June (0-based)
    expect(r.start.getDate()).toBe(8);
    expect(r.end.getDate()).toBe(12);
  });
  it("parses a plain hyphen separator too", () => {
    expect(parseWeekRange("01/06 - 05/06/2026")).not.toBeNull();
  });
  it("returns null for unparseable input", () => {
    expect(parseWeekRange("không xác định")).toBeNull();
    expect(parseWeekRange("")).toBeNull();
  });
});

describe("isWithinWeek()", () => {
  const range = parseWeekRange("08/06 – 12/06/2026")!;
  it("is true for a day inside the range (inclusive ends)", () => {
    expect(isWithinWeek(range, new Date(2026, 5, 8, 9, 0))).toBe(true);
    expect(isWithinWeek(range, new Date(2026, 5, 12, 23, 0))).toBe(true);
    expect(isWithinWeek(range, new Date(2026, 5, 10))).toBe(true);
  });
  it("is false outside the range", () => {
    expect(isWithinWeek(range, new Date(2026, 5, 7))).toBe(false);
    expect(isWithinWeek(range, new Date(2026, 5, 13))).toBe(false);
  });
});

describe("parseDeadlineEnv()", () => {
  it("defaults to Friday 10:00 when missing or invalid", () => {
    expect(parseDeadlineEnv(undefined)).toEqual({ weekday: 5, hour: 10, minute: 0 });
    expect(parseDeadlineEnv("garbage")).toEqual({ weekday: 5, hour: 10, minute: 0 });
  });
  it("parses 'MON 08:30'", () => {
    expect(parseDeadlineEnv("MON 08:30")).toEqual({ weekday: 1, hour: 8, minute: 30 });
  });
});

describe("weeklyDeadline()", () => {
  it("returns the configured weekday/time within today's (Mon-start) week", () => {
    // Wed 2026-06-10 → Friday of that week is 2026-06-12 10:00
    const d = weeklyDeadline(new Date(2026, 5, 10, 15, 0), { weekday: 5, hour: 10, minute: 0 });
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(0);
  });
  it("handles Sunday as the last day of the week", () => {
    // Sun 2026-06-14 still belongs to the week Mon 06-08 .. Sun 06-14; Friday is 06-12
    const d = weeklyDeadline(new Date(2026, 5, 14, 12, 0), { weekday: 5, hour: 10, minute: 0 });
    expect(d.getDate()).toBe(12);
  });
});

describe("isPastDeadline()", () => {
  it("compares timestamps", () => {
    const deadline = new Date(2026, 5, 12, 10, 0);
    expect(isPastDeadline(new Date(2026, 5, 12, 10, 1), deadline)).toBe(true);
    expect(isPastDeadline(new Date(2026, 5, 12, 9, 59), deadline)).toBe(false);
  });
});

describe("missingReportProjectNames()", () => {
  it("returns active names not present in the reported set (case-insensitive, trimmed)", () => {
    const reported = new Set(["sbi trading platform"]);
    expect(missingReportProjectNames(["SBI Trading Platform", "  AEON Loyalty App "], reported))
      .toEqual(["  AEON Loyalty App "]);
  });
});
