import "server-only";
import { db } from "@/lib/db";
import {
  PROJECT_CATEGORIES,
  DOCUMENT_CATEGORIES,
  TOPIC_CATEGORIES,
  MEETING_CATEGORIES,
  MEETING_SECTIONS,
  WIKI_CATEGORIES,
  PROJECT_ROLES,
} from "@/lib/master-data";

export const CATEGORY_TYPES = ["PROJECT", "DOCUMENT", "TOPIC", "MEETING", "MEETING_SECTION", "WIKI", "PROJECT_ROLE"] as const;
export type MasterCategoryType = (typeof CATEGORY_TYPES)[number];

export const CATEGORY_LABELS: Record<MasterCategoryType, string> = {
  PROJECT: "Danh mục dự án",
  DOCUMENT: "Danh mục tài liệu",
  TOPIC: "Danh mục topic",
  MEETING: "Danh mục họp tuần",
  MEETING_SECTION: "Section",
  WIKI: "Danh mục wiki",
  PROJECT_ROLE: "Vai trò dự án",
};

export const CATEGORY_FALLBACK: Record<MasterCategoryType, readonly string[]> = {
  PROJECT: PROJECT_CATEGORIES,
  DOCUMENT: DOCUMENT_CATEGORIES,
  TOPIC: TOPIC_CATEGORIES,
  MEETING: MEETING_CATEGORIES,
  MEETING_SECTION: MEETING_SECTIONS,
  WIKI: WIKI_CATEGORIES,
  PROJECT_ROLE: PROJECT_ROLES,
};

export async function getCategoryValues(type: MasterCategoryType): Promise<string[]> {
  const rows = await db.masterCategory.findMany({
    where: { type, active: true },
    orderBy: [{ order: "asc" }, { value: "asc" }],
    select: { value: true },
  });
  if (rows.length === 0) return [...CATEGORY_FALLBACK[type]];
  return rows.map((r) => r.value);
}

export async function getCategoryMap(
  types: MasterCategoryType[],
): Promise<Record<MasterCategoryType, string[]>> {
  const entries = await Promise.all(types.map(async (t) => [t, await getCategoryValues(t)] as const));
  return Object.fromEntries(entries) as Record<MasterCategoryType, string[]>;
}
