"use server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { normalizeAllocations, type AllocationInput } from "@/lib/projects";
import { requireProjectEditAccess } from "@/lib/project-access";
import { getCategoryValues } from "@/lib/master-data-db";
import { PROJECT_CATEGORIES } from "@/lib/master-data";
import { normalizeProjectImportRows, type RawProjectRow } from "@/lib/project-import";

export type ProjectFormData = {
  name: string;
  code: string;
  category: string;
  section: string;
  active: boolean;
  description: string;
  // True when this project is tracked as multiple sub-projects; drives the
  // per-sub-project group editor on the Weekly Report create/edit form.
  hasSubProjects: boolean;
  // PIC PM: ids of the members leading this project (a project can have several).
  picPmIds: string[];
  // Plan dates and budgeted effort (man-months); startDate/endDate are "" or "YYYY-MM-DD".
  startDate: string;
  endDate: string;
  budgetedEffortMM: string;
  // Source-code hosting: "" | "github" | "gitlab" and the repo URL.
  repoProvider: string;
  repoUrl: string;
  // Project management tool: "" | "redmine" | "backlog" and the project URL.
  pmTool: string;
  pmUrl: string;
  // Sensitive access token for AI MCP health checks. On update, an empty value
  // means "keep the existing key" — it is never sent back to the client.
  accessKey: string;
  allocations: AllocationInput[];
};

async function requireProjectManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "project:manage")) {
    throw new Error("Forbidden");
  }
}

/** Allow only http(s) links; reject other schemes (javascript:, data:, …). */
function cleanUrl(raw: string, label: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Validation: ${label} must start with http:// or https://`);
  }
  return url;
}

/** Parse "YYYY-MM-DD" plan dates and validate start < end. */
function parsePlanDates(startRaw: string, endRaw: string): { startDate: Date | null; endDate: Date | null } {
  const startDate = startRaw.trim() ? new Date(startRaw) : null;
  const endDate = endRaw.trim() ? new Date(endRaw) : null;
  if (startDate && Number.isNaN(startDate.getTime())) throw new Error("Validation: Start date is invalid");
  if (endDate && Number.isNaN(endDate.getTime())) throw new Error("Validation: End date is invalid");
  if (startDate && endDate && startDate.getTime() >= endDate.getTime()) {
    throw new Error("Validation: Start date must be before End date");
  }
  return { startDate, endDate };
}

function parseBudgetedEffort(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error("Validation: Budgeted Effort (MM) is invalid");
  return n;
}

function clean(form: ProjectFormData) {
  const name = form.name.trim();
  const code = form.code.trim();
  const category = form.category.trim();
  const section = form.section.trim();
  if (!name || !category || !section) {
    throw new Error("Validation: name, category and section are required");
  }
  const { startDate, endDate } = parsePlanDates(form.startDate, form.endDate);
  return {
    name,
    code: code || null,
    category,
    section,
    active: form.active,
    hasSubProjects: form.hasSubProjects,
    description: form.description.trim() || null,
    startDate,
    endDate,
    budgetedEffortMM: parseBudgetedEffort(form.budgetedEffortMM),
    repoProvider: form.repoProvider.trim() || null,
    repoUrl: cleanUrl(form.repoUrl, "Repository URL"),
    pmTool: form.pmTool.trim() || null,
    pmUrl: cleanUrl(form.pmUrl, "Project management URL"),
  };
}

function picPmIds(form: ProjectFormData): { id: string }[] {
  return [...new Set(form.picPmIds.map((id) => id.trim()).filter(Boolean))].map((id) => ({ id }));
}

export async function createProject(form: ProjectFormData) {
  await requireProjectManager();
  const accessKey = form.accessKey.trim();
  await db.project.create({
    data: {
      ...clean(form),
      accessKey: accessKey || null,
      picPms: { connect: picPmIds(form) },
      allocations: { create: normalizeAllocations(form.allocations ?? []) },
    },
  });
  revalidatePath("/projects");
}

export async function updateProject(id: string, form: ProjectFormData) {
  await requireProjectEditAccess(id);
  const accessKey = form.accessKey.trim();
  await db.project.update({
    where: { id },
    // Only overwrite the access key when a new value was entered.
    data: {
      ...clean(form),
      ...(accessKey ? { accessKey } : {}),
      picPms: { set: picPmIds(form) },
      allocations: { deleteMany: {}, create: normalizeAllocations(form.allocations ?? []) },
    },
  });
  revalidatePath("/projects");
  revalidatePath("/meetings/new");
}

export async function deleteProject(id: string) {
  await requireProjectManager();
  await db.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/meetings/new");
}

export type IntegrationFormData = { repoProvider: string; repoUrl: string; pmTool: string; pmUrl: string; accessKey: string };

export async function updateProjectIntegration(projectId: string, form: IntegrationFormData) {
  await requireProjectEditAccess(projectId);
  const accessKey = form.accessKey.trim();
  await db.project.update({
    where: { id: projectId },
    data: {
      repoProvider: form.repoProvider.trim() || null,
      repoUrl: cleanUrl(form.repoUrl, "Repository URL"),
      pmTool: form.pmTool.trim() || null,
      pmUrl: cleanUrl(form.pmUrl, "Project management URL"),
      ...(accessKey ? { accessKey } : {}),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export type ProjectImportResult = { created: number; updated: number; skipped: number; errors: string[] };

/**
 * Import projects from an .xlsx export (Name, Project Code, Department, Start
 * Date, End Date, Project Manager/Display Name, Status, Budgeted Effort (MM)).
 * Existing projects (matched by code, else by name+section) are updated in
 * place — never duplicated. New projects fall back to the first configured
 * PROJECT category since the sheet has no category column.
 */
export async function importProjects(formData: FormData): Promise<ProjectImportResult> {
  await requireProjectManager();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: chưa chọn file");

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet) as RawProjectRow[];
  const { rows, errors } = normalizeProjectImportRows(rawRows);
  const skipped = rawRows.length - rows.length;

  const defaultCategories = await getCategoryValues("PROJECT");
  const defaultCategory = defaultCategories[0] ?? PROJECT_CATEGORIES[0];

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    try {
      let picPmId: string | null = null;
      if (r.picPmEmail) {
        picPmId = (await db.user.findUnique({ where: { email: r.picPmEmail }, select: { id: true } }))?.id ?? null;
      }
      if (!picPmId && r.picPmName) {
        picPmId = (await db.user.findFirst({ where: { name: r.picPmName }, select: { id: true } }))?.id ?? null;
      }
      if (!picPmId && (r.picPmEmail || r.picPmName)) {
        errors.push(`Không tìm thấy user cho PIC PM "${r.picPmName ?? r.picPmEmail}" (dự án ${r.name})`);
      }

      const existing = r.code
        ? await db.project.findUnique({ where: { code: r.code }, select: { id: true } })
        : await db.project.findFirst({ where: { name: r.name, section: r.section }, select: { id: true } });

      const baseData = {
        name: r.name,
        code: r.code,
        section: r.section || "N/A",
        active: r.active,
        startDate: r.startDate,
        endDate: r.endDate,
        budgetedEffortMM: r.budgetedEffortMM,
      };
      const picPmConnection = picPmId ? [{ id: picPmId }] : [];

      if (existing) {
        // The sheet only encodes one PM per row — replace the PIC PM list with just this one.
        await db.project.update({ where: { id: existing.id }, data: { ...baseData, picPms: { set: picPmConnection } } });
        updated++;
      } else {
        await db.project.create({ data: { ...baseData, category: defaultCategory, picPms: { connect: picPmConnection } } });
        created++;
      }
    } catch (e) {
      errors.push(`Lỗi với dự án "${r.name}": ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  revalidatePath("/projects");
  revalidatePath("/meetings/new");
  return { created, updated, skipped, errors };
}
