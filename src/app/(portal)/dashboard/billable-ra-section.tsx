"use client";
import { useState, useTransition } from "react";
import { eeStatus } from "@/lib/monthly-detail";
import { setUnitHeadcount } from "./actions";

type Overview = { ee: number[]; po: number[] };
type ProjectRow = { project: string; values: number[] };
type HeadcountRow = { lbQaOt: number; intern: number; official: number };
type HeadcountField = "lbQaOt" | "intern" | "official";

const DOT: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500",
};

const HEADCOUNT_ROWS: { field: HeadcountField; label: string }[] = [
  { field: "lbQaOt", label: "LB+QA+OT" },
  { field: "intern", label: "Intern" },
  { field: "official", label: "Chính thức" },
];

export function BillableRaSection({ months, monthLabels, overview, projectRows, headcounts, canEdit }: {
  months: string[];
  monthLabels: string[];
  overview: Overview;
  projectRows: ProjectRow[];
  headcounts: Record<string, HeadcountRow>;
  canEdit: boolean;
}) {
  const [, start] = useTransition();

  // Local copy so inline edits feel instant; resync when the server re-passes props.
  const [hc, setHc] = useState(headcounts);
  const [synced, setSynced] = useState(headcounts);
  if (synced !== headcounts) { setSynced(headcounts); setHc(headcounts); }
  const valueOf = (month: string, field: HeadcountField) => hc[month]?.[field] ?? 0;

  const [editBuf, setEditBuf] = useState<Record<string, string>>({});
  const bufKey = (month: string, field: string) => `${month}:${field}`;
  const getBuf = (month: string, field: HeadcountField) => {
    const k = bufKey(month, field);
    return k in editBuf ? editBuf[k] : String(valueOf(month, field));
  };
  const setBuf = (month: string, field: string, val: string) =>
    setEditBuf((b) => ({ ...b, [bufKey(month, field)]: val }));
  const flushBuf = (month: string, field: HeadcountField) => {
    const k = bufKey(month, field);
    if (!(k in editBuf)) return;
    const parsed = editBuf[k] === "" ? 0 : Number(editBuf[k]);
    const num = isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
    setEditBuf((b) => { const next = { ...b }; delete next[k]; return next; });
    setHc((cur) => {
      const prev: HeadcountRow = cur[month] ?? { lbQaOt: 0, intern: 0, official: 0 };
      return { ...cur, [month]: { ...prev, [field]: num } };
    });
    start(() => setUnitHeadcount(month, field, num));
  };

  const cellInput = "w-20 rounded border px-1 py-0.5 text-right text-sm";

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/85 p-5 shadow-[var(--sh-1)] backdrop-blur">
      <h2 className="mb-4 text-base font-semibold text-slate-950">Tình hình Billable / RA</h2>

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Tổng quan</p>
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[560px]">
          <thead>
            <tr><th>Chỉ số</th>{monthLabels.map((l) => <th key={l} className="text-right">{l}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-slate-900">EE</td>
              {overview.ee.map((v, i) => (
                <td key={i} className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-slate-900">
                    <span className={`inline-block h-2 w-2 rounded-full ${DOT[eeStatus(v)]}`} />
                    {v.toFixed(2)}
                  </span>
                </td>
              ))}
            </tr>
            {HEADCOUNT_ROWS.map((rowDef) => (
              <tr key={rowDef.field}>
                <td className="font-semibold text-slate-900">{rowDef.label}</td>
                {months.map((mo) => (
                  <td key={mo} className="text-right">
                    {canEdit
                      ? <input type="number" min="0" step="1" className={cellInput}
                          value={getBuf(mo, rowDef.field)}
                          onChange={(e) => setBuf(mo, rowDef.field, e.target.value)}
                          onBlur={() => flushBuf(mo, rowDef.field)} />
                      : <span>{valueOf(mo, rowDef.field)}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="font-semibold text-slate-900">PO</td>
              {overview.po.map((v, i) => <td key={i} className="text-right font-semibold text-slate-900">{v.toFixed(2)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Chi tiết theo dự án</p>
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[560px]">
          <thead>
            <tr><th>Dự án</th>{monthLabels.map((l) => <th key={l} className="text-right">{l}</th>)}</tr>
          </thead>
          <tbody>
            {projectRows.map((r) => (
              <tr key={r.project}>
                <td className="font-semibold text-slate-900">{r.project}</td>
                {r.values.map((v, i) => <td key={i} className="text-right">{v}</td>)}
              </tr>
            ))}
            {projectRows.length === 0 && (
              <tr><td colSpan={1 + months.length} className="px-4 py-8 text-center text-slate-400">Chưa có dự án</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
