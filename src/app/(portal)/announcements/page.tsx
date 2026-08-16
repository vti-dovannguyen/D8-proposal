import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
import { ReloadButton } from "@/components/ui/reload-button";
import type { AnnouncementFormData } from "@/types/community";
import { createAnnouncement } from "./actions";
import { AnnouncementForm } from "./announcement-form";
import { DeleteAnnouncementButton } from "./delete-announcement-button";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const editable = can(session!.user.role, "announcement:manage");
  // Managers see all (ON + OFF); everyone else sees ON only.
  const where = editable ? {} : activeAnnouncementWhere();
  const [items, total] = await Promise.all([
    db.announcement.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { author: true }, ...paginationArgs(page) }),
    db.announcement.count({ where }),
  ]);

  async function create(data: AnnouncementFormData) {
    "use server";
    await createAnnouncement(data);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Thông báo</h1>
          <p className="portal-page-subtitle">Các cập nhật đang hiệu lực, ưu tiên thông báo được ghim.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{total} thông báo</span>
          <ReloadButton />
        </div>
      </div>

      {editable && <AnnouncementForm initial={{ title: "", body: "", pinned: false, active: true }} submitLabel="Đăng thông báo" onSubmit={create} />}

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th>Tiêu đề</th><th>Nội dung</th><th>Tác giả</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {item.pinned && <span className="portal-pill bg-amber-100 text-amber-700">Ghim</span>}
                    <span className="font-semibold text-slate-950">{item.title}</span>
                  </div>
                </td>
                <td className="max-w-xl portal-table-muted line-clamp-2">{htmlToText(item.body)}</td>
                <td>{item.author.name}</td>
                <td>
                  {item.active
                    ? <span className="portal-pill bg-emerald-100 text-emerald-700">ON</span>
                    : <span className="portal-pill bg-slate-200 text-slate-600">OFF</span>}
                </td>
                <td className="text-right">
                  {editable && (
                    <div className="flex justify-end gap-3 text-sm">
                      <Link href={`/announcements/${item.id}/edit`} className="text-[var(--vti-deep,#0A3CA8)]">Sửa</Link>
                      <DeleteAnnouncementButton id={item.id} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có thông báo</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/announcements" params={sp} page={page} total={total} />
    </div>
  );
}
