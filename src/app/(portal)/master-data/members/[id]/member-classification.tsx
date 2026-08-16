"use client";
import { useState, useTransition } from "react";
import { EMPLOYEE_TYPES, EMPLOYEE_TYPE_LABELS, type EmployeeType } from "@/types";
import { setEmployeeType } from "./actions";

export function MemberClassification({ userId, current }: { userId: string; current: EmployeeType }) {
  const [value, setValue] = useState<EmployeeType>(current);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Phân loại nhân viên</h2>
      <p className="mb-3 text-xs text-slate-500">Effort của Intern được tính bằng 1/2 nhân viên chính thức.</p>
      <select
        className="rounded border px-2 py-1 text-sm disabled:opacity-50"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as EmployeeType;
          setValue(next);
          start(() => setEmployeeType(userId, next));
        }}
      >
        {EMPLOYEE_TYPES.map((t) => <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t]}</option>)}
      </select>
    </section>
  );
}
