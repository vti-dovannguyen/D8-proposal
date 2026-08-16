"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { parseTags } from "@/lib/knowledge";
import { uploadDocumentFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/types";

async function requireContentEditor(): Promise<{ id: string; role: Role }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "content:edit")) {
    throw new Error("Forbidden");
  }
  return { id: session.user.id, role: session.user.role };
}

function safePath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `documents/${Date.now()}_${safe}`;
}

export async function createDocument(formData: FormData) {
  const user = await requireContentEditor();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const project = String(formData.get("project") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");
  const file = formData.get("file");
  if (!title || !category) throw new Error("Validation: title and category are required");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: no file");

  const path = safePath(file.name);
  const { mimeType } = await uploadDocumentFile(path, file);
  const tags = parseTags(tagsRaw);
  const created = await db.document.create({
    data: {
      title,
      category,
      project: project || null,
      fileUrl: path, // store the object path; sign on read
      fileSize: file.size,
      mimeType,
      version: 1,
      authorId: user.id,
      tags: { connectOrCreate: tags.map((name) => ({ where: { name }, create: { name } })) },
    },
  });
  revalidatePath("/knowledge/documents");
  redirect(`/knowledge/documents/${created.id}`);
}

export async function uploadNewVersion(id: string, formData: FormData) {
  await requireContentEditor();
  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: no file");

  const path = safePath(file.name);
  const { mimeType } = await uploadDocumentFile(path, file);
  await db.document.update({
    where: { id },
    data: { fileUrl: path, fileSize: file.size, mimeType, version: { increment: 1 } },
  });
  revalidatePath("/knowledge/documents");
  revalidatePath(`/knowledge/documents/${id}`);
  redirect(`/knowledge/documents/${id}`);
}

export async function deleteDocument(id: string) {
  await requireContentEditor();
  await db.document.delete({ where: { id } });
  revalidatePath("/knowledge/documents");
  redirect("/knowledge/documents");
}
