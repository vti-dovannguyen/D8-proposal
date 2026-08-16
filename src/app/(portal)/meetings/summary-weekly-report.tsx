"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { getWeeklySummaryReport } from "./actions";
import { projectStatusClass, eeStatusClass } from "@/lib/meetings";
import type { SummarySectionGroup } from "@/lib/weekly-summary-report";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}

export function SummaryWeeklyReport({
  weekStart,
  weekEnd,
  eeNorm,
  initialGroups,
}: {
  weekStart?: string;
  weekEnd?: string;
  /** NORM threshold (see lib/meetings.ts#getEeNorm) — read server-side, passed down for the Tình trạng EE column. */
  eeNorm: number;
  /** When provided (detail-page read-only view), the report renders immediately — no fetch button. */
  initialGroups?: SummarySectionGroup[];
}) {
  const [groups, setGroups] = useState<SummarySectionGroup[] | null>(initialGroups ?? null);
  const [error, setError] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const hasWeek = Boolean(weekStart && weekEnd);
  const readOnly = initialGroups !== undefined;
  const totalRows = groups?.reduce((sum, g) => sum + g.rows.length, 0) ?? 0;

  function fetchReport() {
    if (!weekStart || !weekEnd) return;
    setError("");
    start(async () => {
      try {
        setGroups(await getWeeklySummaryReport(weekStart, weekEnd));
        setCollapsedSections(new Set());
      } catch (e) {
        setGroups(null);
        setError(e instanceof Error ? e.message : "Không tổng hợp được report.");
      }
    });
  }

  function toggleSection(section: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white shadow-[var(--sh-1)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vti-line,#E7DED2)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays size={15} className="text-[var(--vti-deep,#0A3CA8)]" />
          Report nguồn được tổng hợp {groups !== null && `( ${totalRows} )`}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Bao gồm cả report đang mở và đã chốt</span>
          {!readOnly && (
            <button
              type="button"
              onClick={fetchReport}
              disabled={!hasWeek || pending}
              title={hasWeek ? undefined : "Nhập khoảng tuần (Từ / Đến) trước"}
              className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Đang tổng hợp…" : "Tổng hợp report"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}

      {groups !== null && groups.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Không có report nào trong khoảng tuần đã chọn.</p>
      )}

      {groups !== null &&
        groups.map((group) => {
          const collapsed = collapsedSections.has(group.section);
          return (
            <div key={group.section} className="border-t border-[var(--vti-line,#E7DED2)] first:border-t-0">
              <button
                type="button"
                onClick={() => toggleSection(group.section)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="portal-pill bg-slate-100 text-slate-600">{group.section}</span>
                  <span className="text-xs font-normal text-slate-500">{group.rows.length} dự án</span>
                </span>
              </button>
              {!collapsed && (
                <div className="portal-table-card shadow-none">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Tên dự án</th>
                        <th>Tình trạng</th>
                        <th>Tình trạng EE</th>
                        <th>Risk/Issues</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={`${row.meetingId}:${row.projectName}`}>
                          <td>
                            <Link
                              href={`/meetings/${row.meetingId}`}
                              className="font-semibold text-[var(--vti-deep,#0A3CA8)] hover:underline"
                            >
                              {row.projectName}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {row.ownerName} · {formatDateTime(row.updatedAt)}
                            </p>
                          </td>
                          <td>
                            <span className={`portal-pill ${projectStatusClass(row.projectStatus)}`}>{row.projectStatus}</span>
                          </td>
                          <td>
                            <span className={`portal-pill ${eeStatusClass(row.divisionEE, eeNorm)}`}>
                              {row.divisionEE != null ? `${row.divisionEE}%` : "—"}
                            </span>
                          </td>
                          <td className="max-w-xs portal-table-muted">{row.riskSummary}</td>
                          <td className="max-w-xs portal-table-muted">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
