"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { ROLES } from "@/types";
import type { Role } from "@/types";
import * as XLSX from "xlsx";
import { normalizeUserImportRows, type RawUserRow } from "@/lib/user-import";
import { hashPassword, DEFAULT_PASSWORD } from "@/lib/password";

export async function updateUserRole(userId: string, role: Role) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) {
    throw new Error("Forbidden");
  }
  if (!(ROLES as readonly string[]).includes(role)) throw new Error("Invalid role");
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}

export async function resetUserPassword(userId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) {
    throw new Error("Forbidden");
  }
  await db.user.update({ where: { id: userId }, data: { password: await hashPassword(DEFAULT_PASSWORD) } });
  revalidatePath("/admin");
}

export async function importUsers(
  formData: FormData,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) throw new Error("Forbidden");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: chưa chọn file");

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet) as RawUserRow[];

  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn";
  const { rows, errors } = normalizeUserImportRows(rawRows, domain);
  const skipped = rawRows.length - rows.length;
  const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    try {
      const existing = await db.user.findUnique({ where: { email: r.email }, select: { id: true } });
      await db.user.upsert({
        where: { email: r.email },
        create: {
          email: r.email,
          name: r.name,
          dateOfBirth: r.dateOfBirth,
          gender: r.gender,
          role: "MEMBER",
          password: defaultPasswordHash,
        },
        update: { name: r.name, dateOfBirth: r.dateOfBirth, gender: r.gender },
      });
      if (existing) updated++;
      else created++;
    } catch (e) {
      errors.push(`Lỗi với ${r.email}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  revalidatePath("/admin");
  return { created, updated, skipped, errors };
}
