"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, isManager } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AgentFormData } from "@/types/community";

export async function createAgent(form: AgentFormData) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "content:edit")) throw new Error("Forbidden");
  if (!form.name?.trim() || !form.description?.trim() || !form.useCase?.trim() || !form.prompt?.trim() || !form.category?.trim()) {
    throw new Error("Validation: all agent fields are required");
  }
  const created = await db.aIAgent.create({
    data: {
      name: form.name.trim(),
      description: form.description.trim(),
      useCase: form.useCase.trim(),
      prompt: form.prompt.trim(),
      category: form.category.trim(),
      ownerId: session.user.id,
    },
  });
  revalidatePath("/agents");
  revalidatePath(`/agents/${created.id}`);
  return { id: created.id };
}

export async function deleteAgent(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");
  const agent = await db.aIAgent.findUnique({ where: { id } });
  if (!agent) throw new Error("Not found");
  if (agent.ownerId !== session.user.id && !isManager(session.user.role)) throw new Error("Forbidden");
  await db.$transaction([
    db.bookmark.deleteMany({ where: { targetType: "agent", targetId: id } }),
    db.aIAgent.delete({ where: { id } }),
  ]);
  revalidatePath("/agents");
  redirect("/agents");
}
