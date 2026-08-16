"use client";

import { FileUp, FolderKanban, Tags, UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { type ProjectOption } from "@/lib/master-data";
import { createDocument } from "./actions";

export function DocumentUploadForm({ projects = [], categories }: { projects?: ProjectOption[]; categories: string[] }) {
  const [pending, start] = useTransition();
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={(formData) => start(() => createDocument(formData))} className="overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-sm">
      <div className="border-b border-[#dbe3ef] px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <UploadCloud size={17} className="text-[#0b72ff]" />
          Thêm tài liệu
        </h2>
        <p className="mt-1 text-sm text-slate-500">Chọn danh mục, dự án liên quan và tải lên file tài liệu dùng chung.</p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
          Tiêu đề <span className="text-red-500">*</span>
          <input
            name="title"
            required
            placeholder="Ví dụ: Proposal_Rakuten_WMS_v0.9"
            className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Danh mục <span className="text-red-500">*</span>
          <select
            name="category"
            required
            defaultValue={categories[0]}
            className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
          >
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
            name="project"
            defaultValue=""
            className="mt-1.5 h-11 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Không gắn dự án</option>
            {projects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
          Tags
          <div className="relative mt-1.5">
            <Tags size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="tags"
              placeholder="Phân tách bằng dấu phẩy: proposal, rakuten, wms"
              className="h-11 w-full rounded-lg border border-[#dbe3ef] px-9 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b72ff] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </label>

        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            File tài liệu <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileRef}
            id="doc-file"
            name="file"
            type="file"
            required
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed border-[#bdd0ea] bg-[#f8fbff] px-4 py-5 text-center transition hover:border-[#0b72ff] hover:bg-blue-50"
          >
            <span className="flex flex-col items-center gap-2">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-[#0b72ff] shadow-sm">
                <FileUp size={22} />
              </span>
              <span className="text-sm font-bold text-slate-900">{fileName || "Chọn file tài liệu"}</span>
              <span className="text-xs text-slate-500">PDF, DOCX, XLSX, PPTX, ảnh. Tối đa theo cấu hình storage.</span>
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#dbe3ef] bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <FolderKanban size={14} />
          Project lấy từ master data.
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#062f86] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud size={16} />
          {pending ? "Đang tải..." : "Tải lên tài liệu"}
        </button>
      </div>
    </form>
  );
}
