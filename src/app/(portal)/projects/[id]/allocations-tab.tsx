"use client";
import { useState, useTransition } from "react";
import { effectiveHoursPerDay } from "@/lib/projects";
import { EMPLOYEE_TYPE_LABELS, type EmployeeType } from "@/types";
import { addAllocation, updateAllocation, deleteAllocation } from "./actions";

type Person = { id: string; name: string };
type SkillOpt = { id: string; name: string };
export type AllocItem = {
  id: string; userId: string | null; userName: string | null; employeeType: EmployeeType | null; role: string; skillId: string | null; skillName: string | null;
  hoursPerDay: number; gitAccount: string | null; backlogAccount: string | null; twoFA: boolean; active: boolean;
};
type Draft = { userId: string; role: string; skillId: string; hoursPerDay: number; gitAccount: string; backlogAccount: string; twoFA: boolean; active: boolean };

const EMPTY_DRAFT = (role: string): Draft => ({ userId: "", role, skillId: "", hoursPerDay: 8, gitAccount: "", backlogAccount: "", twoFA: false, active: true });

export function AllocationsTab({ projectId, allocations, users, skills, roles, canEdit }: {
  projectId: string; allocations: AllocItem[]; users: Person[]; skills: SkillOpt[]; roles: string[]; canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT(roles[0] ?? ""));
  const [pending, start] = useTransition();
  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Local copy so text fields edit smoothly; resync when the server re-passes rows.
  const [rows, setRows] = useState(allocations);
  const [synced, setSynced] = useState(allocations);
  if (synced !== allocations) { setSynced(allocations); setRows(allocations); }
  const patch = (id: string, p: Partial<AllocItem>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const persist = (r: AllocItem, over: Partial<AllocItem> = {}) => {
    const m = { ...r, ...over };
    start(() => updateAllocation(m.id, projectId, {
      userId: m.userId ?? "", role: m.role, skillId: m.skillId ?? "", hoursPerDay: m.hoursPerDay,
      gitAccount: m.gitAccount ?? "", backlogAccount: m.backlogAccount ?? "", twoFA: m.twoFA, active: m.active,
    }));
  };
  const cellInput = "w-full rounded border px-1 py-0.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="portal-table-card">
        <table className="portal-table min-w-[980px]">
          <thead><tr><th>Member</th><th>Phân loại</th><th>Vai trò</th><th>Skill</th><th>Giờ/ngày</th><th>Effort quy đổi</th><th>Account git</th><th>Account backlog</th><th>2FA</th><th>Trạng thái</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-slate-900">{a.userName ?? <span className="text-slate-400">— Chưa gán —</span>}</td>
                <td className="portal-table-muted">{a.employeeType ? EMPLOYEE_TYPE_LABELS[a.employeeType] : "-"}</td>
                <td><span className="portal-pill bg-violet-50 text-violet-700">{a.role}</span></td>
                <td className="portal-table-muted">{a.skillName ?? "-"}</td>
                <td className="portal-table-muted">{a.hoursPerDay}</td>
                <td className="portal-table-muted">{a.employeeType ? effectiveHoursPerDay(a.hoursPerDay, a.employeeType) : "-"}</td>
                <td>{canEdit
                  ? <input className={cellInput} value={a.gitAccount ?? ""} onChange={(e) => patch(a.id, { gitAccount: e.target.value })} onBlur={() => persist(a)} />
                  : <span className="portal-table-muted">{a.gitAccount || "-"}</span>}</td>
                <td>{canEdit
                  ? <input className={cellInput} value={a.backlogAccount ?? ""} onChange={(e) => patch(a.id, { backlogAccount: e.target.value })} onBlur={() => persist(a)} />
                  : <span className="portal-table-muted">{a.backlogAccount || "-"}</span>}</td>
                <td className="text-center">
                  <input type="checkbox" checked={a.twoFA} disabled={!canEdit} onChange={(e) => { patch(a.id, { twoFA: e.target.checked }); persist(a, { twoFA: e.target.checked }); }} />
                </td>
                <td className="text-center">
                  <input type="checkbox" checked={a.active} disabled={!canEdit} onChange={(e) => { patch(a.id, { active: e.target.checked }); persist(a, { active: e.target.checked }); }} />
                </td>
                {canEdit && <td className="text-right"><button type="button" className="text-red-600" onClick={() => start(() => deleteAllocation(a.id, projectId))}>Xóa</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={canEdit ? 11 : 10} className="px-4 py-8 text-center text-slate-400">Chưa có phân bổ nào</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!draft.role) return; start(async () => { await addAllocation(projectId, draft); setDraft(EMPTY_DRAFT(roles[0] ?? "")); }); }}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 shadow-[var(--sh-1)]"
        >
          <label className="text-sm">Member
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.userId} onChange={(e) => setD("userId", e.target.value)}>
              <option value="">— Chưa gán —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Vai trò
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.role} onChange={(e) => setD("role", e.target.value)}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm">Skill
            <select className="mt-1 block rounded border px-2 py-1 text-sm" value={draft.skillId} onChange={(e) => setD("skillId", e.target.value)}>
              <option value="">— Không —</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Giờ/ngày
            <input type="number" step="0.5" min="0" max="24" className="mt-1 block w-20 rounded border px-2 py-1 text-sm" value={draft.hoursPerDay} onChange={(e) => setD("hoursPerDay", Number(e.target.value))} />
          </label>
          <label className="text-sm">Account git<input className="mt-1 block w-32 rounded border px-2 py-1 text-sm" value={draft.gitAccount} onChange={(e) => setD("gitAccount", e.target.value)} /></label>
          <label className="text-sm">Account backlog<input className="mt-1 block w-32 rounded border px-2 py-1 text-sm" value={draft.backlogAccount} onChange={(e) => setD("backlogAccount", e.target.value)} /></label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={draft.twoFA} onChange={(e) => setD("twoFA", e.target.checked)} /> 2FA</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setD("active", e.target.checked)} /> Active</label>
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">+ Thêm</button>
        </form>
      )}
    </div>
  );
}
