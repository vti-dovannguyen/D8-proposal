import Link from "next/link";
import { Pagination, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { runFullTextSearch } from "@/lib/search";
import { ReloadButton } from "@/components/ui/reload-button";
import { SearchBox } from "../search-box";

const PAGE_SIZE = 10;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await auth();
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const results = q ? await runFullTextSearch(q) : [];
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tìm kiếm</h1>
          <p className="portal-page-subtitle">Tìm nhanh tài liệu và wiki theo tiêu đề, danh mục và nội dung chỉ mục.</p>
        </div>
        <ReloadButton />
      </div>
      <SearchBox defaultValue={q} />

      {q && (
        <div className="flex justify-end text-sm text-slate-500">{results.length} kết quả cho "{q}"</div>
      )}
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Kết quả</th><th>Loại</th><th>Danh mục</th></tr></thead>
          <tbody>
            {visibleResults.map((r) => (
              <tr key={`${r.type}-${r.id}`}>
                <td><Link href={r.type === "document" ? `/knowledge/documents/${r.id}` : `/knowledge/wiki/${r.id}`} className="portal-table-title">{r.title}</Link></td>
                <td><span className={"portal-pill " + (r.type === "document" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>{r.type === "document" ? "Tài liệu" : "Wiki"}</span></td>
                <td className="portal-table-muted">{r.category}</td>
              </tr>
            ))}
            {q && results.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Không tìm thấy kết quả</td></tr>}
            {!q && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nhập từ khóa để tìm kiếm</td></tr>}
          </tbody>
        </table>
      </div>
      {q && <Pagination basePath="/knowledge/search" params={{ q }} page={page} total={results.length} pageSize={PAGE_SIZE} />}
    </div>
  );
}
