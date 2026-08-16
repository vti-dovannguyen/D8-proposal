"use client";

import { useState, useTransition } from "react";
import type { ProjectOption } from "@/lib/master-data";
import type { TopicFormData } from "@/types/community";

export function TopicForm({ projects, categories, onSubmit }: { projects: ProjectOption[]; categories: string[]; onSubmit: (data: TopicFormData) => Promise<void> }) {
  const [form, setForm] = useState<TopicFormData>({ title: "", content: "", category: categories[0] ?? "", project: "", tags: "" });
  const [pending, start] = useTransition();
  const set = <K extends keyof TopicFormData>(key: K, value: TopicFormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={(event) => { event.preventDefault(); start(() => onSubmit(form)); }} className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-[#dbe3ef] bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Tiêu đề
          <input className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" value={form.title} onChange={(event) => set("title", event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Danh mục
          <select className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={form.category} onChange={(event) => set("category", event.target.value)}>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Dự án
          <select className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={form.project} onChange={(event) => set("project", event.target.value)}>
            <option value="">Không gắn dự án</option>
            {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Tags
          <input className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" placeholder="phân tách bằng dấu phẩy" value={form.tags} onChange={(event) => set("tags", event.target.value)} />
        </label>
      </div>
      <label className="block rounded-xl border border-[#dbe3ef] bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">
        Nội dung
        <textarea className="mt-2 w-full rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm font-normal" rows={7} value={form.content} onChange={(event) => set("content", event.target.value)} />
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Đang đăng..." : "Đăng chủ đề"}
        </button>
      </div>
    </form>
  );
}
