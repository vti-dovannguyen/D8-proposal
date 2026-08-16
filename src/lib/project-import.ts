export type RawProjectRow = Record<string, unknown>;
export type NormalizedProjectRow = {
  name: string;
  code: string | null;
  section: string;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  budgetedEffortMM: number | null;
  picPmEmail: string | null;
  picPmName: string | null;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Excel date serial (days since 1899-12-30) -> UTC midnight Date, avoiding the
 * local-timezone drift that `xlsx`'s `cellDates: true` option introduces. */
function excelDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Nguyễn Văn A (VTI.D8) <a.nguyenvan@vti.com.vn>" -> "a.nguyenvan@vti.com.vn" */
function extractEmail(v: unknown): string | null {
  const m = str(v).match(/<([^>]+)>/);
  return m ? m[1].trim().toLowerCase() : null;
}

/** "Nguyễn Văn A (VTI.D8)" -> "Nguyễn Văn A" */
function extractDisplayName(v: unknown): string | null {
  const s = str(v).replace(/<[^>]*>/, "").replace(/\(.*?\)\s*$/, "").trim();
  return s || null;
}

function parseBudget(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeProjectImportRows(rawRows: RawProjectRow[]): {
  rows: NormalizedProjectRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: NormalizedProjectRow[] = [];
  rawRows.forEach((raw, i) => {
    const lineNo = i + 2; // sheet header is row 1
    const name = str(raw["Name"]);
    if (!name) {
      errors.push(`Bỏ qua dòng ${lineNo}: thiếu Name`);
      return;
    }
    const startDate = excelDate(raw["Start Date"]);
    const endDate = excelDate(raw["End Date"]);
    if (startDate && endDate && startDate.getTime() >= endDate.getTime()) {
      errors.push(`Bỏ qua dòng ${lineNo} (${name}): Start Date phải trước End Date`);
      return;
    }
    const picPmRaw = raw["Project Manager/Display Name"];
    // xlsx auto-dedupes duplicate headers by suffixing "_1" on the second column.
    const picPmDisplayRaw = raw["Project Manager/Display Name_1"] ?? picPmRaw;
    rows.push({
      name,
      code: str(raw["Project Code"]) || null,
      section: str(raw["Department"]),
      active: str(raw["Status"]).toLowerCase() === "open",
      startDate,
      endDate,
      budgetedEffortMM: parseBudget(raw["Budgeted Effort (MM)"]),
      picPmEmail: extractEmail(picPmRaw),
      picPmName: extractDisplayName(picPmDisplayRaw),
    });
  });
  return { rows, errors };
}
