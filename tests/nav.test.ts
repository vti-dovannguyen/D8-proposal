import { describe, it, expect } from "vitest";
import { navForRole, NAV_ITEMS } from "@/lib/nav";

describe("navForRole()", () => {
  it("includes Home for everyone", () => {
    expect(navForRole("MEMBER").some((i) => i.href === "/")).toBe(true);
  });
  it("hides Dashboard and Admin from Member", () => {
    const hrefs = navForRole("MEMBER").map((i) => i.href);
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/admin");
  });
  it("shows Admin only to Admin role", () => {
    expect(navForRole("ADMIN").map((i) => i.href)).toContain("/admin");
    expect(navForRole("PM").map((i) => i.href)).not.toContain("/admin");
  });
  it("shows Dashboard to managers and PM", () => {
    expect(navForRole("PM").map((i) => i.href)).toContain("/dashboard");
    expect(navForRole("SECTION_MANAGER").map((i) => i.href)).toContain("/dashboard");
  });
  it("shows Master Data to managers, hides from PM and Member", () => {
    const mgr = navForRole("SECTION_MANAGER").map((i) => i.href);
    expect(mgr).toContain("/master-data/categories");
    expect(mgr).toContain("/master-data/members");
    const pm = navForRole("PM").map((i) => i.href);
    expect(pm).not.toContain("/master-data/categories");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/master-data/skills");
  });
  it("shows Skill Matrix to managers, hides from PM and Member", () => {
    expect(navForRole("SECTION_MANAGER").map((i) => i.href)).toContain("/master-data/skill-matrix");
    expect(navForRole("PM").map((i) => i.href)).not.toContain("/master-data/skill-matrix");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/master-data/skill-matrix");
  });
  it("shows Projects to managers and PM (a PM can edit projects they're PIC PM on), hides from Member", () => {
    expect(navForRole("SECTION_MANAGER").map((i) => i.href)).toContain("/projects");
    expect(navForRole("PM").map((i) => i.href)).toContain("/projects");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/projects");
  });
  it("shows List KPI A to managers and PM, hides from Member", () => {
    expect(navForRole("SECTION_MANAGER").map((i) => i.href)).toContain("/kpi-a");
    expect(navForRole("PM").map((i) => i.href)).toContain("/kpi-a");
    expect(navForRole("MEMBER").map((i) => i.href)).not.toContain("/kpi-a");
  });
  it("every nav item has label, href and icon", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.icon).toBeTruthy();
    }
  });
});
