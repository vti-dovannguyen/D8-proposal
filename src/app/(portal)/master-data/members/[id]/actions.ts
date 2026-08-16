"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { uploadAttachmentFile, removeFromBucket } from "@/lib/storage";
import { EMPLOYEE_TYPES, type EmployeeType } from "@/types";

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
}

export async function setEmployeeType(userId: string, employeeType: EmployeeType) {
  await requireManager();
  if (!EMPLOYEE_TYPES.includes(employeeType)) throw new Error("Validation: bad employee type");
  await db.user.update({ where: { id: userId }, data: { employeeType } });
  revalidatePath(`/master-data/members/${userId}`);
  revalidatePath("/master-data/members");
}

function clampLevel(level: number) {
  if (!Number.isFinite(level)) return 1;
  return Math.min(5, Math.max(1, Math.round(level)));
}

export async function setUserSkill(userId: string, skillId: string, level: number) {
  await requireManager();
  const lvl = clampLevel(level);
  await db.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, level: lvl },
    update: { level: lvl },
  });
  revalidatePath(`/master-data/members/${userId}`);
}

export async function removeUserSkill(userSkillId: string, userId: string) {
  await requireManager();
  await db.userSkill.delete({ where: { id: userSkillId } });
  revalidatePath(`/master-data/members/${userId}`);
}

export async function addUserCertificate(userId: string, formData: FormData) {
  await requireManager();
  if (!/^[a-z0-9]{20,}$/i.test(userId)) throw new Error("Validation: bad user id");
  const typeId = String(formData.get("typeId") ?? "").trim();
  if (!typeId) throw new Error("Validation: certificate type is required");

  const toDate = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s ? new Date(s) : null;
  };

  let fileUrl: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `certificates/${userId}/${Date.now()}_${safeName}`;
    await uploadAttachmentFile(path, file);
    fileUrl = path;
  }

  await db.userCertificate.create({
    data: {
      userId,
      typeId,
      issuer: String(formData.get("issuer") ?? "").trim() || null,
      issuedAt: toDate(formData.get("issuedAt")),
      expiresAt: toDate(formData.get("expiresAt")),
      credentialId: String(formData.get("credentialId") ?? "").trim() || null,
      fileUrl,
    },
  });
  revalidatePath(`/master-data/members/${userId}`);
}

export async function deleteUserCertificate(id: string, userId: string) {
  await requireManager();
  const cert = await db.userCertificate.findUnique({ where: { id }, select: { fileUrl: true } });
  await db.userCertificate.delete({ where: { id } });
  if (cert?.fileUrl) {
    // Best-effort cleanup; the record is already gone, so don't fail the action.
    try {
      await removeFromBucket(cert.fileUrl);
    } catch (e) {
      console.error("Failed to remove certificate file:", e);
    }
  }
  revalidatePath(`/master-data/members/${userId}`);
}
