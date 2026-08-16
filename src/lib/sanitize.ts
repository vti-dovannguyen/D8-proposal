import "server-only";

import sanitizeHtml from "sanitize-html";

import { normalizeRichTextTables } from "@/lib/rich-text-tables";

/**
 * Sanitize Tiptap-produced HTML before persisting or rendering. Server-only:
 * sanitize-html pulls in htmlparser2, so never import this from a client
 * component (it would bloat/break the client bundle).
 */
// Restrict the `style` attribute to the handful of properties TinyMCE's
// table (fixed column widths via <col style="width">) and accordion plugins
// actually emit — never allow arbitrary CSS (e.g. `position`, `background`,
// url()-based properties) through user-authored rich text.
// `table-layout` and `word-break` are what `rich-text-tables.ts` writes to keep
// a table inside the layout; they must be allowed here or a second sanitize pass
// (every render calls one) would strip them back out.
const SAFE_STYLE_VALUES = {
  width: [/^\d+(\.\d+)?(px|%)$/],
  "min-width": [/^\d+(\.\d+)?(px|%)$/],
  "max-width": [/^\d+(\.\d+)?(px|%)$/],
  "text-align": [/^(left|right|center|justify)$/],
  "table-layout": [/^(auto|fixed)$/],
  "word-break": [/^(normal|break-word|break-all)$/],
  "overflow-wrap": [/^(normal|break-word|anywhere)$/],
};

export function sanitizeRichTextHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "hr",
      "table",
      "colgroup",
      "col",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      // TinyMCE's accordion plugin: <details class="mce-accordion">
      // <summary class="mce-accordion-summary">…</summary>
      // <div class="mce-accordion-body">…</div></details>
      "details",
      "summary",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      table: ["style"],
      colgroup: ["style"],
      col: ["style"],
      th: ["colspan", "rowspan", "style"],
      td: ["colspan", "rowspan", "style"],
      details: ["open", "class"],
      summary: ["class"],
      div: ["class"],
    },
    allowedClasses: {
      details: ["mce-accordion"],
      summary: ["mce-accordion-summary"],
      div: ["mce-accordion-body"],
    },
    allowedStyles: {
      table: SAFE_STYLE_VALUES,
      colgroup: SAFE_STYLE_VALUES,
      col: SAFE_STYLE_VALUES,
      th: SAFE_STYLE_VALUES,
      td: SAFE_STYLE_VALUES,
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

export const sanitizeWikiHtml = sanitizeRichTextHtml;

/**
 * Sanitize a Weekly Report rich-text field AND force its tables to fit the
 * layout (no horizontal scrolling — long cells wrap instead). Used on save and
 * on render, so tables stored before this existed also fit without a migration.
 */
export function sanitizeMeetingRichTextHtml(dirty: string): string {
  return normalizeRichTextTables(sanitizeRichTextHtml(dirty));
}
