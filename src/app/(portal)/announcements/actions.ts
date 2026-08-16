"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { sanitizeRichTextHtml } from "@/lib/sanitize";
import { htmlToText } from "@/lib/announcements";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AnnouncementFormData } from "@/types/community";

async function requireManager(): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "announcement:manage")) throw new Error("Forbidden");
  return { id: session.user.id };
}

function validate(form: AnnouncementFormData) {
  if (!form.title?.trim()) throw new Error("Validation: title is required");
  if (!htmlToText(form.body)) throw new Error("Validation: body is required");
}

export async function createAnnouncement(form: AnnouncementFormData) {
  const user = await requireManager();
  validate(form);
  await db.announcement.create({
    data: {
      title: form.title.trim(),
      body: sanitizeRichTextHtml(form.body),
      pinned: form.pinned,
      active: form.active,
      authorId: user.id,
    },
  });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}

export async function updateAnnouncement(id: string, form: AnnouncementFormData) {
  await requireManager();
  validate(form);
  await db.announcement.update({
    where: { id },
    data: {
      title: form.title.trim(),
      body: sanitizeRichTextHtml(form.body),
      pinned: form.pinned,
      active: form.active,
    },
  });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}

export async function deleteAnnouncement(id: string) {
  await requireManager();
  await db.announcement.delete({ where: { id } });
  revalidatePath("/announcements");
  revalidatePath("/");
  redirect("/announcements");
}
