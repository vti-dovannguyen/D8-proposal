import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatMonth } from "@/lib/point-award";
import { KPI_TYPE_A } from "@/lib/project-kpi";
import { canViewKpiList, normalizeKpiFilters, queryKpiARows, queryKpiAFilterOptions } from "@/lib/kpi-a-report";
import { KpiAFilter } from "./kpi-a-filter";

export default async function KpiAPage({ searchParams }: { searchParams: Promise<{ month?: string; projectId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role, id: userId } = session.user;
  if (!canViewKpiList(role)) redirect("/");

  const sp = await searchParams;
  const filters = normalizeKpiFilters(sp);
  const [rows, options] = await Promise.all([
    queryKpiARows(role, userId, filters),
    queryKpiAFilterOptions(role, userId),
  ]);

  // Carry the active filters into the export so the file matches the table.
  const exportQuery = new URLSearchParams();
  if (filters.month) exportQuery.set("month", filters.month);
  if (filters.projectId) exportQuery.set("projectId", filters.projectId);
  const exportHref = `/api/kpi-a/export${exportQuery.size ? `?${exportQuery}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">List KPI {KPI_TYPE_A}</h1>
          <p className="portal-page-subtitle">
            Danh sách member đạt KPI loại {KPI_TYPE_A} của tất cả dự án
            {filters.month ? ` — ${formatMonth(filters.month)}` : ""}. Dữ liệu được nhập ở tab &quot;List KPI Loại {KPI_TYPE_A}&quot; trong chi tiết dự án.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <KpiAFilter months={options.months} projects={options.projects} />
          <a
            href={exportHref}
            className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            ⬇ Xuất Excel
          </a>
        </div>
      </div>

      <div className="portal-table-card">
        <table className="portal-table min-w-[760px]">
          <thead><tr><th>Tháng</th><th>Dự án</th><th>Member</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold text-slate-900">{formatMonth(r.month)}</td>
                <td>
                  <Link href={`/projects/${r.projectId}`} className="font-medium text-[var(--vti-deep,#0A3CA8)] hover:underline">{r.projectName}</Link>
                </td>
                <td className="portal-table-muted">{r.userName}</td>
                <td className="portal-table-muted">{r.note || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Chưa có KPI loại {KPI_TYPE_A} nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-500">Tổng: {rows.length} KPI loại {KPI_TYPE_A}</p>
    </div>
  );
}
