import { describe, it, expect } from "vitest";
import { normalizeRichTextTables } from "@/lib/rich-text-tables";

describe("normalizeRichTextTables()", () => {
  it("leaves content without a table untouched", () => {
    const html = "<p>Tuần này <strong>ổn</strong>.</p>";
    expect(normalizeRichTextTables(html)).toBe(html);
  });

  it("handles empty input", () => {
    expect(normalizeRichTextTables("")).toBe("");
  });

  it("replaces a fixed pixel table width with 100% and fixed layout", () => {
    const out = normalizeRichTextTables('<table style="width:1400px"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).toContain('style="width:100%;table-layout:fixed"');
    expect(out).not.toContain("1400px");
  });

  it("adds the fitting styles to a table that had no style at all", () => {
    const out = normalizeRichTextTables("<table><tbody><tr><td>a</td></tr></tbody></table>");
    expect(out).toContain('<table style="width:100%;table-layout:fixed">');
  });

  it("drops a table min-width, which is what forced the horizontal scrollbar", () => {
    const out = normalizeRichTextTables('<table style="min-width:980px;width:980px"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).not.toContain("min-width");
    expect(out).not.toContain("980px");
  });

  it("keeps other allowed table styles such as text-align", () => {
    const out = normalizeRichTextTables('<table style="text-align:center;width:800px"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).toContain("text-align:center");
    expect(out).toContain("width:100%");
  });

  it("preserves non-style table attributes", () => {
    const out = normalizeRichTextTables('<table border="1" style="width:900px"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).toContain('border="1"');
    expect(out).toContain("width:100%");
  });

  it("rescales pixel column widths to percentages keeping their proportions", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:100px" /><col style="width:300px" /></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    );
    expect(out).toContain('<col style="width:25%">');
    expect(out).toContain('<col style="width:75%">');
    expect(out).not.toContain("px");
  });

  it("rescales percentages that overflow the table back to a 100% total", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:80%" /><col style="width:80%" /></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    );
    expect(out.match(/width:50%/g)).toHaveLength(2);
  });

  it("keeps a valid 100% split unchanged", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:30%" /><col style="width:70%" /></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    );
    expect(out).toContain("width:30%");
    expect(out).toContain("width:70%");
  });

  it("rounds long fractions instead of emitting full float noise", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:100px" /><col style="width:100px" /><col style="width:100px" /></colgroup><tbody><tr><td>a</td></tr></tbody></table>',
    );
    expect(out.match(/width:33\.33%/g)).toHaveLength(3);
  });

  it("leaves widthless columns alone so fixed layout can share the rest", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col /><col /></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    );
    // No widths to rescale — the colgroup passes through verbatim.
    expect(out).toContain("<colgroup><col /><col /></colgroup>");
  });

  it("rewrites a col without leaving a stray closing tag (sanitize-html emits <col></col>)", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:100px"></col><col style="width:300px"></col></colgroup><tbody><tr><td>a</td></tr></tbody></table>',
    );
    expect(out).toContain('<colgroup><col style="width:25%"></col><col style="width:75%"></col></colgroup>');
    expect(out).not.toContain("/>");
  });

  it("normalizes each colgroup independently when a summary has several tables", () => {
    const out = normalizeRichTextTables(
      '<table><colgroup><col style="width:200px" /><col style="width:200px" /></colgroup><tbody><tr><td>a</td></tr></tbody></table>' +
      '<table><colgroup><col style="width:100px" /><col style="width:300px" /></colgroup><tbody><tr><td>b</td></tr></tbody></table>',
    );
    expect(out.match(/width:50%/g)).toHaveLength(2);
    expect(out).toContain("width:25%");
    expect(out).toContain("width:75%");
  });

  it("strips cell widths and makes cell text wrap", () => {
    const out = normalizeRichTextTables('<table><tbody><tr><td style="width:640px">a</td></tr></tbody></table>');
    expect(out).toContain("word-break:break-word");
    expect(out).not.toContain("640px");
  });

  it("makes header cells wrap too, keeping their alignment", () => {
    const out = normalizeRichTextTables('<table><thead><tr><th style="text-align:center;min-width:300px">H</th></tr></thead></table>');
    expect(out).toContain("text-align:center");
    expect(out).toContain("word-break:break-word");
    expect(out).not.toContain("min-width");
  });

  it("keeps colspan/rowspan on cells", () => {
    const out = normalizeRichTextTables('<table><tbody><tr><td colspan="2" rowspan="3" style="width:500px">a</td></tr></tbody></table>');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('rowspan="3"');
  });

  it("is idempotent — re-normalizing an already-fitted table changes nothing", () => {
    const once = normalizeRichTextTables(
      '<table style="width:1200px"><colgroup><col style="width:400px" /><col style="width:800px" /></colgroup><tbody><tr><td style="width:400px">a</td><td>b</td></tr></tbody></table>',
    );
    expect(normalizeRichTextTables(once)).toBe(once);
  });

  it("does not touch tags outside tables", () => {
    const out = normalizeRichTextTables('<details class="mce-accordion"><summary>S</summary><div class="mce-accordion-body"><p>x</p></div></details>');
    expect(out).toContain('<details class="mce-accordion">');
    expect(out).toContain('<div class="mce-accordion-body">');
  });
});
