"use client";
import { useState, useTransition } from "react";
import { updateServerInfo } from "./actions";

export function ServerInfoTab({ projectId, serverInfo, canEdit }: { projectId: string; serverInfo: string; canEdit: boolean }) {
  const [text, setText] = useState(serverInfo);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  if (!canEdit) {
    return (
      <pre className="whitespace-pre-wrap rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 text-sm text-slate-700 shadow-[var(--sh-1)]">
        {serverInfo || "Chưa có thông tin server."}
      </pre>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={14}
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        placeholder="Nhập thông tin server: IP, SSH, cấu hình, port, ghi chú deploy..."
        className="w-full rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 font-mono text-sm shadow-[var(--sh-1)]"
      />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600">Đã lưu</span>}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await updateServerInfo(projectId, text); setSaved(true); })}
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
