import { BookmarkButton } from "@/components/bookmark-button";
import { auth } from "@/lib/auth";
import { canDeleteTopic } from "@/lib/community";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { CommentForm } from "./comment-form";
import { TopicActionsBar } from "./topic-actions-bar";

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const topic = await db.topic.findUnique({
    where: { id },
    include: { author: true, tags: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!topic) notFound();

  const bookmark = await db.bookmark.findUnique({
    where: { userId_targetType_targetId: { userId, targetType: "topic", targetId: id } },
  });
  const meta = [topic.category, topic.project, topic.author.name, `♥ ${topic.likes}`, topic.tags.map((tag) => tag.name).join(", ")].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {topic.pinned && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700">Ghim</span>}
            <h1 className="text-lg font-semibold text-slate-900">{topic.title}</h1>
          </div>
          <p className="text-sm text-slate-400">{meta}</p>
        </div>
        <BookmarkButton targetType="topic" targetId={topic.id} initialBookmarked={Boolean(bookmark)} />
      </div>

      <section className="rounded-xl border bg-white p-4">
        <p className="whitespace-pre-wrap text-sm text-slate-700">{topic.content}</p>
      </section>

      <TopicActionsBar
        id={topic.id}
        pinned={topic.pinned}
        canPin={isManager(session!.user.role)}
        canDelete={canDeleteTopic(session!.user.role, topic.authorId, userId)}
      />

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Bình luận ({topic.comments.length})</h2>
        <ul className="mb-3 space-y-2">
          {topic.comments.map((comment) => (
            <li key={comment.id} className="border-t pt-2 text-sm">
              <span className="font-medium text-slate-900">{comment.author.name}</span>
              <span className="ml-2 text-xs text-slate-400">{comment.createdAt.toLocaleString("vi-VN")}</span>
              <p className="text-slate-700">{comment.content}</p>
            </li>
          ))}
          {topic.comments.length === 0 && <li className="text-sm text-slate-400">Chưa có bình luận</li>}
        </ul>
        <CommentForm topicId={topic.id} />
      </section>
    </div>
  );
}
