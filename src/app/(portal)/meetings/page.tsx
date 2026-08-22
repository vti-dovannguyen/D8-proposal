import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { ReloadButton } from "@/components/ui/reload-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { canManagePmMeeting } from "@/lib/projects";
import { formatDateOnlyRange } from "@/lib/meetings";
import { MEETING_WEEK_OPTIONS, getCurrentWeekOption } from "@/lib/meeting-week-options";
import { MeetingsFilter } from "./meetings-filter";
import { CloneMeetingButton } from "./clone-meeting-button";
import type { MeetingStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; status?: string; projectId?: string; week?: string; page?: string }>;
}) {
  const session = await auth();
  const { role, id: userId } = session!.user;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const defaultWeek = getCurrentWeekOption()?.week;
  const selectedWeek = sp.week ?? defaultWeek ?? "";
  const where: {
    section?: string;
    status?: MeetingStatus;
    projectId?: string;
    week?: string;
  } = {};
  if (sp.section) where.section = sp.section;
  if (sp.status) where.status = sp.status as MeetingStatus;
  if (sp.projectId) where.projectId = sp.projectId;
  if (selectedWeek) where.week = selectedWeek;
  // Every role sees every Weekly Report (view-only for a PM on projects they aren't PIC of);
  // per-row edit affordances below are still restricted to PIC PM / non-PM editors.

  const [meetings, total, projects] = await Promise.all([
    db.meeting.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { owner: true, project: { include: { picPms: { select: { id: true } } } } },
      ...paginationArgs(page),
    }),
    db.meeting.count({ where }),
    db.project.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const editable = can(role, "meeting:edit");
  const canEditRow = (m: (typeof meetings)[number]) =>
    editable && (role !== "PM" || canManagePmMeeting(userId, m.projectId, m.ownerId, m.project?.picPms ?? []));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Weekly Report</h1>
          <p className="portal-page-subtitle">Báo cáo tuần của các section trong Division 8. PM cập nhật trước 17:00 thứ 5, chốt trước 12:00 thứ 6.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <ReloadButton />
          {editable && (
            <Link href="/meetings/new" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Tạo Report mới</Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <MeetingsFilter projects={projects} weeks={MEETING_WEEK_OPTIONS} selectedWeek={selectedWeek} />
        <span className="text-sm text-slate-500">{total} meeting</span>
      </div>

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Tuần</th>
              <th>Khoảng thời gian</th>
              <th>Section</th>
              <th>Dự án</th>
              <th>Category</th>
              <th>PM phụ trách</th>
              <th>Trạng thái</th>
              <th>Cập nhật lần cuối</th>
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/meetings/${m.id}`} className="portal-table-title">{m.week}</Link></td>
                <td>{formatDateOnlyRange(m.weekStart, m.weekEnd, m.weekRange)}</td>
                <td><span className="portal-pill bg-slate-100 text-slate-600">{m.section}</span></td>
                <td className="portal-table-muted">{m.project?.name ?? "—"}</td>
                <td className="portal-table-muted">{m.category}</td>
                <td>{m.owner.name}</td>
                <td><span className={"portal-pill " + (STATUS_BADGE[m.status] ?? "")}>{m.status}</span></td>
                <td className="portal-table-muted">{m.updatedAt.toLocaleString("vi-VN")}</td>
                {editable && <td>{canEditRow(m) && <CloneMeetingButton id={m.id} />}</td>}
              </tr>
            ))}
            {meetings.length === 0 && (<tr><td colSpan={editable ? 9 : 8} className="px-4 py-8 text-center text-slate-400">Chưa có meeting nào</td></tr>)}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/meetings" params={sp} page={page} total={total} />
    </div>
  );
}
