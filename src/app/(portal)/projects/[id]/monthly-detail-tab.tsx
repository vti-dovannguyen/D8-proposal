"use client";
import { useState, useTransition } from "react";
import { ee, eeStatus, monthlyTotals, EFFORT_FIELDS, type EffortFields } from "@/lib/monthly-detail";
import { addMonthlyDetail, updateMonthlyDetail, deleteMonthlyDetail, importMonthlyDetails, type MonthlyFormData } from "./actions";

export type MonthlyItem = EffortFields & { id: string; month: string; eeToMonth: number };

const COLS: { key: keyof EffortFields; label: string }[] = [
  { key: "billableProject", label: "Billable Project" },
  { key: "billableDevelop", label: "Billable Develop" },
  { key: "warrantyEffort", label: "Warranty Effort" },
  { key: "calendarMember", label: "Calendar Member" },
  { key: "calendarIntern", label: "Calendar Intern" },
  { key: "calendarCollaborator", label: "Calendar Collaborator" },
  { key: "otMemberEffort", label: "OT Member Effort" },
  { key: "otInternEffort", label: "OT Intern Effort" },
  { key: "otCollaboratorEffort", label: "OT Collaborator Effort" },
  { key: "absent", label: "Absent" },
];

const ZERO: EffortFields = Object.fromEntries(EFFORT_FIELDS.map((f) => [f, 0])) as EffortFields;
const EMPTY_DRAFT = (): MonthlyFormData => ({ month: "", eeToMonth: 0, ...ZERO });

const DOT: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500",
};

function StatusCell({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[eeStatus(value)]}`} />
      {value.toFixed(2)}
    </span>
  );
}

export function MonthlyDetailTab({ projectId, details, canEdit }: {
  projectId: string; details: MonthlyItem[]; canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<MonthlyFormData>(EMPTY_DRAFT());
  const setD = <K extends keyof MonthlyFormData>(k: K, v: MonthlyFormData[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const [rows, setRows] = useState(details);
  const [synced, setSynced] = useState(details);
  if (synced !== details) { setSynced(details); setRows(details); }
  const patch = (id: string, p: Partial<MonthlyItem>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const persist = (r: MonthlyItem, over: Partial<MonthlyItem> = {}) => {
    const m = { ...r, ...over };
    const form: MonthlyFormData = { month: m.month, eeToMonth: m.eeToMonth, ...(Object.fromEntries(EFFORT_FIELDS.map((f) => [f, m[f]])) as EffortFields) };
    start(() => updateMonthlyDetail(m.id, projectId, form));
  };

  // Edit buffer: stores transient string while user is mid-typing; keyed by "rowId:field"
  const [editBuf, setEditBuf] = useState<Record<string, string>>({});
  const bufKey = (id: string, field: string) => `${id}:${field}`;
  const getBuf = (id: string, field: string, numeric: number) => {
    const k = bufKey(id, field);
    return k in editBuf ? editBuf[k] : String(numeric);
  };
  const setBuf = (id: string, field: string, val: string) =>
    setEditBuf((b) => ({ ...b, [bufKey(id, field)]: val }));
  const flushBuf = (r: MonthlyItem, field: string) => {
    const k = bufKey(r.id, field);
    if (!(k in editBuf)) return;
    const parsed = editBuf[k] === "" ? 0 : Number(editBuf[k]);
    const num = isNaN(parsed) ? 0 : parsed;
    setEditBuf((b) => { const next = { ...b }; delete next[k]; return next; });
    const updated = { ...r, [field]: num } as MonthlyItem;
    patch(r.id, { [field]: num } as Partial<MonthlyItem>);
    persist(updated);
  };

  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const runImport = () => start(async () => {
    const res = await importMonthlyDetails(projectId, importText);
    setImportMsg(`Đã nhập ${res.imported} dòng.${res.errors.length ? " Lỗi: " + res.errors.join("; ") : ""}`);
    if (res.errors.length === 0) { setImportText(""); }
  });

  const totals = monthlyTotals(rows);
  const cellInput = "w-20 rounded border px-1 py-0.5 text-right text-sm";
  const colCount = 1 + COLS.length + 2 + (canEdit ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="portal-table-card overflow-x-auto">
        <table className="portal-table min-w-[1400px]">
          <thead>
            <tr>
              <th>Tháng</th>
              {COLS.map((c) => <th key={c.key} className="text-right">{c.label} (MM)</th>)}
              <th className="text-right">EE (%)</th>
              <th className="text-right">EE To Month (%)</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold text-slate-900">{r.month}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="text-right">
                    {canEdit
                      ? <input type="number" step="0.01" min="0" className={cellInput}
                          value={getBuf(r.id, c.key, r[c.key])}
                          onChange={(e) => setBuf(r.id, c.key, e.target.value)}
                          onBlur={() => flushBuf(r, c.key)} />
                      : <span className="portal-table-muted">{r[c.key]}</span>}
                  </td>
                ))}
                <td className="text-right"><StatusCell value={ee(r)} /></td>
                <td className="text-right">
                  {canEdit
                    ? <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${DOT[eeStatus(r.eeToMonth)]}`} />
                        <input type="number" step="0.01" min="0" className={cellInput}
                          value={getBuf(r.id, "eeToMonth", r.eeToMonth)}
                          onChange={(e) => setBuf(r.id, "eeToMonth", e.target.value)}
                          onBlur={() => flushBuf(r, "eeToMonth")} />
                      </span>
                    : <StatusCell value={r.eeToMonth} />}
                </td>
                {canEdit && <td className="text-right"><button type="button" className="text-red-600" onClick={() => start(() => deleteMonthlyDetail(r.id, projectId))}>Xóa</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu tháng nào</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td>Tổng</td>
                {COLS.map((c) => <td key={c.key} className="text-right">{totals[c.key].toFixed(2)}</td>)}
                <td></td><td></td>{canEdit && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!draft.month) return; start(async () => { await addMonthlyDetail(projectId, draft); setDraft(EMPTY_DRAFT()); }); }}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]"
        >
          <label className="text-sm">Tháng
            <input type="month" required className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.month} onChange={(e) => setD("month", e.target.value)} />
          </label>
          {COLS.map((c) => (
            <label key={c.key} className="text-sm">{c.label}
              <input type="number" step="0.01" min="0" className="mt-1 block w-24 rounded border px-2 py-1 text-sm" value={draft[c.key]} onChange={(e) => setD(c.key, Number(e.target.value))} />
            </label>
          ))}
          <label className="text-sm">EE To Month (%)
            <input type="number" step="0.01" min="0" className="mt-1 block w-24 rounded border px-2 py-1 text-sm" value={draft.eeToMonth} onChange={(e) => setD("eeToMonth", Number(e.target.value))} />
          </label>
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">+ Thêm</button>
        </form>
      )}

      {canEdit && (
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]">
          <button type="button" className="text-sm font-semibold text-[var(--vti-deep,#0A3CA8)]" onClick={() => setImportOpen((v) => !v)}>
            {importOpen ? "▾" : "▸"} Nhập từ Excel
          </button>
          {importOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">Dán các dòng từ file WR (cách nhau bằng Tab). Thứ tự cột: Tháng, Billable Project, Billable Develop, Warranty Effort, Calendar Member, Calendar Intern, Calendar Collaborator, OT Member Effort, OT Intern Effort, OT Collaborator Effort, Absent, EE, EE To Month.</p>
              <textarea className="h-32 w-full rounded border p-2 font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="2026-01&#9;5&#9;0&#9;..." />
              <div className="flex items-center gap-3">
                <button type="button" disabled={pending || !importText.trim()} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" onClick={runImport}>Nhập</button>
                {importMsg && <span className="text-xs text-slate-600">{importMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
