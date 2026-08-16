"use client";
import { useRef, useTransition } from "react";
import { uploadAttachment } from "../actions";

export function AttachmentUpload({ meetingId }: { meetingId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(() => uploadAttachment(meetingId, fd))}
      className="mt-2 flex items-center gap-2"
    >
      <label htmlFor="meeting-attach-file" className="sr-only">Chọn tệp đính kèm</label>
      <input id="meeting-attach-file" ref={ref} name="file" type="file" className="text-sm" />
      <button type="submit" disabled={pending} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
        {pending ? "Đang tải…" : "Tải lên"}
      </button>
    </form>
  );
}
