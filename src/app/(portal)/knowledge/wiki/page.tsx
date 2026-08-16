import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";

export default async function WikiListPage({ searchParams }: { searchParams: Promise<{ tag?: string; page?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = sp.tag ? { tags: { some: { name: sp.tag } } } : {};

  const [pages, total, tags] = await Promise.all([
    db.wikiPage.findMany({ where, orderBy: { updatedAt: "desc" }, include: { author: true, tags: true }, ...paginationArgs(page) }),
    db.wikiPage.count({ where }),
    db.tag.findMany({ where: { wikiPages: { some: {} } }, orderBy: { name: "asc" } }),
  ]);
  const editable = can(session!.user.role, "content:edit");

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Wiki</h1>
          <p className="portal-page-subtitle">Trang kiến thức nội bộ theo danh mục, dự án, tag và lịch sử cập nhật.</p>
        </div>
        <div className="flex items-center gap-3">
          <ReloadButton />
          <Link href="/knowledge" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Knowledge Center</Link>
          {editable && <Link href="/knowledge/wiki/new" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Tạo trang</Link>}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="portal-chip-row">
          <Link href="/knowledge/wiki" className={"portal-chip " + (!sp.tag ? "portal-chip-active" : "")}>Tất cả</Link>
          {tags.map((tag) => (
            <Link key={tag.id} href={`/knowledge/wiki?tag=${encodeURIComponent(tag.name)}`} className={"portal-chip " + (sp.tag === tag.name ? "portal-chip-active" : "")}>{tag.name}</Link>
          ))}
        </div>
      )}

      <div className="flex justify-end text-sm text-slate-500">{total} wiki page</div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Trang</th><th>Danh mục</th><th>Dự án</th><th>Tags</th><th>Tác giả</th><th>Cập nhật lần cuối</th></tr></thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id}>
                <td><Link href={`/knowledge/wiki/${page.id}`} className="portal-table-title">{page.title}</Link></td>
                <td><span className="portal-pill bg-sky-100 text-sky-700">{page.category}</span></td>
                <td className="portal-table-muted">{page.project || "-"}</td>
                <td className="portal-table-muted">{page.tags.map((tag) => tag.name).join(", ") || "No tags"}</td>
                <td>{page.author.name}</td>
                <td className="portal-table-muted">{page.updatedAt.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có trang wiki nào</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/knowledge/wiki" params={sp} page={page} total={total} />
    </div>
  );
}
