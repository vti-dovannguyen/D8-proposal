"use client";

import { useState, useTransition } from "react";
import { MessageSquareText, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import {
  addMeetingComment,
  deleteMeetingComment,
  toggleMeetingCommentReaction,
  updateMeetingComment,
} from "../meeting-comment-actions";
import {
  getMeetingCommentDisplayState,
  type MeetingCommentReactionValue,
} from "@/lib/meeting-comments";

type MeetingCommentItem = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  unlikeCount: number;
  currentReaction: MeetingCommentReactionValue | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatCommentDate(value: string) {
  return dateTimeFormatter.format(new Date(value)).replace(",", "");
}

function formatCommentMetadata(comment: MeetingCommentItem) {
  const display = getMeetingCommentDisplayState(comment.createdAt, comment.editedAt);
  return `${formatCommentDate(display.timestamp)}${display.edited ? " · đã sửa" : ""}`;
}

function ReactionButton({
  value,
  count,
  active,
  pending,
  onToggle,
}: {
  value: MeetingCommentReactionValue;
  count: number;
  active: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const Icon = value === "LIKE" ? ThumbsUp : ThumbsDown;
  const label = value === "LIKE" ? "Like comment" : "Unlike comment";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={pending}
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:opacity-50 ${
        active ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
      }`}
    >
      <Icon size={13} />
      <span>{value === "LIKE" ? "Like" : "Unlike"}</span>
      <span>{count}</span>
    </button>
  );
}

export function MeetingComments({
  meetingId,
  comments,
  canManage,
}: {
  meetingId: string;
  comments: MeetingCommentItem[];
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reactionPending, startReaction] = useTransition();
  const pending = actionPending !== null || reactionPending;

  async function handleDelete(commentId: string) {
    setActionPending(`delete:${commentId}`);
    setActionError(null);
    try {
      await deleteMeetingComment(commentId);
    } catch {
      setActionError("Không thể xóa comment. Vui lòng thử lại.");
    } finally {
      setActionPending(null);
    }
  }

  function handleReaction(commentId: string, value: MeetingCommentReactionValue) {
    setActionError(null);
    startReaction(async () => {
      try {
        await toggleMeetingCommentReaction(commentId, value);
      } catch {
        setActionError("Không thể cập nhật reaction. Vui lòng thử lại.");
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#dbe3ef] bg-white shadow-sm">
      <div className="flex min-h-9 items-center gap-2 border-b border-[#dbe3ef] px-4 py-2 text-sm font-semibold text-slate-950">
        <span className="text-blue-600"><MessageSquareText size={15} /></span>
        <h2>Manager comment ({comments.length})</h2>
      </div>

      <div className="space-y-3 p-4">
        {actionError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
        <div className="space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold text-slate-900">{comment.authorName}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {formatCommentMetadata(comment)}
                  </span>
                </div>
                {canManage && editingId !== comment.id && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit comment"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingContent(comment.content);
                        setActionError(null);
                      }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-blue-600 disabled:opacity-50"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete comment"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm("Xóa comment này?")) {
                          void handleDelete(comment.id);
                        }
                      }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <form
                  className="mt-2 space-y-2"
                  action={async (formData) => {
                    setActionPending(`update:${comment.id}`);
                    setActionError(null);
                    try {
                      const result = await updateMeetingComment(comment.id, formData);
                      if (!result.ok) {
                        setActionError(result.error);
                        return;
                      }
                      setEditingId(null);
                      setEditingContent("");
                    } catch {
                      setActionError("Không thể lưu comment. Vui lòng thử lại.");
                    } finally {
                      setActionPending(null);
                    }
                  }}
                >
                  <textarea
                    name="content"
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    required
                    maxLength={2000}
                    rows={3}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {actionPending === `update:${comment.id}` ? "Đang lưu…" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent("");
                        setActionError(null);
                      }}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{comment.content}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <ReactionButton
                  value="LIKE"
                  count={comment.likeCount}
                  active={comment.currentReaction === "LIKE"}
                  pending={pending}
                  onToggle={() => handleReaction(comment.id, "LIKE")}
                />
                <ReactionButton
                  value="UNLIKE"
                  count={comment.unlikeCount}
                  active={comment.currentReaction === "UNLIKE"}
                  pending={pending}
                  onToggle={() => handleReaction(comment.id, "UNLIKE")}
                />
              </div>
            </article>
          ))}
          {comments.length === 0 && <p className="text-sm text-slate-400">Chưa có Manager comment.</p>}
        </div>

        {canManage ? (
          <form
            className="border-t border-slate-200 pt-3"
            action={async (formData) => {
              setActionPending("create");
              setActionError(null);
              try {
                const result = await addMeetingComment(meetingId, formData);
                if (!result.ok) {
                  setActionError(result.error);
                  return;
                }
                setCreateContent("");
              } catch {
                setActionError("Không thể gửi comment. Vui lòng thử lại.");
              } finally {
                setActionPending(null);
              }
            }}
          >
            <label htmlFor="manager-comment-content" className="mb-1.5 block text-sm font-semibold text-slate-800">Thêm comment</label>
            <textarea
              id="manager-comment-content"
              name="content"
              value={createContent}
              onChange={(event) => setCreateContent(event.target.value)}
              required
              maxLength={2000}
              rows={3}
              placeholder="Nhập comment của Manager…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {actionPending === "create" ? "Đang gửi…" : "Gửi comment"}
              </button>
            </div>
          </form>
        ) : (
          <p className="border-t border-slate-200 pt-3 text-xs text-slate-400">Chỉ Manager mới có thể thêm, sửa hoặc xóa comment.</p>
        )}
      </div>
    </section>
  );
}
