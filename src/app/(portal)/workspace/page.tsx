import { Bot, CalendarDays, FileText, MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReloadButton } from "@/components/ui/reload-button";

type TabKey = "meetings" | "drafts" | "documents" | "topics" | "bookmarks" | "agents";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "meetings", label: "My Meetings" },
  { key: "drafts", label: "My Drafts" },
  { key: "documents", label: "My Documents" },
  { key: "topics", label: "My Topics" },
  { key: "bookmarks", label: "My Bookmarks" },
  { key: "agents", label: "My AI Agents" },
];

function fmt(date: Date) {
  return date.toLocaleDateString("vi-VN");
}

function Row({
  href,
  icon,
  title,
  meta,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  badge?: string;
}) {
  return (
    <Link href={href} className="flex min-h-[58px] items-center gap-4 rounded-xl border border-[#dbe3ef] bg-white px-5 py-3 shadow-sm transition hover:border-[#bdd0ea] hover:shadow-md">
      <span className="grid size-6 shrink-0 place-items-center text-[#0b72ff]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#001845]">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-slate-500">{meta}</span>
      </span>
      {badge && <span className="portal-pill bg-[#e8f2ff] text-[#0b46c8]">{badge}</span>}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-[#dbe3ef] bg-white px-5 py-8 text-center text-sm text-slate-400">{label}</div>;
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  const userId = session!.user.id;
  const userName = session!.user.name ?? "User";
  const activeTab = tabs.some((tab) => tab.key === sp.tab) ? (sp.tab as TabKey) : "documents";

  const [bookmarks, myTopics, myDocuments, myMeetings, myDrafts, myAgents] = await Promise.all([
    db.bookmark.findMany({ where: { userId }, include: { topic: true, agent: true }, orderBy: { createdAt: "desc" } }),
    db.topic.findMany({ where: { authorId: userId }, orderBy: { updatedAt: "desc" } }),
    db.document.findMany({ where: { authorId: userId }, orderBy: { updatedAt: "desc" } }),
    db.meeting.findMany({ where: { ownerId: userId, status: { not: "DRAFT" } }, orderBy: { updatedAt: "desc" } }),
    db.meeting.findMany({ where: { ownerId: userId, status: "DRAFT" }, orderBy: { updatedAt: "desc" } }),
    db.aIAgent.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const topicBookmarks = bookmarks.filter((bookmark) => bookmark.topic);
  const agentBookmarks = bookmarks.filter((bookmark) => bookmark.agent);
  const counts: Record<TabKey, number> = {
    meetings: myMeetings.length,
    drafts: myDrafts.length,
    documents: myDocuments.length,
    topics: myTopics.length,
    bookmarks: bookmarks.length,
    agents: myAgents.length,
  };

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="text-2xl font-black text-[#001845]">My Workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Không gian cá nhân của {userName} - mọi thứ bạn sở hữu hoặc theo dõi, ở một chỗ.</p>
        </div>
        <ReloadButton />
      </div>

      <div className="border-b border-[#dbe3ef]">
        <nav className="flex gap-7 overflow-x-auto px-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === "documents" ? "/workspace" : `/workspace?tab=${tab.key}`}
                className={
                  "whitespace-nowrap border-b-2 px-0 pb-3 text-sm font-semibold transition " +
                  (active ? "border-[#0b72ff] text-[#003c9e]" : "border-transparent text-slate-500 hover:text-[#003c9e]")
                }
              >
                {tab.label} <span className={active ? "text-blue-300" : "text-slate-300"}>({counts[tab.key]})</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        {activeTab === "documents" && (
          <>
            {myDocuments.map((doc) => (
              <Row key={doc.id} href={`/knowledge/documents/${doc.id}`} icon={<FileText size={18} />} title={doc.title} meta={`${doc.category} · ${fmt(doc.updatedAt)}`} badge={`v${doc.version}`} />
            ))}
            {myDocuments.length === 0 && <EmptyState label="Chưa có tài liệu nào." />}
          </>
        )}

        {activeTab === "meetings" && (
          <>
            {myMeetings.map((meeting) => (
              <Row key={meeting.id} href={`/meetings/${meeting.id}`} icon={<CalendarDays size={18} />} title={`${meeting.week} · ${meeting.section}`} meta={`${meeting.weekRange} · ${meeting.status}`} badge={meeting.status} />
            ))}
            {myMeetings.length === 0 && <EmptyState label="Chưa có meeting nào." />}
          </>
        )}

        {activeTab === "drafts" && (
          <>
            {myDrafts.map((meeting) => (
              <Row key={meeting.id} href={`/meetings/${meeting.id}`} icon={<CalendarDays size={18} />} title={`${meeting.week} · ${meeting.section}`} meta={`${meeting.weekRange} · ${fmt(meeting.updatedAt)}`} badge="Draft" />
            ))}
            {myDrafts.length === 0 && <EmptyState label="Chưa có draft nào." />}
          </>
        )}

        {activeTab === "topics" && (
          <>
            {myTopics.map((topic) => (
              <Row key={topic.id} href={`/topics/${topic.id}`} icon={<MessageSquare size={18} />} title={topic.title} meta={`${topic.category}${topic.project ? ` · ${topic.project}` : ""} · ${fmt(topic.updatedAt)}`} badge={`${topic.likes} like`} />
            ))}
            {myTopics.length === 0 && <EmptyState label="Chưa tạo topic nào." />}
          </>
        )}

        {activeTab === "bookmarks" && (
          <>
            {topicBookmarks.map((bookmark) => (
              <Row key={bookmark.id} href={`/topics/${bookmark.topicId}`} icon={<Star size={18} />} title={bookmark.topic!.title} meta={`Topic · ${fmt(bookmark.createdAt)}`} />
            ))}
            {agentBookmarks.map((bookmark) => (
              <Row key={bookmark.id} href={`/agents/${bookmark.agentId}`} icon={<Star size={18} />} title={bookmark.agent!.name} meta={`AI Agent · ${fmt(bookmark.createdAt)}`} />
            ))}
            {bookmarks.length === 0 && <EmptyState label="Chưa lưu mục nào." />}
          </>
        )}

        {activeTab === "agents" && (
          <>
            {myAgents.map((agent) => (
              <Row key={agent.id} href={`/agents/${agent.id}`} icon={<Bot size={18} />} title={agent.name} meta={`${agent.category} · ${fmt(agent.createdAt)}`} badge={agent.rating.toFixed(1)} />
            ))}
            {myAgents.length === 0 && <EmptyState label="Chưa tạo AI Agent nào." />}
          </>
        )}
      </div>
    </div>
  );
}
