"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export type AIAccountFormData = {
  email: string;
  provider: string;
  accountType: string;
  project: string;
  // Single person accountable for this account — distinct from `memberIds`
  // (who merely have access to it).
  assignedToId: string;
  memberIds: string[];
  purchaseDate: string;
  cost: string;
  currency: string;
  subscriptionType: string;
  status: string;
  notes: string;
};

async function requireManager() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "ai-account:manage")) {
    throw new Error("Forbidden");
  }
}

function clean(form: AIAccountFormData) {
  const email = form.email.trim().toLowerCase();
  const provider = form.provider.trim();
  const accountType = form.accountType.trim();
  const subscriptionType = form.subscriptionType.trim();
  if (!email || !provider || !accountType || !subscriptionType) {
    throw new Error("Validation: email, provider, account type and subscription type are required");
  }
  const cost = form.cost.trim() ? Number(form.cost) : null;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    throw new Error("Validation: cost must be a positive number");
  }
  const memberIds = form.memberIds.filter(Boolean).map((id) => ({ id }));
  return {
    email,
    provider,
    accountType,
    project: form.project.trim() || null,
    assignedToId: form.assignedToId.trim() || null,
    purchaseDate: form.purchaseDate ? new Date(form.purchaseDate) : null,
    cost,
    currency: form.currency.trim() || "USD",
    subscriptionType,
    status: form.status.trim() || "ACTIVE",
    notes: form.notes.trim() || null,
    memberIds,
  };
}

/**
 * The same email may be issued to several projects, but not twice for the
 * SAME project (including "no project" — `project: null`).
 */
async function assertNoDuplicateForProject(email: string, project: string | null, excludeId?: string) {
  const existing = await db.aIAccount.findFirst({
    where: { email, project, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      project
        ? `Validation: email "${email}" đã được cấp cho dự án "${project}" rồi`
        : `Validation: email "${email}" đã có một account không gắn dự án rồi`,
    );
  }
}

export async function createAIAccount(form: AIAccountFormData) {
  await requireManager();
  const data = clean(form);
  await assertNoDuplicateForProject(data.email, data.project);
  const { memberIds, ...accountData } = data;
  await db.aIAccount.create({
    data: {
      ...accountData,
      members: { connect: memberIds },
    },
  });
  revalidatePath("/ai-accounts");
}

export async function updateAIAccount(id: string, form: AIAccountFormData) {
  await requireManager();
  const data = clean(form);
  await assertNoDuplicateForProject(data.email, data.project, id);
  const { memberIds, ...accountData } = data;
  await db.aIAccount.update({
    where: { id },
    data: {
      ...accountData,
      members: { set: memberIds },
    },
  });
  revalidatePath("/ai-accounts");
}

export async function deleteAIAccount(id: string) {
  await requireManager();
  await db.aIAccount.delete({ where: { id } });
  revalidatePath("/ai-accounts");
}
