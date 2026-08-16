"use client";
import { useState, useTransition } from "react";
import { setUserSkill, removeUserSkill } from "./actions";

export type UserSkillRow = { id: string; skillId: string; name: string; level: number };
type SkillOption = { id: string; name: string };
const LEVELS = [1, 2, 3, 4, 5];
const LEVEL_LABEL: Record<number, string> = { 1: "Beginner", 2: "Basic", 3: "Intermediate", 4: "Advanced", 5: "Expert" };

export function MemberSkills({ userId, current, options }: { userId: string; current: UserSkillRow[]; options: SkillOption[] }) {
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState(3);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Skills</h2>
      <ul className="mb-3 space-y-1">
        {current.map((s) => (
          <li key={s.id} className="flex items-center justify-between text-sm">
            <span>{s.name} — <span className="text-slate-500">{LEVEL_LABEL[s.level]}</span></span>
            <button type="button" className="text-xs text-red-500" onClick={() => start(() => removeUserSkill(s.id, userId))}>xóa</button>
          </li>
        ))}
        {current.length === 0 && <li className="text-sm text-slate-400">Chưa gán skill</li>}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (!skillId) return; start(async () => { await setUserSkill(userId, skillId, level); setSkillId(""); }); }}
      >
        <select className="rounded border px-2 py-1 text-sm" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Chọn skill…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="rounded border px-2 py-1 text-sm" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Gán</button>
      </form>
    </section>
  );
}
