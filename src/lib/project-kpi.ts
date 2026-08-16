/**
 * Pure helpers for the project "KPI Loại A" screens.
 *
 * A KPI record marks one member as having earned a KPI of a given type in one
 * month on one project. Only loại "A" exists today; `KPI_TYPES` is the guard so
 * adding B/C later stays a one-line change.
 */

export const KPI_TYPE_A = "A";
export const KPI_TYPES = [KPI_TYPE_A] as const;
export type KpiType = (typeof KPI_TYPES)[number];

export const KPI_MONTH_RE = /^\d{4}-\d{2}$/;

export type KpiEntryInput = { userId: string; note?: string | null };
export type KpiInput = { month: string; kpiType?: string; entries: KpiEntryInput[] };
export type NormalizedKpiInput = {
  month: string;
  kpiType: KpiType;
  entries: { userId: string; note: string | null }[];
};

/**
 * Validate and clean an "Add KPI" submission: one month, one KPI type, and at
 * least one member. Duplicate members collapse to a single entry (the first one
 * that carries a note wins), blank ids are dropped, and blank notes become null.
 */
export function normalizeKpiInput(input: KpiInput): NormalizedKpiInput {
  const month = input.month?.trim() ?? "";
  if (!KPI_MONTH_RE.test(month)) throw new Error("Validation: tháng không hợp lệ (định dạng YYYY-MM)");

  const kpiType = (input.kpiType?.trim() || KPI_TYPE_A) as KpiType;
  if (!KPI_TYPES.includes(kpiType)) throw new Error(`Validation: loại KPI không hợp lệ (${kpiType})`);

  const byUser = new Map<string, string | null>();
  for (const raw of input.entries ?? []) {
    const userId = raw.userId?.trim();
    if (!userId) continue;
    const note = raw.note?.trim() || null;
    // Keep the first non-empty note for a member listed more than once.
    if (!byUser.has(userId) || (byUser.get(userId) == null && note != null)) byUser.set(userId, note);
  }
  const entries = [...byUser].map(([userId, note]) => ({ userId, note }));
  if (entries.length === 0) throw new Error("Validation: chọn ít nhất 1 member");

  return { month, kpiType, entries };
}

/** Distinct months present in a row set, newest first — powers the month filter. */
export function distinctMonths(rows: { month: string }[]): string[] {
  return [...new Set(rows.map((r) => r.month))].sort((a, b) => b.localeCompare(a));
}

export const KPI_EXPORT_HEADERS = ["Tháng", "Dự án", "Member", "Loại KPI", "Ghi chú"] as const;

type ExportableKpi = { month: string; projectName: string; userName: string; note: string | null };
/** Header row + one array per KPI — the sheet body for the Excel export (AOA form). */
export function buildKpiExportAoa(rows: ExportableKpi[]): (string | number)[][] {
  return [
    [...KPI_EXPORT_HEADERS],
    ...rows.map((r) => [r.month, r.projectName, r.userName, KPI_TYPE_A, r.note ?? ""]),
  ];
}

/**
 * Download file name for the export: scoped to the filtered month when one is
 * set. ASCII only so it needs no `filename*` encoding in Content-Disposition.
 */
export function kpiExportFileName(month?: string): string {
  return `KPI-loai-${KPI_TYPE_A}-${month && KPI_MONTH_RE.test(month) ? month : "tat-ca-thang"}.xlsx`;
}

type SortableKpi = { month: string; projectName?: string; userName: string };
/** Newest month first, then project name, then member name. */
export function sortKpiRows<T extends SortableKpi>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.month.localeCompare(a.month) ||
      (a.projectName ?? "").localeCompare(b.projectName ?? "", "vi") ||
      a.userName.localeCompare(b.userName, "vi"),
  );
}
