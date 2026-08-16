import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { canViewKpiList, queryKpiARows, normalizeKpiFilters } from "@/lib/kpi-a-report";
import { buildKpiExportAoa, kpiExportFileName, KPI_TYPE_A } from "@/lib/project-kpi";

export const dynamic = "force-dynamic";

/**
 * Excel export for the "List KPI A" screen. Exports exactly what the table
 * shows — same visibility rules and same month/project filters, passed through
 * as query params by the export button.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!canViewKpiList(session.user.role)) return new Response("Forbidden", { status: 403 });

  const params = new URL(request.url).searchParams;
  const filters = normalizeKpiFilters({ month: params.get("month") ?? undefined, projectId: params.get("projectId") ?? undefined });
  const rows = await queryKpiARows(session.user.role, session.user.id, filters);

  const sheet = XLSX.utils.aoa_to_sheet(buildKpiExportAoa(rows));
  sheet["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 24 }, { wch: 10 }, { wch: 48 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `KPI ${KPI_TYPE_A}`);
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kpiExportFileName(filters.month)}"`,
      "Cache-Control": "no-store",
    },
  });
}
