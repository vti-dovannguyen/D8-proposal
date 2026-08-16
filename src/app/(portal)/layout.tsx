import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ShellChrome } from "@/components/layout/shell-chrome";
import { db } from "@/lib/db";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { name, role } = session.user;
  const [meetings, documents, wiki, topics, agents, aiAccounts, notifications] = await Promise.all([
    db.meeting.count(),
    db.document.count(),
    db.wikiPage.count(),
    db.topic.count(),
    db.aIAgent.count(),
    db.aIAccount.count(),
    db.announcement.findMany({
      where: activeAnnouncementWhere(),
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, body: true, pinned: true },
    }),
  ]);
  const notificationItems = notifications.map((n) => ({ id: n.id, title: n.title, preview: htmlToText(n.body), pinned: n.pinned }));
  return (
    <ShellChrome name={name ?? "User"} role={role} counts={{ meetings, documents, wiki, topics, agents, aiAccounts }} notifications={notificationItems}>
      {children}
    </ShellChrome>
  );
}
