import { describe, it, expect } from "vitest";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";

describe("activeAnnouncementWhere()", () => {
  it("matches only active (ON) notifications", () => {
    expect(activeAnnouncementWhere()).toEqual({ active: true });
  });
});

describe("htmlToText()", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToText("<p>Hello   <strong>world</strong></p>")).toBe("Hello world");
  });
  it("decodes common entities", () => {
    expect(htmlToText("<p>A &amp; B &lt;ok&gt;</p>")).toBe("A & B <ok>");
  });
  it("handles empty/nullish input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined as unknown as string)).toBe("");
  });
});
