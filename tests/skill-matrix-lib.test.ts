import { describe, it, expect } from "vitest";
import { levelMeta, levelDistribution, avgPerSkill } from "@/lib/skill-matrix";

describe("levelMeta", () => {
  it("labels levels 0..5", () => {
    expect(levelMeta(0).label).toBe("None");
    expect(levelMeta(1).label).toBe("Basic");
    expect(levelMeta(5).label).toBe("Can Train Others");
  });
  it("falls back to level-0 meta for out-of-range / NaN", () => {
    expect(levelMeta(9).label).toBe("None");
    expect(levelMeta(NaN).label).toBe("None");
  });
});

const rows = [{ id: "u1" }, { id: "u2" }];
const skills = [{ id: "s1", name: "AWS" }, { id: "s2", name: "React" }];
const levels = { u1: { s1: 3, s2: 5 }, u2: { s1: 3 } };

describe("levelDistribution", () => {
  it("counts assignments per level 1..5, excluding 0/missing", () => {
    const d = levelDistribution(rows, skills, levels);
    expect(d).toHaveLength(5);
    const at = (lvl: number) => d.find((x) => x.level === lvl)!.count;
    expect(at(3)).toBe(2);
    expect(at(5)).toBe(1);
    expect(at(1)).toBe(0);
  });
});

describe("avgPerSkill", () => {
  it("averages over all rows treating missing as 0, preserves order, rounds to 1 decimal", () => {
    const a = avgPerSkill(rows, skills, levels);
    expect(a.map((x) => x.skillId)).toEqual(["s1", "s2"]);
    expect(a[0].avg).toBe(3);
    expect(a[1].avg).toBe(2.5);
  });
  it("returns 0 avg when there are no rows", () => {
    expect(avgPerSkill([], skills, levels)[0].avg).toBe(0);
  });
});
