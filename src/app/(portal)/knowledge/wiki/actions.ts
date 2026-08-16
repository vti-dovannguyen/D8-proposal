"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { parseTags } from "@/lib/knowledge";
import { sanitizeWikiHtml } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WikiFormData } from "@/types/knowledge";
import type { Role } from "@/types";

async function requireContentEditor(): Promise<{ id: string; role: Role }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "content:edit")) {
    throw new Error("Forbidden");
  }
  return { id: session.user.id, role: session.user.role };
}

function validate(form: WikiFormData) {
  const textContent = (form.content ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!form.title?.trim() || !form.category?.trim() || !textContent) {
    throw new Error("Validation: title, content and category are required");
  }
}

function tagConnect(tagsRaw: string) {
  return parseTags(tagsRaw).map((name) => ({ where: { name }, create: { name } }));
}

export async function createWiki(form: WikiFormData) {
  const user = await requireContentEditor();
  validate(form);
  const content = sanitizeWikiHtml(form.content ?? "");
  const created = await db.wikiPage.create({
    data: {
      title: form.title.trim(),
      category: form.category.trim(),
      project: form.project?.trim() || null,
      content,
      authorId: user.id,
      tags: { connectOrCreate: tagConnect(form.tags) },
      versions: { create: { content, version: 1 } },
    },
  });
  revalidatePath("/knowledge/wiki");
  redirect(`/knowledge/wiki/${created.id}`);
}

export async function updateWiki(id: string, form: WikiFormData) {
  await requireContentEditor();
  validate(form);
  const existing = await db.wikiPage.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  const content = sanitizeWikiHtml(form.content ?? "");
  const versionCount = await db.wikiVersion.count({ where: { wikiPageId: id } });
  await db.wikiPage.update({
    where: { id },
    data: {
      title: form.title.trim(),
      category: form.category.trim(),
      project: form.project?.trim() || null,
      content,
      tags: { set: [], connectOrCreate: tagConnect(form.tags) },
      versions: { create: { content, version: versionCount + 1 } },
    },
  });
  revalidatePath("/knowledge/wiki");
  revalidatePath(`/knowledge/wiki/${id}`);
  redirect(`/knowledge/wiki/${id}`);
}

export async function deleteWiki(id: string) {
  await requireContentEditor();
  await db.wikiPage.delete({ where: { id } }); // WikiVersion rows cascade-delete
  revalidatePath("/knowledge/wiki");
  redirect("/knowledge/wiki");
}
