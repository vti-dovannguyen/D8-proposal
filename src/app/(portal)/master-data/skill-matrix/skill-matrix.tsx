"use client";
import { useMemo, useState, useTransition } from "react";
import { ROLES } from "@/types";
import { levelMeta, LEVELS, levelDistribution, avgPerSkill, type LevelLookup } from "@/lib/skill-matrix";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";
import { setSkillLevel } from "./actions";

type Row = { id: string; name: string; title: string | null; section: string | null; role: string };
type Skill = { id: string; name: string };

export function SkillMatrix({ rows, skills, levels }: { rows: Row[]; skills: Skill[]; levels: LevelLookup }) {
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [pending, start] = useTransition();
  // Optimistic mirror of the server levels: update the cell immediately, then
  // resync when the server re-passes a new `levels` after revalidatePath. Uses
  // the "adjust state during render" pattern (no effect) so a fresh server
  // payload overwrites local edits without a cascading-render lint error.
  const [local, setLocal] = useState<LevelLookup>(levels);
  const [syncedLevels, setSyncedLevels] = useState(levels);
  if (syncedLevels !== levels) {
    setSyncedLevels(levels);
    setLocal(levels);
  }
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.section).filter((s): s is string => !!s))].sort(),
    [rows],
  );

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!department || r.section === department) &&
          (!role || r.role === role) &&
          (!employeeQuery || r.name.toLowerCase().includes(employeeQuery.toLowerCase())),
      ),
    [rows, department, role, employeeQuery],
  );

  const visibleSkills = useMemo(
    () => skills.filter((s) => !skillQuery || s.name.toLowerCase().includes(skillQuery.toLowerCase())),
    [skills, skillQuery],
  );

  const dist = useMemo(() => levelDistribution(visibleRows, visibleSkills, local), [visibleRows, visibleSkills, local]);
  const avg = useMemo(() => avgPerSkill(visibleRows, visibleSkills, local), [visibleRows, visibleSkills, local]);

  const cellLevel = (userId: string, skillId: string) => local[userId]?.[skillId] ?? 0;

  function changeLevel(userId: string, skillId: string, next: number) {
    setError(null);
    setLocal((m) => {
      const row = { ...(m[userId] ?? {}) };
      if (next === 0) delete row[skillId];
      else row[skillId] = next;
      return { ...m, [userId]: row };
    });
    start(async () => {
      try {
        await setSkillLevel(userId, skillId, next);
      } catch (e) {
        setLocal(levels); // revert to the last server truth
        setError(e instanceof Error ? e.message : "Không thể cập nhật level. Vui lòng thử lại.");
      }
    });
  }

  const selectClass = "h-8 w-14 rounded border-0 text-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" placeholder="Search employee..." value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} />
        <input className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" placeholder="Search skill..." value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="font-semibold">Proficiency:</span>
        {LEVELS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className={"inline-block h-3 w-3 rounded " + levelMeta(l).swatchClass} />
            {l} {levelMeta(l).label}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Số đánh giá theo level</h3>
          <BarChart data={dist} />
        </div>
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Độ thành thạo trung bình theo skill</h3>
          <LineChart data={avg} />
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white shadow-[var(--sh-1)]">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
              {visibleSkills.map((s) => (
                <th key={s.id} className="sticky top-0 z-10 min-w-[88px] border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold text-slate-600">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2">
                  <div className="font-semibold text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.title ?? "-"}</div>
                </td>
                {visibleSkills.map((s) => {
                  const lvl = cellLevel(r.id, s.id);
                  return (
                    <td key={s.id} className="border-b border-slate-100 px-1 py-1 text-center">
                      <select
                        className={selectClass + " " + levelMeta(lvl).cellClass}
                        value={lvl}
                        disabled={pending}
                        onChange={(e) => changeLevel(r.id, s.id, Number(e.target.value))}
                        aria-label={`${r.name} - ${s.name}`}
                      >
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={visibleSkills.length + 1} className="px-4 py-8 text-center text-slate-400">Không có nhân sự phù hợp</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
