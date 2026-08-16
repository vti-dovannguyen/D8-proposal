"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { MeetingWeekOption } from "@/lib/meeting-week-options";

const SECTIONS = ["", "D8.1", "D8.2", "D8.3"];
const STATUSES = ["", "DRAFT", "OPEN", "CLOSED"];

type ProjectOption = { id: string; name: string };

export function MeetingsFilter({
  projects,
  weeks,
  selectedWeek,
}: {
  projects: ProjectOption[];
  weeks: MeetingWeekOption[];
  /** Server-resolved default (current week of the year) when the URL has no `week` param. */
  selectedWeek: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/meetings?${next.toString()}`);
  }
  return (
    <div className="flex gap-2">
      <select defaultValue={params.get("week") ?? selectedWeek} onChange={(e) => setParam("week", e.target.value)} className="rounded border px-2 py-1 text-sm">
        <option value="">Tất cả tuần</option>
        {weeks.map((w) => <option key={w.week} value={w.week}>{w.label}</option>)}
      </select>
      <select defaultValue={params.get("section") ?? ""} onChange={(e) => setParam("section", e.target.value)} className="rounded border px-2 py-1 text-sm">
        {SECTIONS.map((s) => <option key={s} value={s}>{s || "Tất cả section"}</option>)}
      </select>
      <select defaultValue={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className="rounded border px-2 py-1 text-sm">
        {STATUSES.map((s) => <option key={s} value={s}>{s || "Tất cả trạng thái"}</option>)}
      </select>
      <select defaultValue={params.get("projectId") ?? ""} onChange={(e) => setParam("projectId", e.target.value)} className="rounded border px-2 py-1 text-sm">
        <option value="">Tất cả dự án</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
