import { describe, it, expect } from "vitest";
import {
  validatePoints, rankAwards, splitPodium, formatMonth,
  POINT_AWARD_TYPE_LABELS,
} from "@/lib/point-award";

describe("validatePoints", () => {
  it("accepts integers within 0..100", () => {
    expect(validatePoints(0)).toBe(0);
    expect(validatePoints(100)).toBe(100);
    expect(validatePoints(42)).toBe(42);
  });
  it("rejects out-of-range, non-integer, or NaN", () => {
    expect(() => validatePoints(-1)).toThrow(/point/i);
    expect(() => validatePoints(101)).toThrow(/point/i);
    expect(() => validatePoints(3.5)).toThrow(/point/i);
    expect(() => validatePoints(NaN)).toThrow(/point/i);
  });
});

describe("rankAwards", () => {
  it("sorts by points desc, breaking ties by earlier createdAt", () => {
    const rows = [
      { id: "a", points: 50, createdAt: "2026-06-02" },
      { id: "b", points: 90, createdAt: "2026-06-03" },
      { id: "c", points: 90, createdAt: "2026-06-01" },
    ];
    expect(rankAwards(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("does not mutate the input array", () => {
    const rows = [{ id: "a", points: 1, createdAt: "2026-06-01" }];
    rankAwards(rows);
    expect(rows[0].id).toBe("a");
  });
});

describe("splitPodium", () => {
  it("splits the first three from the rest", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(splitPodium(rows)).toEqual({ podium: [1, 2, 3], rest: [4, 5] });
  });
  it("handles fewer than three", () => {
    expect(splitPodium([1])).toEqual({ podium: [1], rest: [] });
    expect(splitPodium([])).toEqual({ podium: [], rest: [] });
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM as 'Tháng M/YYYY'", () => {
    expect(formatMonth("2026-06")).toBe("Tháng 6/2026");
    expect(formatMonth("2026-12")).toBe("Tháng 12/2026");
  });
});

describe("POINT_AWARD_TYPE_LABELS", () => {
  it("maps enum values to Vietnamese labels", () => {
    expect(POINT_AWARD_TYPE_LABELS.PERSON).toBe("Cá nhân");
    expect(POINT_AWARD_TYPE_LABELS.PROJECT).toBe("Dự án");
  });
});
