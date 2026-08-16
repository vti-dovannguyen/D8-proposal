import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AnnouncementForm } from "../../announcement-form";
import { updateAnnouncement } from "../../actions";
import type { AnnouncementFormData } from "@/types/community";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!can(session!.user.role, "announcement:manage")) redirect("/announcements");

  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) notFound();

  const initial: AnnouncementFormData = {
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    active: a.active,
  };

  async function action(data: AnnouncementFormData) { "use server"; await updateAnnouncement(id, data); }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Sửa thông báo</h1>
      <AnnouncementForm initial={initial} submitLabel="Lưu" onSubmit={action} />
    </div>
  );
}
