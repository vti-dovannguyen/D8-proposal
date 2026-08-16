"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export async function setSkillLevel(userId: string, skillId: string, level: number) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) throw new Error("Forbidden");
  if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error("Validation: level must be an integer 0..5");

  if (level === 0) {
    await db.userSkill.deleteMany({ where: { userId, skillId } });
  } else {
    await db.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, level },
      update: { level },
    });
  }
  revalidatePath("/master-data/skill-matrix");
}
