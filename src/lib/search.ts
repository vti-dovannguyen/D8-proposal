import { db } from "@/lib/db";
import { normalizeSearchQuery } from "@/lib/knowledge";
import type { SearchRow } from "@/types/knowledge";

/**
 * Ranked full-text search across documents (title + category) and wiki pages
 * (title + content), unioned and ordered by ts_rank. Uses on-the-fly
 * to_tsvector with the 'simple' config (no stemming — safe for Vietnamese) and
 * websearch_to_tsquery (tolerant of arbitrary user input). The ${q} bind is
 * parameterized by Prisma, so it is injection-safe.
 *
 * Known debt: no GIN index (would need a migration), so this scans; fine at
 * portal scale. Tag names are not yet part of the vector — use the tag-filter
 * facets on the list pages for tag-scoped browsing.
 */
export async function runFullTextSearch(query: string): Promise<SearchRow[]> {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  const rows = await db.$queryRaw<SearchRow[]>`
    SELECT id, type, title, category, rank FROM (
      SELECT d.id, 'document' AS type, d.title, d.category,
        ts_rank(to_tsvector('simple', d.title || ' ' || d.category), websearch_to_tsquery('simple', ${q})) AS rank
      FROM "Document" d
      WHERE to_tsvector('simple', d.title || ' ' || d.category) @@ websearch_to_tsquery('simple', ${q})
      UNION ALL
      SELECT w.id, 'wiki' AS type, w.title, w.category,
        ts_rank(to_tsvector('simple', w.title || ' ' || w.content), websearch_to_tsquery('simple', ${q})) AS rank
      FROM "WikiPage" w
      WHERE to_tsvector('simple', w.title || ' ' || w.content) @@ websearch_to_tsquery('simple', ${q})
    ) results
    ORDER BY rank DESC
    LIMIT 50;
  `;
  return rows;
}
