"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export type SkillFormData = { name: string; category: string; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: SkillFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: name is required");
  return { name, category: form.category.trim() || null, active: form.active };
}

export async function createSkill(form: SkillFormData) {
  await requireManager();
  await db.skill.create({ data: clean(form) });
  revalidatePath("/master-data/skills");
}

export async function updateSkill(id: string, form: SkillFormData) {
  await requireManager();
  await db.skill.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/skills");
}

export async function deleteSkill(id: string) {
  await requireManager();
  await db.skill.delete({ where: { id } });
  revalidatePath("/master-data/skills");
}
