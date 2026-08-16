import { eeDenominator, EFFORT_FIELDS, type EffortFields } from "@/lib/monthly-detail";

export type ProjMonthRow = {
  project: string;
  month: string;
  billableProject: number;
  calendarMember: number;
  calendarIntern: number;
  otMemberEffort: number;
  absent: number;
};

const EMPTY_EFFORT = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;

export function rollingMonths(from: Date): string[] {
  const year = from.getFullYear();
  const month = from.getMonth(); // 0-based
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(year, month + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function aggregateUnitReport(
  rows: ProjMonthRow[],
  months: string[],
  projectNames: string[],
): { projectRows: { project: string; values: number[] }[]; po: number[]; ee: number[] } {
  const po = months.map(() => 0);
  const den = months.map(() => 0);
  const billableByKey = new Map<string, number>(); // `${project}|${month}` -> billableProject

  for (const r of rows) {
    const mi = months.indexOf(r.month);
    if (mi < 0) continue;
    po[mi] += r.billableProject;
    den[mi] += eeDenominator({
      ...EMPTY_EFFORT,
      calendarMember: r.calendarMember,
      calendarIntern: r.calendarIntern,
      otMemberEffort: r.otMemberEffort,
      absent: r.absent,
    });
    const key = `${r.project}|${r.month}`;
    billableByKey.set(key, (billableByKey.get(key) ?? 0) + r.billableProject);
  }

  const ee = months.map((_, i) => (den[i] <= 0 ? 0 : (po[i] / den[i]) * 100));
  const projectRows = projectNames.map((project) => ({
    project,
    values: months.map((mo) => billableByKey.get(`${project}|${mo}`) ?? 0),
  }));
  return { projectRows, po, ee };
}

export function monthLabel(month: string, months: string[]): string {
  const [year, m] = month.split("-");
  const multiYear = new Set(months.map((mo) => mo.slice(0, 4))).size > 1;
  const n = Number(m);
  return multiYear ? `Tháng ${n}/${year}` : `Tháng ${n}`;
}
