"use client";
import { useState, useTransition } from "react";
import type { CertTypeFormData } from "./actions";

export type CertTypeRow = { id: string; name: string; issuer: string; category: string; active: boolean };

export function CertTypeManager({
  types,
  onCreate,
  onUpdate,
  onDelete,
}: {
  types: CertTypeRow[];
  onCreate: (data: CertTypeFormData) => Promise<void>;
  onUpdate: (id: string, data: CertTypeFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => { await onCreate({ name, issuer, category, active: true }); setName(""); setIssuer(""); setCategory(""); });
        }}
      >
        <input className="rounded border px-2 py-1 text-sm" placeholder="Tên chứng chỉ" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nơi cấp (tùy chọn)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nhóm (tùy chọn)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm</button>
      </form>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Chứng chỉ</th><th>Nơi cấp</th><th>Nhóm</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold text-slate-900">{t.name}</td>
                <td className="portal-table-muted">{t.issuer || "-"}</td>
                <td className="portal-table-muted">{t.category || "-"}</td>
                <td><span className={"portal-pill " + (t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{t.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right">
                  <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => start(() => onUpdate(t.id, { name: t.name, issuer: t.issuer, category: t.category, active: !t.active }))}>{t.active ? "Ẩn" : "Hiện"}</button>
                  <button type="button" className="text-red-600" onClick={() => start(() => onDelete(t.id))}>Xóa</button>
                </td>
              </tr>
            ))}
            {types.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có loại chứng chỉ</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
