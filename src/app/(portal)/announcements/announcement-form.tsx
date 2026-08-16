"use client";
import { useState, useTransition } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { htmlToText } from "@/lib/announcements";
import type { AnnouncementFormData } from "@/types/community";

export function AnnouncementForm({ initial, submitLabel, onSubmit }: {
  initial: AnnouncementFormData;
  submitLabel: string;
  onSubmit: (data: AnnouncementFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<AnnouncementFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof AnnouncementFormData>(k: K, v: AnnouncementFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Vui lòng nhập tiêu đề."); return; }
    if (!htmlToText(form.body)) { setError("Vui lòng nhập nội dung thông báo."); return; }
    setError(null);
    start(async () => {
      try { await onSubmit(form); }
      catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu thông báo."); }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <label className="block text-sm font-semibold text-slate-700">
        Tiêu đề
        <input className="mt-1 w-full rounded border px-2 py-1 font-normal" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="meeting-rich-editor">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Nội dung</span>
        <Editor
          licenseKey="gpl"
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          value={form.body}
          onEditorChange={(value) => set("body", value)}
          init={{
            height: 360,
            base_url: "/tinymce",
            suffix: ".min",
            menubar: false,
            plugins: "lists link table code autoresize",
            toolbar: "undo redo | blocks | bold italic underline | bullist numlist | link table | alignleft aligncenter alignright | code",
            skin: "oxide",
            content_css: "default",
            branding: false,
            promotion: false,
            statusbar: true,
            content_style:
              "body { font-family: Inter, Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.65; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #dbe3ef; padding: 6px 8px; } th { background: #f3f6fb; }",
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={(e) => set("pinned", e.target.checked)} /> Ghim</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Hiển thị: {form.active ? "ON" : "OFF"}</label>
        <button type="submit" disabled={pending} className="ml-auto rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 font-medium text-white disabled:opacity-50">{pending ? "Đang lưu…" : submitLabel}</button>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </form>
  );
}
