/**
 * Force rich-text tables to fit the page instead of scrolling sideways.
 *
 * TinyMCE writes pixel widths whenever the author drags a column border or
 * pastes a table out of Excel/Word, which makes the table wider than the
 * Executive Summary card and forces a horizontal scrollbar. This rewrites those
 * widths so a table always fits:
 *
 * - every `<col>` width in a `<colgroup>` is rescaled to a percentage summing
 *   to 100%, preserving the author's relative column proportions;
 * - the `<table>` itself becomes `width:100%; table-layout:fixed`;
 * - `<th>`/`<td>` lose their own fixed widths and gain `word-break:break-word`,
 *   so long cell text wraps onto more lines rather than pushing the table wide.
 *
 * Pure string transform over already-sanitized (well-formed) HTML — every
 * property it emits is on `sanitize.ts`'s style allowlist, so the result
 * survives being sanitized again on the way out.
 */

const WIDTH_PROPS = ["width", "min-width", "max-width"];

/** Split a tag's attributes into its style declarations and everything else. */
function readTag(attrs: string): { decls: Map<string, string>; rest: string } {
  const decls = new Map<string, string>();
  const rest = attrs.replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, dq, sq) => {
    for (const part of (dq ?? sq ?? "").split(";")) {
      const at = part.indexOf(":");
      if (at < 0) continue;
      const prop = part.slice(0, at).trim().toLowerCase();
      const value = part.slice(at + 1).trim();
      if (prop && value) decls.set(prop, value);
    }
    return "";
  });
  return { decls, rest };
}

function writeTag(tag: string, rest: string, decls: Map<string, string>, selfClosing: boolean): string {
  const style = [...decls].map(([p, v]) => `${p}:${v}`).join(";");
  const attrs = rest.replace(/\s*\/\s*$/, "").trimEnd();
  return `<${tag}${attrs ? ` ${attrs.trim()}` : ""}${style ? ` style="${style}"` : ""}${selfClosing ? " /" : ""}>`;
}

/** Numeric part of a `120px` / `25%` width, or null when absent/unparseable. */
function widthWeight(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d+(?:\.\d+)?)(px|%)$/.exec(value.trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Trim trailing zeros so `33.33%` stays readable and `50.00%` becomes `50%`. */
function pct(n: number): string {
  return `${Number(n.toFixed(2))}%`;
}

const COL_RE = /<col\b([^>]*)>/gi;

/**
 * Rescale one colgroup's widths to percentages summing to 100%. Columns without
 * a width are left alone — with `table-layout:fixed` they share what's left.
 */
function normalizeColgroup(inner: string): string {
  const weights: number[] = [];
  inner.replace(COL_RE, (_m, attrs: string) => {
    const { decls } = readTag(attrs);
    weights.push(widthWeight(decls.get("width")) ?? 0);
    return "";
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return inner;

  let i = 0;
  return inner.replace(COL_RE, (_m, attrs: string) => {
    const { decls, rest } = readTag(attrs);
    const weight = weights[i++];
    for (const prop of WIDTH_PROPS) decls.delete(prop);
    if (weight > 0) decls.set("width", pct((weight / total) * 100));
    // Emit a bare open tag: sanitize-html does not treat `col` as self-closing,
    // so it writes `<col ...></col>` and self-closing here would leave a stray
    // `</col>` behind.
    return writeTag("col", rest, decls, false);
  });
}

export function normalizeRichTextTables(html: string): string {
  if (!html) return html ?? "";

  let out = html.replace(/(<colgroup\b[^>]*>)([\s\S]*?)(<\/colgroup>)/gi,
    (_m, open: string, inner: string, close: string) => open + normalizeColgroup(inner) + close);

  // A table must never exceed its container, and fixed layout is what makes the
  // column percentages authoritative (auto layout widens to fit content).
  out = out.replace(/<table\b([^>]*)>/gi, (_m, attrs: string) => {
    const { decls, rest } = readTag(attrs);
    // Drop the properties we own (including ones a previous pass wrote) before
    // re-adding them, so the declaration order — and the output — is stable.
    for (const prop of [...WIDTH_PROPS, "table-layout"]) decls.delete(prop);
    decls.set("width", "100%");
    decls.set("table-layout", "fixed");
    return writeTag("table", rest, decls, false);
  });

  // Cells keep their alignment but lose fixed widths; long words wrap instead of
  // stretching the column.
  out = out.replace(/<(th|td)\b([^>]*)>/gi, (_m, tag: string, attrs: string) => {
    const { decls, rest } = readTag(attrs);
    for (const prop of [...WIDTH_PROPS, "word-break"]) decls.delete(prop);
    decls.set("word-break", "break-word");
    return writeTag(tag.toLowerCase(), rest, decls, false);
  });

  return out;
}
