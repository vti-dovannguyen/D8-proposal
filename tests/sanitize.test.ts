import { describe, it, expect } from "vitest";
import { sanitizeWikiHtml, sanitizeMeetingRichTextHtml } from "@/lib/sanitize";

describe("sanitizeWikiHtml()", () => {
  it("keeps allowed formatting tags", () => {
    const out = sanitizeWikiHtml("<p>Xin <strong>chào</strong></p><ul><li>a</li></ul>");
    expect(out).toContain("<strong>chào</strong>");
    expect(out).toContain("<li>a</li>");
  });
  it("strips <script> and event handlers", () => {
    const out = sanitizeWikiHtml('<p>ok</p><script>alert(1)</script><p onclick="x()">y</p>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
  });
  it("drops javascript: links but keeps https links", () => {
    const bad = sanitizeWikiHtml('<a href="javascript:alert(1)">x</a>');
    expect(bad).not.toContain("javascript:");
    const good = sanitizeWikiHtml('<a href="https://vti.com.vn">vti</a>');
    expect(good).toContain('href="https://vti.com.vn"');
  });

  it("keeps TinyMCE accordion markup (details/summary/div.mce-accordion-body)", () => {
    const out = sanitizeWikiHtml(
      '<details class="mce-accordion" open="open"><summary class="mce-accordion-summary">Title</summary><div class="mce-accordion-body"><p>Body</p></div></details>',
    );
    expect(out).toContain('<details class="mce-accordion"');
    expect(out).toContain('<summary class="mce-accordion-summary">Title</summary>');
    expect(out).toContain('<div class="mce-accordion-body"><p>Body</p></div>');
  });

  it("keeps fixed-width table col/colgroup styles", () => {
    const out = sanitizeWikiHtml(
      '<table style="width: 400px"><colgroup><col style="width: 30%"><col style="width: 70%"></colgroup><tbody><tr><td style="width: 30%">a</td><td>b</td></tr></tbody></table>',
    );
    expect(out).toContain('<table style="width:400px">');
    expect(out).toContain('<col style="width:30%">');
    expect(out).toContain('<td style="width:30%">a</td>');
  });

  it("strips unsafe style properties/classes not in the allowlist", () => {
    const out = sanitizeWikiHtml('<table style="width: 100px; background: url(evil.png)"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).not.toContain("background");
    expect(out).not.toContain("url(");
    const out2 = sanitizeWikiHtml('<details class="mce-accordion evil-class"><summary>t</summary></details>');
    expect(out2).not.toContain("evil-class");
  });
});

describe("sanitizeMeetingRichTextHtml()", () => {
  it("forces a wide table to fit and to wrap, so the section never scrolls sideways", () => {
    const out = sanitizeMeetingRichTextHtml(
      '<table style="min-width: 1400px; width: 1400px"><colgroup><col style="width: 200px"><col style="width: 600px"></colgroup>' +
      "<tbody><tr><td>a</td><td>b</td></tr></tbody></table>",
    );
    expect(out).toContain("width:100%");
    expect(out).toContain("table-layout:fixed");
    expect(out).toContain("word-break:break-word");
    expect(out).toContain("width:25%");
    expect(out).toContain("width:75%");
    expect(out).not.toContain("px");
  });

  it("keeps the fitting styles through a second sanitize pass (save then render)", () => {
    const saved = sanitizeMeetingRichTextHtml('<table style="width: 1200px"><tbody><tr><td>a</td></tr></tbody></table>');
    const rendered = sanitizeMeetingRichTextHtml(saved);
    expect(rendered).toBe(saved);
    expect(rendered).toContain("table-layout:fixed");
    expect(rendered).toContain("word-break:break-word");
  });

  it("still strips unsafe CSS while normalizing", () => {
    const out = sanitizeMeetingRichTextHtml(
      '<table style="width: 900px; background: url(evil.png); position: fixed"><tbody><tr><td>a</td></tr></tbody></table>',
    );
    expect(out).not.toContain("background");
    expect(out).not.toContain("url(");
    expect(out).not.toContain("position");
  });

  it("still strips disallowed tags while normalizing", () => {
    const out = sanitizeMeetingRichTextHtml('<table><tbody><tr><td><script>alert(1)</script>a</td></tr></tbody></table>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("leaves table-free content alone apart from normal sanitizing", () => {
    expect(sanitizeMeetingRichTextHtml("<p>Tuần này <strong>ổn</strong></p>")).toBe("<p>Tuần này <strong>ổn</strong></p>");
  });
});
