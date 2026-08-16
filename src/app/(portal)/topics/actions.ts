"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, isManager } from "@/lib/permissions";
import { canDeleteTopic } from "@/lib/community";
import { parseTags } from "@/lib/knowledge";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TopicFormData } from "@/types/community";
import type { Role } from "@/types";

async function requireUser(): Promise<{ id: string; role: Role }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "topic:create")) throw new Error("Forbidden");
  return { id: session.user.id, role: session.user.role };
}

export async function createTopic(form: TopicFormData) {
  const user = await requireUser();
  if (!form.title?.trim() || !form.content?.trim() || !form.category?.trim()) {
    throw new Error("Validation: title, content and category are required");
  }
  const created = await db.topic.create({
    data: {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category.trim(),
      project: form.project?.trim() || null,
      authorId: user.id,
      tags: { connectOrCreate: parseTags(form.tags).map((name) => ({ where: { name }, create: { name } })) },
    },
  });
  revalidatePath("/topics");
  redirect(`/topics/${created.id}`);
}

export async function addComment(topicId: string, formData: FormData) {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Validation: empty comment");
  await db.comment.create({ data: { topicId, authorId: user.id, content } });
  revalidatePath("/topics");
  revalidatePath(`/topics/${topicId}`);
}

export async function likeTopic(id: string) {
  await requireUser();
  await db.topic.update({ where: { id }, data: { likes: { increment: 1 } } });
  revalidatePath("/topics");
  revalidatePath(`/topics/${id}`);
}

export async function pinTopic(id: string, pinned: boolean) {
  const session = await auth();
  if (!session?.user || !isManager(session.user.role)) throw new Error("Forbidden");
  await db.topic.update({ where: { id }, data: { pinned } });
  revalidatePath("/topics");
  revalidatePath(`/topics/${id}`);
}

export async function deleteTopic(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");
  const topic = await db.topic.findUnique({ where: { id } });
  if (!topic) throw new Error("Not found");
  if (!canDeleteTopic(session.user.role, topic.authorId, session.user.id)) throw new Error("Forbidden");
  await db.$transaction([
    db.bookmark.deleteMany({ where: { targetType: "topic", targetId: id } }),
    db.topic.delete({ where: { id } }),
  ]); // comments cascade
  revalidatePath("/topics");
  redirect("/topics");
}
