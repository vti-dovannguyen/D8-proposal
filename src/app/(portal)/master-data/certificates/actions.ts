"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export type CertTypeFormData = { name: string; issuer: string; category: string; active: boolean };

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

function clean(form: CertTypeFormData) {
  const name = form.name.trim();
  if (!name) throw new Error("Validation: name is required");
  return { name, issuer: form.issuer.trim() || null, category: form.category.trim() || null, active: form.active };
}

export async function createCertType(form: CertTypeFormData) {
  await requireManager();
  await db.certificateType.create({ data: clean(form) });
  revalidatePath("/master-data/certificates");
}

export async function updateCertType(id: string, form: CertTypeFormData) {
  await requireManager();
  await db.certificateType.update({ where: { id }, data: clean(form) });
  revalidatePath("/master-data/certificates");
}

export async function deleteCertType(id: string) {
  await requireManager();
  await db.certificateType.delete({ where: { id } });
  revalidatePath("/master-data/certificates");
}
