export type EffortFields = {
  billableProject: number;
  billableDevelop: number;
  warrantyEffort: number;
  calendarMember: number;
  calendarIntern: number;
  calendarCollaborator: number;
  otMemberEffort: number;
  otInternEffort: number;
  otCollaboratorEffort: number;
  absent: number;
};

export const EFFORT_FIELDS: (keyof EffortFields)[] = [
  "billableProject", "billableDevelop", "warrantyEffort",
  "calendarMember", "calendarIntern", "calendarCollaborator",
  "otMemberEffort", "otInternEffort", "otCollaboratorEffort", "absent",
];

export const EE_THRESHOLDS = { green: 90, amber: 80 } as const;

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// An intern's effort counts at half of an official member's.
export const INTERN_EFFORT_FACTOR = 0.5;

export function eeDenominator(row: EffortFields): number {
  return row.calendarMember + row.calendarIntern * INTERN_EFFORT_FACTOR + row.otMemberEffort - row.absent;
}

export function ee(row: EffortFields): number {
  const den = eeDenominator(row);
  return den <= 0 ? 0 : (row.billableProject / den) * 100;
}

export function eeStatus(value: number): "green" | "amber" | "red" {
  if (value >= EE_THRESHOLDS.green) return "green";
  if (value >= EE_THRESHOLDS.amber) return "amber";
  return "red";
}

export function monthlyTotals(rows: EffortFields[]): EffortFields {
  const total = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;
  for (const r of rows) for (const f of EFFORT_FIELDS) total[f] += r[f];
  return total;
}

export type ParsedMonthlyRow = EffortFields & { month: string; eeToMonth: number };

// Cell layout, tab-separated, matching the WR sheet:
// 0 month | 1..10 effort (EFFORT_FIELDS order) | 11 ee (ignored) | 12 eeToMonth
export function parseMonthlyPaste(text: string): { rows: ParsedMonthlyRow[]; errors: string[] } {
  const rows: ParsedMonthlyRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  for (const line of lines) {
    const cells = line.split("\t").map((c) => c.trim());
    const month = cells[0];
    if (!MONTH_RE.test(month)) {
      // Skip a header row silently; report anything else that looks like data.
      if (cells.length > 1 && cells.slice(1).some((c) => c !== "" && !Number.isNaN(Number(c)))) {
        errors.push(`Tháng không hợp lệ: "${month}"`);
      } else if (!/^months?$/i.test(month)) {
        errors.push(`Tháng không hợp lệ: "${month}"`);
      }
      continue;
    }
    const num = (i: number): number | null => {
      const raw = cells[i] ?? "";
      if (raw === "") return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const parsed = {} as ParsedMonthlyRow;
    let bad = false;
    EFFORT_FIELDS.forEach((f, idx) => {
      const n = num(idx + 1); // cells[1..10]
      if (n === null) bad = true;
      else parsed[f] = n;
    });
    const eeToMonth = num(12); // cells[12]; cells[11] (ee) ignored
    if (eeToMonth === null) bad = true;
    if (bad) {
      errors.push(`Giá trị không hợp lệ tại tháng "${month}"`);
      continue;
    }
    parsed.month = month;
    parsed.eeToMonth = eeToMonth as number;
    rows.push(parsed);
  }
  return { rows, errors };
}
