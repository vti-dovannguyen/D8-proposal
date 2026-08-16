/**
 * Prisma `where` clause selecting active (ON) notifications. OFF notifications
 * are hidden from the home widget, the header bell, and the member list view.
 */
export function activeAnnouncementWhere(): { active: true } {
  return { active: true };
}

/**
 * Strip HTML tags from rich-text body to a plain-text preview. Pure + safe for
 * both server and client (regex only — no DOM, no sanitize-html dependency).
 */
export function htmlToText(html: string): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
