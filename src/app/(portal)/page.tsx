import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  MessageSquare,
  Pin,
  TrendingUp,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";
import { fileTypeMeta, type FileTypeKey } from "@/lib/file-types";
import {
  parseWeekRange,
  isWithinWeek,
  parseDeadlineEnv,
  weeklyDeadline,
  isPastDeadline,
  missingReportProjectNames,
} from "@/lib/weekly-report";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const FILE_ICONS: Record<FileTypeKey, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  ppt: FileText,
  md: FileText,
  txt: FileText,
  csv: FileText,
  xls: FileSpreadsheet,
  zip: FileArchive,
  image: FileImage,
  file: File,
};

function SectionHeader({ icon, title, href }: { icon: React.ReactNode; title: string; href?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between border-b border-[#dbe3ef] px-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
        <span className="text-[#0b72ff]">{icon}</span>
        {title}
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b72ff] hover:text-[#003c9e]">
          Xem tất cả
          <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const session = await auth();
  const name = session!.user.name ?? "User";
  const isManager = can(session!.user.role, "dashboard:view");

  const [
    openMeetings,
    docs,
    wikiPages,
    agents,
    officialUsers,
    internUsers,
    openProjects,
    closeProjects,
    announcements,
    recentDocs,
    topics,
    recentMeetings,
    topAgents,
  ] = await Promise.all([
    db.meeting.count({ where: { status: { not: "CLOSED" } } }),
    db.document.count(),
    db.wikiPage.count(),
    db.aIAgent.count(),
    db.user.count({ where: { employeeType: "OFFICIAL" } }),
    db.user.count({ where: { employeeType: "INTERN" } }),
    db.project.count({ where: { active: true } }),
    db.project.count({ where: { active: false } }),
    db.announcement.findMany({
      where: activeAnnouncementWhere(),
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
      include: { author: true },
    }),
    db.document.findMany({ orderBy: { updatedAt: "desc" }, take: 4, include: { author: true } }),
    db.topic.findMany({ orderBy: { updatedAt: "desc" }, take: 3, include: { author: true, _count: { select: { comments: true } } } }),
    db.meeting.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { owner: true } }),
    db.aIAgent.findMany({ orderBy: [{ rating: "desc" }, { createdAt: "desc" }], take: 3 }),
  ]);

  const totalUsers = officialUsers + internUsers;
  const totalProjects = openProjects + closeProjects;
  const featuredAnnouncement = announcements[0];

  // Manager-only Warning data
  let missingProjects: { id: string; name: string; pm: string }[] = [];
  let unallocated: { id: string; name: string; section: string | null; title: string | null }[] = [];
  let showMissing = false;
  if (isManager) {
    const today = new Date();
    const deadline = weeklyDeadline(today, parseDeadlineEnv(process.env.WEEKLY_REPORT_DEADLINE));
    showMissing = isPastDeadline(today, deadline);

    const [weekMeetings, activeProjects, unallocatedUsers] = await Promise.all([
      db.meeting.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { weekRange: true, eeRows: { select: { project: true } } } }),
      db.project.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, allocations: { where: { role: "PM", active: true }, select: { user: { select: { name: true } } } } },
      }),
      db.user.findMany({
        where: { role: { notIn: ["ADMIN", "DIVISION_LEADER"] }, allocations: { none: { active: true } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, section: true, title: true },
      }),
    ]);

    const reported = new Set<string>();
    for (const m of weekMeetings) {
      const range = parseWeekRange(m.weekRange);
      if (range && isWithinWeek(range, today)) {
        for (const ee of m.eeRows) reported.add(ee.project.trim().toLowerCase());
      }
    }
    const missingNames = new Set(missingReportProjectNames(activeProjects.map((p) => p.name), reported));
    missingProjects = activeProjects
      .filter((p) => missingNames.has(p.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        pm: p.allocations.map((a) => a.user?.name).filter(Boolean).join(", ") || "Chưa có PM",
      }));
    unallocated = unallocatedUsers;
  }

  const upcoming = [
    { day: "13", month: "06", title: "Release Rakuten EC v2.4", type: "Release" },
    { day: "15", month: "06", title: "Go-live PM Sharing Portal", type: "Sự kiện" },
    { day: "18", month: "06", title: "Khách Panasonic thăm office", type: "Khách hàng" },
    { day: "20", month: "06", title: "Deadline báo cáo Q2 các PM", type: "Deadline" },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#112b86_0%,#0f4ed0_55%,#2684ff_100%)] p-7 text-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-100">Thứ sáu, 12/06/2026 · Tuần 24</p>
            <h1 className="mt-3 text-3xl font-black leading-tight">Chào {name.split(" ").slice(-1)[0]}, đây là bản tin Division 8</h1>
            <p className="mt-2 text-sm text-blue-100">
              {openMeetings} meeting đang theo dõi · {recentDocs.length} tài liệu mới tuần này · {topics.length} topic bạn theo dõi có trả lời mới.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/12 p-5 shadow-inner">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-blue-100">
              <Bell size={15} />
              Thông báo ghim
            </div>
            <p className="font-bold">{featuredAnnouncement?.title ?? "Triển khai PM Sharing Portal - go-live nội bộ 15/06"}</p>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              {featuredAnnouncement ? htmlToText(featuredAnnouncement.body) : "Toàn bộ PM bắt đầu cập nhật Weekly Report trên Portal từ tuần 25. Dữ liệu Excel cũ sẽ được migrate xong trước 14/06."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Weekly Report", sub: "Tuần 24 đang mở", icon: CalendarDays, href: "/meetings" },
          { label: "Documents", sub: `${docs} tài liệu`, icon: FileText, href: "/knowledge/documents" },
          { label: "Wiki", sub: `${wikiPages} trang`, icon: BookOpen, href: "/knowledge/wiki" },
          { label: "AI Agents", sub: `${agents} agent`, icon: Bot, href: "/agents" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="flex items-center gap-4 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-xl bg-[#e8f2ff] text-[#0b72ff]">
                <Icon size={21} />
              </span>
              <span>
                <span className="block font-bold text-slate-950">{card.label}</span>
                <span className="text-sm text-slate-500">{card.sub}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<TrendingUp size={16} />} title="Thống kê D8" />
            <div className="grid divide-y divide-[#dbe3ef] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <div className="text-3xl font-black text-[#001845]">{totalUsers}</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">Tổng số nhân viên</div>
                <div className="mt-0.5 text-sm text-slate-500">{officialUsers} Chính thức · {internUsers} Intern</div>
              </div>
              <div className="p-5">
                <div className="text-3xl font-black text-[#001845]">{totalProjects}</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">Tổng số dự án</div>
                <div className="mt-0.5 text-sm text-slate-500">{openProjects} Open · {closeProjects} Close</div>
              </div>
            </div>
          </section>

          {isManager && (
            <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
              <SectionHeader icon={<AlertTriangle size={16} />} title="Warning" />
              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-[#dbe3ef]">
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <FolderKanban size={15} className="text-amber-600" />
                    Dự án chưa có báo cáo tuần
                  </div>
                  <div className="space-y-2">
                    {showMissing && missingProjects.map((p) => (
                      <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                        <p className="font-semibold text-slate-950">{p.name}</p>
                        <p className="text-slate-600">PM: {p.pm}</p>
                        <p className="font-medium text-amber-700">Cập nhật report ngay</p>
                      </div>
                    ))}
                    {showMissing && missingProjects.length === 0 && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Tất cả dự án đã có báo cáo tuần</p>
                    )}
                    {!showMissing && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Chưa đến hạn báo cáo tuần</p>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Users size={15} className="text-amber-600" />
                    Nhân viên chưa được phân bổ dự án
                  </div>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {unallocated.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(u.name)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-950">{u.name}</span>
                          {(u.title || u.section) && (
                            <span className="block truncate text-slate-500">{[u.title, u.section].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {unallocated.length === 0 && (
                      <p className="px-1 py-6 text-center text-sm text-slate-400">Tất cả nhân viên đã được phân bổ</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<Bell size={16} />} title="Thông báo" />
            <div className="divide-y divide-[#dbe3ef]">
              {announcements.map((item) => (
                <div key={item.id} className="flex gap-4 px-4 py-4">
                  <div className="w-20 shrink-0">
                    {item.pinned ? (
                      <span className="portal-pill bg-[#0f46c8] text-white">
                        <Pin size={12} />
                        Ghim
                      </span>
                    ) : (
                      <span className="portal-pill bg-slate-100 text-slate-500">{formatDate(item.createdAt)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{htmlToText(item.body)}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.author.name} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<FileText size={16} />} title="Tài liệu cập nhật gần đây" href="/knowledge/documents" />
            <div className="divide-y divide-[#dbe3ef]">
              {recentDocs.map((doc) => {
                const meta = fileTypeMeta(doc.title);
                const Icon = FILE_ICONS[meta.key];
                return (
                  <Link key={doc.id} href={`/knowledge/documents/${doc.id}`} className="grid gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 sm:grid-cols-[48px_1fr_160px_100px] sm:items-center">
                    <span className={`grid size-9 place-items-center rounded-lg ${meta.tone}`} title={meta.label}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-950">{doc.title}</span>
                      <span className="text-slate-500">{doc.category}</span>
                    </span>
                    <span className="text-slate-600">{doc.author.name}</span>
                    <span className="text-right text-slate-500">{formatDate(doc.updatedAt)}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<MessageSquare size={16} />} title="Topic thảo luận sôi nổi" href="/topics" />
            <div className="divide-y divide-[#dbe3ef]">
              {topics.map((topic) => (
                <Link key={topic.id} href={`/topics/${topic.id}`} className="flex items-center gap-4 px-4 py-4 transition hover:bg-slate-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0f46c8] text-xs font-bold text-white">{initials(topic.author.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-950">{topic.title}</span>
                    <span className="text-sm text-slate-500">
                      {topic.author.name} · {formatDate(topic.updatedAt)}
                    </span>
                  </span>
                  <span className="portal-pill bg-slate-100 text-slate-500">
                    <MessageSquare size={13} />
                    {topic._count.comments}
                  </span>
                  <span className="portal-pill bg-slate-100 text-slate-500">👍 {topic.likes}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<CalendarDays size={16} />} title="Sự kiện sắp tới" />
            <div className="space-y-3 p-4">
              {upcoming.map((event) => (
                <div key={event.title} className="flex gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-50 text-center text-xs font-bold text-[#0f46c8]">
                    <span>
                      {event.day}
                      <br />
                      <span className="font-medium text-slate-400">{event.month}</span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-950">{event.title}</p>
                    <p className="text-xs text-slate-500">{event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<Bot size={16} />} title="AI Agent mới" href="/agents" />
            <div className="divide-y divide-[#dbe3ef]">
              {topAgents.map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                  <span className="grid size-10 place-items-center rounded-lg bg-[#1764d8] text-white">
                    <Bot size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-950">{agent.name}</span>
                    <span className="text-xs text-amber-500">★★★★★</span>
                    <span className="ml-1 text-xs text-slate-500">
                      {agent.rating.toFixed(1)} ({agent.ratingCount})
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
            <SectionHeader icon={<TrendingUp size={16} />} title="Hoạt động gần đây" />
            <div className="space-y-4 p-4">
              {recentMeetings.map((meeting) => (
                <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block text-sm">
                  <span className="font-semibold text-slate-900">{meeting.owner.name}</span>
                  <span className="text-slate-500"> cập nhật </span>
                  <span className="font-semibold text-[#0b72ff]">Weekly Report - {meeting.week}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{formatDate(meeting.updatedAt)}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
