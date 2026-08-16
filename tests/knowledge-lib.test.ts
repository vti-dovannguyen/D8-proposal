import { describe, it, expect } from "vitest";
import { parseTags, normalizeSearchQuery, inlineContentType } from "@/lib/knowledge";

describe("parseTags()", () => {
  it("splits, trims, drops empties, dedupes, preserves order", () => {
    expect(parseTags("alpha, beta ,, alpha,  gamma")).toEqual(["alpha", "beta", "gamma"]);
  });
  it("returns [] for blank input", () => {
    expect(parseTags("   ")).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("normalizeSearchQuery()", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  hop   thuong   ky ")).toBe("hop thuong ky");
  });
  it("returns empty string for blank", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("inlineContentType()", () => {
  it("maps previewable types", () => {
    expect(inlineContentType("pdf")).toBe("application/pdf");
    expect(inlineContentType("PNG")).toBe("image/png");
    expect(inlineContentType("jpg")).toBe("image/jpeg");
  });
  it("falls back to octet-stream for non-previewable types", () => {
    expect(inlineContentType("docx")).toBe("application/octet-stream");
    expect(inlineContentType("")).toBe("application/octet-stream");
  });
});
