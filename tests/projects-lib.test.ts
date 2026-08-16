import { describe, it, expect } from "vitest";
import { normalizeAllocations, normalizeAllocation, effectiveHoursPerDay, projectVisibilityWhere, isProjectPic, type AllocationInput } from "@/lib/projects";

const row = (o: Partial<AllocationInput>): AllocationInput => ({ userId: "", role: "", skillId: "", hoursPerDay: 8, ...o });

describe("normalizeAllocations", () => {
  it("drops fully-empty rows", () => {
    expect(normalizeAllocations([row({})])).toEqual([]);
  });
  it("throws when a non-empty row lacks a role", () => {
    expect(() => normalizeAllocations([row({ userId: "u1" })])).toThrow(/vai trò/i);
  });
  it("rejects hours outside 0..24 or NaN", () => {
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: 25 })])).toThrow(/giờ/i);
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: -1 })])).toThrow(/giờ/i);
    expect(() => normalizeAllocations([row({ role: "Dev", hoursPerDay: NaN })])).toThrow(/giờ/i);
  });
  it("maps empty userId/skillId to null and keeps valid rows", () => {
    const out = normalizeAllocations([
      row({ role: "Developer", userId: "u1", skillId: "s1", hoursPerDay: 4.5 }),
      row({ role: "Tester", userId: "", skillId: "", hoursPerDay: 8 }),
    ]);
    expect(out).toEqual([
      { userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 4.5, gitAccount: null, backlogAccount: null, twoFA: false, active: true },
      { userId: null, role: "Tester", skillId: null, hoursPerDay: 8, gitAccount: null, backlogAccount: null, twoFA: false, active: true },
    ]);
  });
});

describe("effectiveHoursPerDay", () => {
  it("keeps full hours for an official member", () => {
    expect(effectiveHoursPerDay(8, "OFFICIAL")).toBe(8);
  });
  it("halves the hours for an intern", () => {
    expect(effectiveHoursPerDay(8, "INTERN")).toBe(4);
    expect(effectiveHoursPerDay(4.5, "INTERN")).toBe(2.25);
  });
});

describe("normalizeAllocation", () => {
  it("returns null for a fully-empty row", () => {
    expect(normalizeAllocation({ userId: "", role: "", skillId: "", hoursPerDay: 8 })).toBeNull();
  });
  it("throws when role is missing on a non-empty row", () => {
    expect(() => normalizeAllocation({ userId: "u1", role: "", skillId: "", hoursPerDay: 8 })).toThrow(/vai trò/i);
  });
  it("rejects bad hours", () => {
    expect(() => normalizeAllocation({ userId: "", role: "Dev", skillId: "", hoursPerDay: 25 })).toThrow(/giờ/i);
  });
  it("maps empty ids to null", () => {
    expect(normalizeAllocation({ userId: "", role: "Dev", skillId: "", hoursPerDay: 4.5 }))
      .toEqual({ userId: null, role: "Dev", skillId: null, hoursPerDay: 4.5, gitAccount: null, backlogAccount: null, twoFA: false, active: true });
  });
});

describe("projectVisibilityWhere", () => {
  it("restricts a PM to projects where they are one of the PIC PMs", () => {
    expect(projectVisibilityWhere("PM", "u1")).toEqual({ active: true, picPms: { some: { id: "u1" } } });
  });
  it("gives managers and MEMBER unrestricted visibility", () => {
    expect(projectVisibilityWhere("ADMIN", "u1")).toEqual({ active: true });
    expect(projectVisibilityWhere("DIVISION_LEADER", "u1")).toEqual({ active: true });
    expect(projectVisibilityWhere("SECTION_MANAGER", "u1")).toEqual({ active: true });
    expect(projectVisibilityWhere("MEMBER", "u1")).toEqual({ active: true });
  });
});

describe("isProjectPic", () => {
  it("returns true when userId is among the PIC PMs", () => {
    expect(isProjectPic([{ id: "u1" }, { id: "u2" }], "u2")).toBe(true);
  });
  it("returns false when userId is not a PIC PM, including an empty list", () => {
    expect(isProjectPic([{ id: "u1" }], "u2")).toBe(false);
    expect(isProjectPic([], "u2")).toBe(false);
  });
});
