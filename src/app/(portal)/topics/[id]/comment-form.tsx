"use client";
import { useRef, useTransition } from "react";
import { addComment } from "../actions";

export function CommentForm({ topicId }: { topicId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      action={(fd) => start(async () => { await addComment(topicId, fd); ref.current?.reset(); })}
      className="flex gap-2"
    >
      <input name="content" required placeholder="Viết bình luận…" className="w-full rounded border px-2 py-1 text-sm" />
      <button type="submit" disabled={pending} className="rounded border px-3 py-1 text-sm disabled:opacity-50">{pending ? "Đang gửi…" : "Gửi"}</button>
    </form>
  );
}
