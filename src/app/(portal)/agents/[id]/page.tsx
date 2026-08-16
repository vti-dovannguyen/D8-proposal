import { notFound } from "next/navigation";
import { BookmarkButton } from "@/components/bookmark-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { AgentChat } from "../agent-chat";
import { DeleteAgentButton } from "./delete-agent-button";

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { id } = await params;
  const { thread: selectedThreadId } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const agent = await db.aIAgent.findUnique({ where: { id }, include: { owner: true } });
  if (!agent) notFound();

  const [bookmark, threads] = await Promise.all([
    db.bookmark.findUnique({
      where: { userId_targetType_targetId: { userId, targetType: "agent", targetId: id } },
    }),
    db.agentChatThread.findMany({
      where: { userId, agentId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    }),
  ]);

  const activeThreadId = selectedThreadId && threads.some((thread) => thread.id === selectedThreadId) ? selectedThreadId : threads[0]?.id;
  const selectedMessages = activeThreadId
    ? await db.agentChatMessage.findMany({
        where: { threadId: activeThreadId, thread: { userId, agentId: id } },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      })
    : [];
  const canDelete = agent.ownerId === userId || isManager(session!.user.role);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{agent.name}</h1>
          <p className="text-sm text-slate-400">
            {agent.category} · {agent.owner.name} · ★ {agent.rating.toFixed(1)} ({agent.ratingCount})
          </p>
        </div>
        <div className="flex gap-2">
          <BookmarkButton targetType="agent" targetId={agent.id} initialBookmarked={Boolean(bookmark)} />
          {canDelete && <DeleteAgentButton id={agent.id} />}
        </div>
      </div>

      <section className="rounded-xl border bg-white p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Mô tả</p>
        <p className="mb-2">{agent.description}</p>
        <p className="font-medium text-slate-900">Use case</p>
        <p>{agent.useCase}</p>
      </section>

      <AgentChat
        agent={{ id: agent.id, name: agent.name }}
        activeThreadId={activeThreadId ?? null}
        initialMessages={selectedMessages.map((message) => ({
          role: message.role === "ASSISTANT" ? "agent" : "user",
          text: message.content,
        }))}
        initialThreads={threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          preview: thread.messages[0]?.content ?? "",
          updatedAt: thread.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
