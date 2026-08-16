"use client";

import { AlertCircle, BookOpen, FileText, FolderKanban, Save, Tags } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { type ProjectOption } from "@/lib/master-data";
import type { WikiFormData } from "@/types/knowledge";

function textFromHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function WikiForm({
  initial,
  projects,
  categories,
  onSubmit,
}: {
  initial: WikiFormData;
  projects: ProjectOption[];
  categories: string[];
  onSubmit: (data: WikiFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<WikiFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const projectOptions = useMemo(() => projects.map((project) => project.name), [projects]);

  const set = <K extends keyof WikiFormData>(key: K, value: WikiFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  function validate() {
    if (!form.title.trim()) return "Vui lòng nhập tiêu đề.";
    if (!form.category.trim()) return "Vui lòng chọn danh mục.";
    if (!textFromHtml(form.content)) return "Vui lòng nhập nội dung wiki.";
    return null;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    start(async () => {
      try {
        await onSubmit(form);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể lưu trang Wiki. Vui lòng thử lại.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
        <div className="border-b border-[#dbe3ef] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <BookOpen size={16} className="text-[#0b72ff]" />
            Thông tin Wiki
          </h2>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
            Tiêu đề <span className="text-red-500">*</span>
            <input
              className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ví dụ: Quy trình Weekly Report chuẩn D8"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Danh mục <span className="text-red-500">*</span>
            <select
              className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Dự án
            <select
              className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
              value={form.project}
              onChange={(event) => set("project", event.target.value)}
            >
              <option value="">Không gắn dự án</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
            Tags
            <div className="relative mt-1.5">
              <Tags size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-lg border border-[#dbe3ef] px-9 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
                placeholder="Phân tách bằng dấu phẩy: weekly, process, handover"
                value={form.tags}
                onChange={(event) => set("tags", event.target.value)}
              />
            </div>
          </label>
        </div>
      </section>

      <section className="meeting-rich-editor overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#dbe3ef] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <FileText size={16} className="text-[#0b72ff]" />
            Nội dung <span className="text-red-500">*</span>
          </h2>
          <span className="text-xs font-medium text-slate-400">TinyMCE rich text</span>
        </div>
        <div className="p-5">
          <Editor
            licenseKey="gpl"
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            value={form.content}
            onEditorChange={(value) => set("content", value)}
            init={{
              height: 460,
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
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#062f86] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} />
          {pending ? "Đang lưu..." : "Lưu trang Wiki"}
        </button>
      </div>
    </form>
  );
}
