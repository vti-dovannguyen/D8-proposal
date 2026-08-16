"use client";
import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { ENVIRONMENT_NAMES } from "@/lib/master-data";
import { createEnvironment, updateEnvironment, deleteEnvironment, getEnvironmentPassword, type EnvironmentFormData } from "./actions";

export type EnvRow = { id: string; name: string; url: string; username: string; note: string; status: string; hasPassword: boolean };
const EMPTY: EnvironmentFormData = { name: "", url: "", username: "", password: "", note: "", status: "ACTIVE" };

export function EnvironmentsTab({ projectId, environments, canEdit }: { projectId: string; environments: EnvRow[]; canEdit: boolean }) {
  const [form, setForm] = useState<EnvironmentFormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHasPw, setEditingHasPw] = useState(false);
  const [pending, start] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const set = <K extends keyof EnvironmentFormData>(k: K, v: EnvironmentFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function copyPassword(id: string) {
    try {
      const pw = await getEnvironmentPassword(id);
      if (!pw) return;
      await navigator.clipboard.writeText(pw);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard needs a secure context (https/localhost); ignore otherwise.
    }
  }
  const inputCls = "mt-1 w-full rounded border px-2 py-1 text-sm";

  function edit(e: EnvRow) {
    setEditingId(e.id); setEditingHasPw(e.hasPassword);
    setForm({ name: e.name, url: e.url, username: e.username, password: "", note: e.note, status: e.status });
  }
  function reset() { setEditingId(null); setEditingHasPw(false); setForm(EMPTY); }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; start(async () => { if (editingId) await updateEnvironment(editingId, projectId, form); else await createEnvironment(projectId, form); reset(); }); }}
          className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)] sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block text-sm">Tên môi trường
            <input list="env-names" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="T4 / Dev / Staging / Production" />
            <datalist id="env-names">{ENVIRONMENT_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="block text-sm">URL<input type="url" className={inputCls} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." /></label>
          <label className="block text-sm">Trạng thái
            <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="block text-sm">Tài khoản<input className={inputCls} value={form.username} onChange={(e) => set("username", e.target.value)} /></label>
          <label className="block text-sm">Mật khẩu
            <input type="password" autoComplete="off" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={editingHasPw ? "•••• (đã có — để trống nếu giữ nguyên)" : "Mật khẩu"} />
          </label>
          <label className="block text-sm lg:col-span-3">Ghi chú<input className={inputCls} value={form.note} onChange={(e) => set("note", e.target.value)} /></label>
          <div className="flex justify-end gap-2 lg:col-span-3">
            {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm">Hủy</button>}
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm môi trường"}</button>
          </div>
        </form>
      )}

      <div className="portal-table-card">
        <table className="portal-table min-w-[760px]">
          <thead><tr><th>Môi trường</th><th>URL</th><th>Tài khoản</th><th>Trạng thái</th><th>Ghi chú</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {environments.map((e) => (
              <tr key={e.id}>
                <td className="font-semibold text-slate-900">{e.name}</td>
                <td className="portal-table-muted">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{e.url} ↗</a> : "-"}</td>
                <td className="portal-table-muted">
                  {e.username || "-"}
                  {e.hasPassword && (
                    <span className="ml-2 inline-flex items-center gap-1 align-middle">
                      <span className="portal-pill inline-flex items-center bg-amber-50 text-amber-700"><KeyRound size={12} /></span>
                      {canEdit && (
                        <button
                          type="button"
                          title="Copy mật khẩu để đăng nhập"
                          aria-label="Copy mật khẩu"
                          onClick={() => copyPassword(e.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[var(--vti-deep,#0A3CA8)]"
                        >
                          {copiedId === e.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td><span className={"portal-pill " + (e.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{e.status}</span></td>
                <td className="portal-table-muted">{e.note || "-"}</td>
                {canEdit && (
                  <td className="text-right">
                    <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => edit(e)}>Sửa</button>
                    <button type="button" className="text-red-600" onClick={() => start(() => deleteEnvironment(e.id, projectId))}>Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {environments.length === 0 && <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400">Chưa có môi trường nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
