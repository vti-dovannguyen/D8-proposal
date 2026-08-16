import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { db } from "@/lib/db";
import { getCategoryValues } from "@/lib/master-data-db";
import { ReloadButton } from "@/components/ui/reload-button";

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ category?: string; project?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = {
    ...(sp.category ? { category: sp.category } : {}),
    ...(sp.project ? { project: sp.project } : {}),
  };
  const [topics, total, categoryOptions, projects] = await Promise.all([
    db.topic.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { author: true, _count: { select: { comments: true } } }, ...paginationArgs(page) }),
    db.topic.count({ where }),
    getCategoryValues("TOPIC"),
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Topics</h1>
          <p className="portal-page-subtitle">Trao đổi nội bộ theo chủ đề, danh mục, dự án và mức độ quan tâm.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <ReloadButton />
          <Link href="/topics/new" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Tạo chủ đề</Link>
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm md:grid-cols-3">
        <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi danh mục</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select name="project" defaultValue={sp.project ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi dự án</option>
          {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="h-10 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-semibold text-white">Lọc</button>
          <Link href="/topics" className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] px-4 text-sm font-semibold text-slate-600">Reset</Link>
        </div>
      </form>

      <div className="flex justify-end text-sm text-slate-500">{total} topic</div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Chủ đề</th><th>Danh mục</th><th>Dự án</th><th>Tác giả</th><th>Tương tác</th></tr></thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {topic.pinned && <span className="portal-pill bg-amber-100 text-amber-700">Ghim</span>}
                    <Link href={`/topics/${topic.id}`} className="portal-table-title">{topic.title}</Link>
                  </div>
                </td>
                <td><span className="portal-pill bg-sky-100 text-sky-700">{topic.category}</span></td>
                <td className="portal-table-muted">{topic.project || "-"}</td>
                <td>{topic.author.name}</td>
                <td className="portal-table-muted">{topic.likes} likes · {topic._count.comments} comments</td>
              </tr>
            ))}
            {topics.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có chủ đề nào</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/topics" params={sp} page={page} total={total} />
    </div>
  );
}
