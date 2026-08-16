import Link from "next/link";
import { db } from "@/lib/db";
import { SearchBox } from "./search-box";

export default async function KnowledgePage() {
  const [docCount, wikiCount] = await Promise.all([
    db.document.count(),
    db.wikiPage.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Knowledge Center</h1>
      <SearchBox />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/knowledge/documents" className="rounded-xl border bg-white p-5 hover:border-[var(--vti-deep,#0A3CA8)]">
          <h2 className="text-base font-semibold text-slate-900">Tài liệu</h2>
          <p className="mt-1 text-sm text-slate-500">Tải lên, xem trước và quản lý phiên bản tài liệu.</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{docCount}</p>
        </Link>
        <Link href="/knowledge/wiki" className="rounded-xl border bg-white p-5 hover:border-[var(--vti-deep,#0A3CA8)]">
          <h2 className="text-base font-semibold text-slate-900">Wiki</h2>
          <p className="mt-1 text-sm text-slate-500">Trang kiến thức soạn thảo rich-text, có lịch sử phiên bản.</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{wikiCount}</p>
        </Link>
      </div>
    </div>
  );
}
