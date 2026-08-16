import { describe, it, expect } from "vitest";
import { generateWeekOptions, MEETING_WEEK_OPTIONS } from "@/lib/meeting-week-options";

describe("generateWeekOptions()", () => {
  it("generates Saturday-to-Friday weeks with 7-day spacing and correct labels", () => {
    const opts = generateWeekOptions(29, "2026-07-17", 53);
    expect(opts[0]).toEqual({
      week: "Tuần 29",
      label: "Tuần 29 (11/07 – 17/07)",
      weekStart: "2026-07-11T00:00",
      weekEnd: "2026-07-17T23:59",
    });
    expect(opts[1]).toEqual({
      week: "Tuần 30",
      label: "Tuần 30 (18/07 – 24/07)",
      weekStart: "2026-07-18T00:00",
      weekEnd: "2026-07-24T23:59",
    });
  });

  it("generates exactly startWeek..endWeek inclusive, ending at week 53", () => {
    const opts = generateWeekOptions(29, "2026-07-17", 53);
    const last = opts[opts.length - 1];
    expect(last).toEqual({
      week: "Tuần 53",
      label: "Tuần 53 (26/12 – 01/01)",
      weekStart: "2026-12-26T00:00",
      weekEnd: "2027-01-01T23:59",
    });
    expect(opts.length).toBe(25);
  });

  it("never lets adjacent weeks share a calendar date at their boundary", () => {
    const opts = generateWeekOptions(29, "2026-07-17", 53);
    for (let i = 0; i < opts.length - 1; i++) {
      const endDate = opts[i].weekEnd.slice(0, 10);
      const nextStartDate = opts[i + 1].weekStart.slice(0, 10);
      expect(endDate).not.toBe(nextStartDate);
    }
  });

  it("produces weekStart/weekEnd values matching the datetime-local format required by the form", () => {
    const opts = generateWeekOptions(29, "2026-07-17", 53);
    const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    for (const o of opts) {
      expect(o.weekStart).toMatch(format);
      expect(o.weekEnd).toMatch(format);
    }
  });

  it("MEETING_WEEK_OPTIONS matches generateWeekOptions(29, \"2026-07-17\", 53)", () => {
    expect(MEETING_WEEK_OPTIONS).toEqual(generateWeekOptions(29, "2026-07-17", 53));
  });
});
