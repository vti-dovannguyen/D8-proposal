"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CATEGORY_TYPES, type MasterCategoryType } from "@/lib/master-data-db";

export type CategoryFormData = { type: string; value: string; order: number; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: CategoryFormData) {
  if (!CATEGORY_TYPES.includes(form.type as MasterCategoryType)) throw new Error("Validation: unknown category type");
  const value = form.value.trim();
  if (!value) throw new Error("Validation: value is required");
  return { type: form.type, value, order: Number.isFinite(form.order) ? form.order : 0, active: form.active };
}

export async function createCategory(form: CategoryFormData) {
  await requireManager();
  await db.masterCategory.create({ data: clean(form) });
  revalidatePath("/master-data/categories");
}

export async function updateCategory(id: string, form: CategoryFormData) {
  await requireManager();
  await db.masterCategory.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/categories");
}

export async function deleteCategory(id: string) {
  await requireManager();
  await db.masterCategory.delete({ where: { id } });
  revalidatePath("/master-data/categories");
}
