import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "@/lib/html-to-markdown";

describe("htmlToMarkdown()", () => {
  it("converts paragraphs, bold/italic, and headings", () => {
    const out = htmlToMarkdown("<h2>Title</h2><p>Xin <strong>chào</strong> <em>bạn</em></p>");
    expect(out).toContain("## Title");
    expect(out).toContain("Xin **chào** *bạn*");
  });

  it("converts unordered and ordered lists, including nesting", () => {
    const out = htmlToMarkdown("<ul><li>a</li><li>b<ol><li>b1</li></ol></li></ul>");
    expect(out).toContain("- a");
    expect(out).toContain("- b");
    expect(out).toContain("1. b1");
  });

  it("converts a table with a header row into a GFM table", () => {
    const out = htmlToMarkdown("<table><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>P1</td><td>OK</td></tr></tbody></table>");
    expect(out).toContain("| Name | Status |");
    expect(out).toContain("| --- | --- |");
    expect(out).toContain("| P1 | OK |");
  });

  it("converts links and preserves href", () => {
    const out = htmlToMarkdown('<p><a href="https://vti.com.vn">VTI</a></p>');
    expect(out).toContain("[VTI](https://vti.com.vn)");
  });

  it("renders an accordion (details/summary) as a raw HTML <details> block with markdown body", () => {
    const out = htmlToMarkdown(
      '<details class="mce-accordion"><summary class="mce-accordion-summary">Section A</summary><div class="mce-accordion-body"><p>Body text</p></div></details>',
    );
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>Section A</summary>");
    expect(out).toContain("Body text");
  });

  it("escapes markdown-significant characters in plain text", () => {
    const out = htmlToMarkdown("<p>1 * 2 = [result]</p>");
    expect(out).toContain("1 \\* 2 = \\[result\\]");
  });

  it("returns an empty string for blank input", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("   ")).toBe("");
  });
});
