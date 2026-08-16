import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";

/**
 * Converts our sanitizer's fixed set of allowed rich-text tags (see
 * lib/sanitize.ts#sanitizeRichTextHtml) into Markdown. Not a general-purpose
 * HTML→Markdown converter — only handles the tags that allowlist can ever
 * produce (TinyMCE output that's already been through sanitizeRichTextHtml).
 */

const ESCAPE_RE = /([\\`*_[\]])/g;

function escapeInline(text: string): string {
  return text.replace(ESCAPE_RE, "\\$1");
}

function isElement(node: AnyNode): node is Element {
  return node.type === "tag";
}

function textOf(nodes: AnyNode[]): string {
  return nodes.map((n) => renderInline(n)).join("");
}

function renderInline(node: AnyNode): string {
  if (node.type === "text") return escapeInline(node.data.replace(/\s+/g, " "));
  if (!isElement(node)) return "";
  const inner = textOf(node.children as AnyNode[]);
  switch (node.name) {
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `*${inner}*`;
    case "s":
      return `~~${inner}~~`;
    case "u":
      return `<u>${inner}</u>`;
    case "code":
      return `\`${textOf(node.children as AnyNode[]).replace(/\s+/g, " ")}\``;
    case "a": {
      const href = node.attribs?.href ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "br":
      return "\n";
    default:
      return inner;
  }
}

/** Same as renderInline, but for table cells: newlines collapse to <br> and pipes are escaped. */
function renderCell(nodes: AnyNode[]): string {
  return textOf(nodes).replace(/\n+/g, "<br>").replace(/\|/g, "\\|").trim();
}

function renderTable(table: Element): string {
  const rows: string[][] = [];
  let headerRowCount = 0;

  function collectRows(node: AnyNode, inHead: boolean) {
    if (!isElement(node)) return;
    if (node.name === "tr") {
      const cells = (node.children as AnyNode[]).filter((c) => isElement(c) && (c.name === "td" || c.name === "th"));
      rows.push(cells.map((c) => renderCell((c as Element).children as AnyNode[])));
      if (inHead || cells.some((c) => isElement(c) && c.name === "th")) headerRowCount = Math.max(headerRowCount, rows.length);
      return;
    }
    for (const child of (node.children as AnyNode[]) ?? []) {
      collectRows(child, inHead || node.name === "thead");
    }
  }
  collectRows(table, false);
  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(colCount - r.length).fill("")];
  const header = headerRowCount > 0 ? pad(rows[0]) : Array(colCount).fill("").map((_, i) => `Col ${i + 1}`);
  const bodyRows = headerRowCount > 0 ? rows.slice(1) : rows;

  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...bodyRows.map((r) => `| ${pad(r).join(" | ")} |`),
  ];
  return `${lines.join("\n")}\n\n`;
}

function renderList(list: Element, ordered: boolean, depth: number): string {
  const indent = "  ".repeat(depth);
  let i = 0;
  return (
    (list.children as AnyNode[])
      .filter((c) => isElement(c) && c.name === "li")
      .map((li) => {
        i += 1;
        const marker = ordered ? `${i}.` : "-";
        const nested = (((li as Element).children as AnyNode[]) ?? []).filter(
          (c) => isElement(c) && (c.name === "ul" || c.name === "ol"),
        );
        const inlineChildren = (((li as Element).children as AnyNode[]) ?? []).filter(
          (c) => !(isElement(c) && (c.name === "ul" || c.name === "ol")),
        );
        const text = textOf(inlineChildren).trim();
        const nestedMd = nested.map((n) => renderList(n as Element, (n as Element).name === "ol", depth + 1)).join("");
        return `${indent}${marker} ${text}\n${nestedMd}`;
      })
      .join("") + (depth === 0 ? "\n" : "")
  );
}

function renderBlock(node: AnyNode): string {
  if (node.type === "text") {
    const text = node.data.trim();
    return text ? `${escapeInline(text)}\n\n` : "";
  }
  if (!isElement(node)) return "";
  switch (node.name) {
    case "p":
      return `${textOf(node.children as AnyNode[]).trim()}\n\n`;
    case "h1":
      return `# ${textOf(node.children as AnyNode[]).trim()}\n\n`;
    case "h2":
      return `## ${textOf(node.children as AnyNode[]).trim()}\n\n`;
    case "h3":
      return `### ${textOf(node.children as AnyNode[]).trim()}\n\n`;
    case "ul":
      return renderList(node, false, 0);
    case "ol":
      return renderList(node, true, 0);
    case "blockquote":
      return `${textOf(node.children as AnyNode[])
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    case "pre":
      return `\`\`\`\n${textOf(node.children as AnyNode[])}\n\`\`\`\n\n`;
    case "hr":
      return "---\n\n";
    case "table":
      return renderTable(node);
    case "details": {
      const summary = (node.children as AnyNode[]).find((c) => isElement(c) && c.name === "summary");
      const body = (node.children as AnyNode[]).filter((c) => !(isElement(c) && c.name === "summary"));
      const title = summary ? textOf((summary as Element).children as AnyNode[]).trim() : "";
      const bodyMd = body.map((c) => renderBlock(c)).join("");
      return `<details>\n<summary>${title}</summary>\n\n${bodyMd}</details>\n\n`;
    }
    case "div":
      return (node.children as AnyNode[]).map((c) => renderBlock(c)).join("");
    default:
      return textOf(node.children as AnyNode[]).trim() ? `${textOf(node.children as AnyNode[]).trim()}\n\n` : "";
  }
}

/** Converts already-sanitized rich-text HTML (see sanitizeRichTextHtml) into Markdown. */
export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return "";
  const doc = parseDocument(html);
  const md = (doc.children as AnyNode[]).map((node) => renderBlock(node)).join("");
  return md.replace(/\n{3,}/g, "\n\n").trim();
}
