import { describe, it, expect } from "vitest";
import { can, isManager } from "@/lib/permissions";

describe("can()", () => {
  it("lets a PM edit meetings", () => {
    expect(can("PM", "meeting:edit")).toBe(true);
  });
  it("blocks a Member from editing meetings", () => {
    expect(can("MEMBER", "meeting:edit")).toBe(false);
  });
  it("lets a Member create topics", () => {
    expect(can("MEMBER", "topic:create")).toBe(true);
  });
  it("only lets an Admin access admin", () => {
    expect(can("ADMIN", "admin:access")).toBe(true);
    expect(can("DIVISION_LEADER", "admin:access")).toBe(false);
  });
  it("hides dashboard from Member", () => {
    expect(can("MEMBER", "dashboard:view")).toBe(false);
    expect(can("SECTION_MANAGER", "dashboard:view")).toBe(true);
  });
  it("lets managers manage master data, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "master-data:manage")).toBe(true);
    expect(can("DIVISION_LEADER", "master-data:manage")).toBe(true);
    expect(can("ADMIN", "master-data:manage")).toBe(true);
    expect(can("PM", "master-data:manage")).toBe(false);
    expect(can("MEMBER", "master-data:manage")).toBe(false);
  });
  it("lets managers award points, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "point:award")).toBe(true);
    expect(can("PM", "point:award")).toBe(false);
    expect(can("MEMBER", "point:award")).toBe(false);
  });
  it("lets managers manage announcements, blocks PM and Member", () => {
    expect(can("SECTION_MANAGER", "announcement:manage")).toBe(true);
    expect(can("DIVISION_LEADER", "announcement:manage")).toBe(true);
    expect(can("ADMIN", "announcement:manage")).toBe(true);
    expect(can("PM", "announcement:manage")).toBe(false);
    expect(can("MEMBER", "announcement:manage")).toBe(false);
  });
});

describe("isManager()", () => {
  it("is true for manager-and-above roles", () => {
    expect(isManager("DIVISION_LEADER")).toBe(true);
    expect(isManager("SECTION_MANAGER")).toBe(true);
    expect(isManager("ADMIN")).toBe(true);
  });
  it("is false for PM and Member", () => {
    expect(isManager("PM")).toBe(false);
    expect(isManager("MEMBER")).toBe(false);
  });
});
