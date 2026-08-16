"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProjectEditAccess } from "@/lib/project-access";
import { normalizeAllocation, type AllocationInput } from "@/lib/projects";
import { parseMonthlyPaste, EFFORT_FIELDS, MONTH_RE, type EffortFields } from "@/lib/monthly-detail";
import { normalizeKpiInput, type KpiInput } from "@/lib/project-kpi";

export type EnvironmentFormData = { name: string; url: string; username: string; password: string; note: string; status: string };

/**
 * Reveal an environment password so a manager (or the project's PIC PM) can
 * copy it into a login form. The password is write-only in normal reads;
 * this returns the plaintext on demand.
 */
export async function getEnvironmentPassword(id: string): Promise<string> {
  const env = await db.projectEnvironment.findUnique({ where: { id }, select: { password: true, projectId: true } });
  if (!env) return "";
  await requireProjectEditAccess(env.projectId);
  return env.password ?? "";
}

export async function updateServerInfo(projectId: string, serverInfo: string) {
  await requireProjectEditAccess(projectId);
  await db.project.update({ where: { id: projectId }, data: { serverInfo: serverInfo.trim() || null } });
  revalidatePath(`/projects/${projectId}`);
}

function cleanEnv(form: EnvironmentFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: tên môi trường là bắt buộc");
  return {
    name,
    url: form.url.trim() || null,
    username: form.username.trim() || null,
    note: form.note.trim() || null,
    status: form.status.trim() || "ACTIVE",
  };
}

export async function createEnvironment(projectId: string, form: EnvironmentFormData) {
  await requireProjectEditAccess(projectId);
  const password = form.password.trim();
  await db.projectEnvironment.create({ data: { projectId, ...cleanEnv(form), password: password || null } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateEnvironment(id: string, projectId: string, form: EnvironmentFormData) {
  await requireProjectEditAccess(projectId);
  const password = form.password.trim();
  await db.projectEnvironment.update({ where: { id }, data: { ...cleanEnv(form), ...(password ? { password } : {}) } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteEnvironment(id: string, projectId: string) {
  await requireProjectEditAccess(projectId);
  await db.projectEnvironment.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function addAllocation(projectId: string, input: AllocationInput) {
  await requireProjectEditAccess(projectId);
  const data = normalizeAllocation(input);
  if (!data) throw new Error("Validation: dòng phân bổ trống");
  await db.projectAllocation.create({ data: { projectId, ...data } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateAllocation(id: string, projectId: string, input: AllocationInput) {
  await requireProjectEditAccess(projectId);
  const data = normalizeAllocation(input);
  if (!data) throw new Error("Validation: dòng phân bổ trống");
  await db.projectAllocation.update({ where: { id }, data });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteAllocation(id: string, projectId: string) {
  await requireProjectEditAccess(projectId);
  await db.projectAllocation.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

/* ---------------------------------------------------------------- KPI Loại A */

function revalidateKpi(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/kpi-a");
}

/**
 * Award a KPI to several members for one month at once. Members already awarded
 * that month are skipped silently, so re-submitting the popup is a no-op rather
 * than a unique-constraint error.
 */
export async function addProjectKpis(projectId: string, input: KpiInput) {
  await requireProjectEditAccess(projectId);
  const { month, kpiType, entries } = normalizeKpiInput(input);
  await db.projectKpi.createMany({
    data: entries.map((e) => ({ projectId, month, kpiType, userId: e.userId, note: e.note })),
    skipDuplicates: true,
  });
  revalidateKpi(projectId);
}

export async function updateProjectKpiNote(id: string, projectId: string, note: string) {
  await requireProjectEditAccess(projectId);
  await db.projectKpi.update({ where: { id }, data: { note: note.trim() || null } });
  revalidateKpi(projectId);
}

export async function deleteProjectKpi(id: string, projectId: string) {
  await requireProjectEditAccess(projectId);
  await db.projectKpi.delete({ where: { id } });
  revalidateKpi(projectId);
}

export type MonthlyFormData = { month: string; eeToMonth: number } & EffortFields;

function cleanMonthly(form: MonthlyFormData) {
  const month = form.month.trim();
  if (!MONTH_RE.test(month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  const data: Record<string, number | string> = { month };
  for (const f of [...EFFORT_FIELDS, "eeToMonth" as const]) {
    const n = Number((form as Record<string, unknown>)[f]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Validation: giá trị không hợp lệ ở ${f}`);
    data[f] = n;
  }
  return data as { month: string } & EffortFields & { eeToMonth: number };
}

export async function addMonthlyDetail(projectId: string, form: MonthlyFormData) {
  await requireProjectEditAccess(projectId);
  await db.projectMonthlyDetail.create({ data: { projectId, ...cleanMonthly(form) } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateMonthlyDetail(id: string, projectId: string, form: MonthlyFormData) {
  await requireProjectEditAccess(projectId);
  await db.projectMonthlyDetail.update({ where: { id }, data: cleanMonthly(form) });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMonthlyDetail(id: string, projectId: string) {
  await requireProjectEditAccess(projectId);
  await db.projectMonthlyDetail.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function importMonthlyDetails(projectId: string, text: string): Promise<{ imported: number; errors: string[] }> {
  await requireProjectEditAccess(projectId);
  const { rows, errors } = parseMonthlyPaste(text);
  for (const r of rows) {
    const { month, ...rest } = r; // rest = effort fields + eeToMonth
    await db.projectMonthlyDetail.upsert({
      where: { projectId_month: { projectId, month } },
      create: { projectId, month, ...rest },
      update: { ...rest },
    });
  }
  revalidatePath(`/projects/${projectId}`);
  return { imported: rows.length, errors };
}
