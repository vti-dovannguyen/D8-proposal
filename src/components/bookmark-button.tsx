"use client";
import { useState, useTransition } from "react";
import { toggleBookmark } from "@/app/(portal)/workspace/actions";

export function BookmarkButton({
  targetType,
  targetId,
  initialBookmarked,
}: {
  targetType: "topic" | "agent";
  targetId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={bookmarked ? "Bỏ lưu" : "Lưu"}
      aria-pressed={bookmarked}
      onClick={() => start(async () => {
        const res = await toggleBookmark(targetType, targetId);
        setBookmarked(res.bookmarked);
      })}
      className={"rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 " + (bookmarked ? "border-amber-300 bg-amber-50 text-amber-700" : "text-slate-600")}
    >
      {bookmarked ? "★ Đã lưu" : "☆ Lưu"}
    </button>
  );
}
