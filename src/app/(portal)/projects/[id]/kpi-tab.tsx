"use client";
import { useMemo, useState, useTransition } from "react";
import { formatMonth } from "@/lib/point-award";
import { KPI_TYPE_A, sortKpiRows } from "@/lib/project-kpi";
import { addProjectKpis, updateProjectKpiNote, deleteProjectKpi } from "./actions";

type Person = { id: string; name: string };
export type KpiItem = { id: string; month: string; userId: string; userName: string; note: string | null };

const currentMonth = () => new Date().toISOString().slice(0, 7);

export function KpiTab({ projectId, kpis, users, canEdit }: {
  projectId: string; kpis: KpiItem[]; users: Person[]; canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  // Local copy so the note inputs edit smoothly; resync when the server re-passes rows.
  const [rows, setRows] = useState(kpis);
  const [synced, setSynced] = useState(kpis);
  if (synced !== kpis) { setSynced(kpis); setRows(kpis); }
  const sorted = useMemo(() => sortKpiRows(rows), [rows]);
  const patch = (id: string, note: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, note } : r)));

  return (
    <div className="space-y-4">
      <div className="portal-table-card">
        <table className="portal-table min-w-[720px]">
          <thead><tr><th>Tháng</th><th>Member</th><th>Loại KPI</th><th>Ghi chú</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {sorted.map((k) => (
              <tr key={k.id}>
                <td className="font-semibold text-slate-900">{formatMonth(k.month)}</td>
                <td className="portal-table-muted">{k.userName}</td>
                <td><span className="portal-pill bg-amber-50 text-amber-700">Loại {KPI_TYPE_A}</span></td>
                <td>{canEdit
                  ? <input
                      className="w-full rounded border px-1 py-0.5 text-sm"
                      placeholder="Ghi chú (không bắt buộc)"
                      value={k.note ?? ""}
                      onChange={(e) => patch(k.id, e.target.value)}
                      onBlur={(e) => start(() => updateProjectKpiNote(k.id, projectId, e.target.value))}
                    />
                  : <span className="portal-table-muted">{k.note || "-"}</span>}</td>
                {canEdit && (
                  <td className="text-right">
                    <button type="button" className="text-red-600" disabled={pending} onClick={() => start(() => deleteProjectKpi(k.id, projectId))}>Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-slate-400">Chưa có KPI loại {KPI_TYPE_A} nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white"
        >
          + Add KPI
        </button>
      )}

      {open && (
        <AddKpiDialog
          projectId={projectId}
          users={users}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function AddKpiDialog({ projectId, users, onClose }: { projectId: string; users: Person[]; onClose: () => void }) {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({}); // userId -> note
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
  }, [users, search]);

  const toggle = (id: string) =>
    setPicked((p) => {
      if (!(id in p)) return { ...p, [id]: "" };
      const rest = { ...p };
      delete rest[id];
      return rest;
    });

  function submit() {
    const entries = Object.entries(picked).map(([userId, note]) => ({ userId, note }));
    if (entries.length === 0) { setError("Chọn ít nhất 1 member"); return; }
    setError("");
    start(async () => {
      try {
        await addProjectKpis(projectId, { month, entries });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message.replace(/^Validation:\s*/, "") : "Không lưu được KPI");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={`Thêm KPI loại ${KPI_TYPE_A}`}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#dbe3ef] px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Thêm KPI loại {KPI_TYPE_A}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">✕</button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <label className="block text-sm font-medium text-slate-700">Tháng
            <input type="month" className="mt-1 block rounded border px-2 py-1 text-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Member đạt KPI loại {KPI_TYPE_A}</span>
              <span className="text-xs text-slate-500">Đã chọn: {Object.keys(picked).length}</span>
            </div>
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              placeholder="Tìm member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded border border-[#dbe3ef] p-2">
              {shown.map((u) => {
                const checked = u.id in picked;
                return (
                  <div key={u.id} className="rounded px-1 py-0.5 hover:bg-slate-50">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} />
                      <span className={checked ? "font-semibold text-slate-900" : "text-slate-700"}>{u.name}</span>
                    </label>
                    {checked && (
                      <input
                        className="mt-1 ml-6 w-[calc(100%-1.5rem)] rounded border px-2 py-1 text-sm"
                        placeholder="Ghi chú (không bắt buộc)"
                        value={picked[u.id]}
                        onChange={(e) => setPicked((p) => ({ ...p, [u.id]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Không tìm thấy member</p>}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#dbe3ef] px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-1.5 text-sm font-medium text-slate-700">Hủy</button>
          <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
