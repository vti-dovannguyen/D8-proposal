import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCategoryValues } from "@/lib/master-data-db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { DocumentUploadForm } from "./document-upload-form";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; category?: string; project?: string; page?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = {
    ...(sp.tag ? { tags: { some: { name: sp.tag } } } : {}),
    ...(sp.category ? { category: sp.category } : {}),
    ...(sp.project ? { project: sp.project } : {}),
  };

  const [documents, total, tags, projects, documentCategories] = await Promise.all([
    db.document.findMany({ where, orderBy: { updatedAt: "desc" }, include: { author: true, tags: true }, ...paginationArgs(page) }),
    db.document.count({ where }),
    db.tag.findMany({ where: { documents: { some: {} } }, orderBy: { name: "asc" } }),
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true },
    }),
    getCategoryValues("DOCUMENT"),
  ]);
  const editable = can(session!.user.role, "content:edit");

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tài liệu</h1>
          <p className="portal-page-subtitle">Quản lý tài liệu, phiên bản, danh mục, dự án và tag trong Knowledge Center.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <ReloadButton />
          <Link href="/knowledge" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Knowledge Center</Link>
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm md:grid-cols-4">
        <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi danh mục</option>
          {documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select name="project" defaultValue={sp.project ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi dự án</option>
          {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
        </select>
        <select name="tag" defaultValue={sp.tag ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi tag</option>
          {tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="h-10 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-semibold text-white">Lọc</button>
          <Link href="/knowledge/documents" className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] px-4 text-sm font-semibold text-slate-600">Reset</Link>
        </div>
      </form>

      {editable && <DocumentUploadForm projects={projects} categories={documentCategories} />}

      <div className="flex justify-end text-sm text-slate-500">{total} tài liệu</div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th>Tiêu đề</th><th>Danh mục</th><th>Dự án</th><th>Version</th><th>Tác giả</th><th>Cập nhật lần cuối</th></tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <Link href={`/knowledge/documents/${document.id}`} className="portal-table-title">{document.title}</Link>
                  <div className="portal-table-muted">{document.tags.map((tag) => tag.name).join(", ") || "No tags"}</div>
                </td>
                <td><span className="portal-pill bg-amber-100 text-amber-700">{document.category}</span></td>
                <td className="portal-table-muted">{document.project || "-"}</td>
                <td className="portal-table-muted">v{document.version}</td>
                <td>{document.author.name}</td>
                <td className="portal-table-muted">{document.updatedAt.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có tài liệu nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/knowledge/documents" params={sp} page={page} total={total} />
    </div>
  );
}
