"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MONTH_RE } from "@/lib/monthly-detail";

const HEADCOUNT_FIELDS = ["lbQaOt", "intern", "official"] as const;
export type HeadcountField = (typeof HEADCOUNT_FIELDS)[number];

export async function setUnitHeadcount(month: string, field: HeadcountField, value: number) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "project:manage")) throw new Error("Forbidden");
  if (!MONTH_RE.test(month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  if (!HEADCOUNT_FIELDS.includes(field)) throw new Error("Validation: trường không hợp lệ");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Validation: giá trị không hợp lệ");
  const intVal = Math.max(0, Math.round(n));
  await db.unitMonthly.upsert({
    where: { month },
    create: { month, [field]: intVal },
    update: { [field]: intVal },
  });
  revalidatePath("/dashboard");
}
