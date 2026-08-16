"use client";
import { useState, useTransition } from "react";
import { importUsers } from "./actions";

type Result = { created: number; updated: number; skipped: number; errors: string[] };

export function ImportUsers() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    setError("");
    setResult(null);
    if (!file) { setError("Chưa chọn file"); return; }
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      try {
        setResult(await importUsers(fd));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] bg-white px-4 text-sm font-semibold text-slate-700"
      >
        Import Excel
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-slate-700">Import danh sách người dùng (.xlsx)</p>
          <input
            type="file"
            accept=".xlsx"
            className="block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Đang nhập…" : "Tải lên"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="text-sm text-slate-700">
              <p>Đã tạo {result.created} · Cập nhật {result.updated} · Bỏ qua {result.skipped}</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-amber-700">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
