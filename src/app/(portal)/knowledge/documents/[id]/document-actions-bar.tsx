"use client";
import { useTransition } from "react";
import { uploadNewVersion, deleteDocument } from "../actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DocumentActionsBar({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <form action={(fd) => start(() => uploadNewVersion(id, fd))} className="flex items-center gap-2">
        <label htmlFor="doc-version-file" className="sr-only">Chọn tệp phiên bản mới</label>
        <input id="doc-version-file" name="file" type="file" required className="text-sm" />
        <button type="submit" disabled={pending} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
          {pending ? "Đang tải…" : "Tải phiên bản mới"}
        </button>
      </form>
      <ConfirmButton label="Xóa tài liệu" onConfirm={() => deleteDocument(id)} />
    </div>
  );
}
