"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMonth } from "@/lib/point-award";

type ProjectOption = { id: string; name: string };

export function KpiAFilter({ months, projects }: { months: string[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/kpi-a?${next.toString()}`);
  }
  return (
    <div className="flex gap-2">
      <select
        value={params.get("month") ?? ""}
        onChange={(e) => setParam("month", e.target.value)}
        className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm"
      >
        <option value="">Tất cả tháng</option>
        {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
      </select>
      <select
        value={params.get("projectId") ?? ""}
        onChange={(e) => setParam("projectId", e.target.value)}
        className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm"
      >
        <option value="">Tất cả dự án</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
