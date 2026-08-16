import "server-only";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import type { Role } from "@/types";
import { KPI_TYPE_A, KPI_MONTH_RE, sortKpiRows } from "@/lib/project-kpi";

export type KpiAFilters = { month?: string; projectId?: string };
export type KpiARow = {
  id: string;
  month: string;
  projectId: string;
  projectName: string;
  userName: string;
  note: string | null;
};

/** Whether a role may see the cross-project KPI list at all (same rule as the nav item). */
export function canViewKpiList(role: Role): boolean {
  return isManager(role) || role === "PM";
}

/**
 * Row-level visibility for the cross-project KPI list: a PM only sees projects
 * they're PIC PM on, everyone else sees all. Unlike `projectVisibilityWhere`
 * this does NOT filter on `active` — KPI history stays visible after a project
 * closes.
 */
export function kpiProjectWhere(role: Role, userId: string) {
  return role === "PM" ? { picPms: { some: { id: userId } } } : {};
}

/** Normalize the URL filters: a malformed month is ignored rather than erroring. */
export function normalizeKpiFilters(raw: KpiAFilters): KpiAFilters {
  return {
    month: KPI_MONTH_RE.test(raw.month ?? "") ? raw.month : undefined,
    projectId: raw.projectId || undefined,
  };
}

/** The rows behind both the `/kpi-a` table and its Excel export — one source of truth. */
export async function queryKpiARows(role: Role, userId: string, filters: KpiAFilters): Promise<KpiARow[]> {
  const { month, projectId } = normalizeKpiFilters(filters);
  const rows = await db.projectKpi.findMany({
    where: {
      kpiType: KPI_TYPE_A,
      project: kpiProjectWhere(role, userId),
      ...(month ? { month } : {}),
      ...(projectId ? { projectId } : {}),
    },
    include: { project: { select: { id: true, name: true } }, user: { select: { name: true } } },
  });
  return sortKpiRows(
    rows.map((k) => ({
      id: k.id, month: k.month, projectId: k.project.id, projectName: k.project.name, userName: k.user.name, note: k.note,
    })),
  );
}

/** Months + projects present in everything the caller may see — powers the filter dropdowns. */
export async function queryKpiAFilterOptions(role: Role, userId: string) {
  const rows = await db.projectKpi.findMany({
    where: { kpiType: KPI_TYPE_A, project: kpiProjectWhere(role, userId) },
    select: { month: true, project: { select: { id: true, name: true } } },
  });
  return {
    months: [...new Set(rows.map((r) => r.month))].sort((a, b) => b.localeCompare(a)),
    projects: [...new Map(rows.map((r) => [r.project.id, r.project])).values()].sort((a, b) => a.name.localeCompare(b.name, "vi")),
  };
}
