import { describe, it, expect } from "vitest";
import {
  isPmConfigured,
  toDateOnly,
  parseRedmineTarget,
  parseBacklogTarget,
} from "../src/lib/pm-integrations";

describe("isPmConfigured", () => {
  it("requires a supported tool, url and token", () => {
    expect(isPmConfigured({ pmTool: "redmine", pmUrl: "https://x", accessKey: "k" })).toBe(true);
    expect(isPmConfigured({ pmTool: "backlog", pmUrl: "https://x", accessKey: "k" })).toBe(true);
    expect(isPmConfigured({ pmTool: "redmine", pmUrl: "https://x", accessKey: null })).toBe(false);
    expect(isPmConfigured({ pmTool: null, pmUrl: "https://x", accessKey: "k" })).toBe(false);
    expect(isPmConfigured({ pmTool: "jira", pmUrl: "https://x", accessKey: "k" })).toBe(false);
  });
});

describe("toDateOnly", () => {
  it("extracts the date part from datetime-local and ISO", () => {
    expect(toDateOnly("2026-06-16T09:00")).toBe("2026-06-16");
    expect(toDateOnly("2026-06-16T09:00:00.000Z")).toBe("2026-06-16");
    expect(toDateOnly("2026-06-16")).toBe("2026-06-16");
  });
  it("throws on invalid input", () => {
    expect(() => toDateOnly("not-a-date")).toThrow();
  });
});

describe("parseRedmineTarget", () => {
  it("uses code as the identifier (base host URL)", () => {
    expect(parseRedmineTarget("https://redmine2.vti.com.vn/", "myproj")).toEqual({
      base: "https://redmine2.vti.com.vn",
      identifier: "myproj",
    });
  });
  it("prefers code over the URL /projects/<id> path", () => {
    expect(parseRedmineTarget("https://redmine2.vti.com.vn/projects/foo", "myproj")).toEqual({
      base: "https://redmine2.vti.com.vn",
      identifier: "myproj",
    });
  });
  it("falls back to the URL path when code is empty", () => {
    expect(parseRedmineTarget("https://redmine2.vti.com.vn/projects/foo", null)).toEqual({
      base: "https://redmine2.vti.com.vn",
      identifier: "foo",
    });
  });
  it("throws when neither code nor path yields an identifier", () => {
    expect(() => parseRedmineTarget("https://redmine2.vti.com.vn/", null)).toThrow();
  });
  it("falls back to the URL path when code looks like a display name, not a key", () => {
    expect(parseRedmineTarget("https://redmine2.vti.com.vn/projects/foo", "My Project Name")).toEqual({
      base: "https://redmine2.vti.com.vn",
      identifier: "foo",
    });
  });
});

describe("parseBacklogTarget", () => {
  it("falls back to the URL project key when code is empty", () => {
    expect(parseBacklogTarget("https://vti-corp.backlog.com/projects/VAPMITSUBISHIGENAI", null)).toEqual({
      host: "vti-corp.backlog.com",
      projectKey: "VAPMITSUBISHIGENAI",
    });
  });
  it("prefers code (id or key) over the URL path", () => {
    expect(parseBacklogTarget("https://vti-corp.backlog.com/projects/VAPMITSUBISHIGENAI", "VKEY")).toEqual({
      host: "vti-corp.backlog.com",
      projectKey: "VKEY",
    });
  });
  it("falls back to the URL path when code is a display name with spaces (bad data)", () => {
    expect(
      parseBacklogTarget(
        "https://vti-corp.backlog.com/projects/OMR_STORE_MANAGEMENT_AI",
        "OMR_Store management Assistant AI",
      ),
    ).toEqual({
      host: "vti-corp.backlog.com",
      projectKey: "OMR_STORE_MANAGEMENT_AI",
    });
  });
});
