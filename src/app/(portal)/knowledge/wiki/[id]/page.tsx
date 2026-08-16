import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { sanitizeWikiHtml } from "@/lib/sanitize";
import { WikiActionsBar } from "./wiki-actions-bar";

export default async function WikiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const page = await db.wikiPage.findUnique({
    where: { id },
    include: { author: true, tags: true, versions: { orderBy: { version: "desc" } } },
  });
  if (!page) notFound();

  const editable = can(session!.user.role, "content:edit");
  const meta = [page.category, page.project, page.author.name, page.tags.map((tag) => tag.name).join(", ")].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">{page.title}</h1>
          <p className="portal-page-subtitle">{meta}</p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Link href={`/knowledge/wiki/${page.id}/edit`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Sửa</Link>
            <WikiActionsBar id={page.id} />
          </div>
        )}
      </div>

      <article
        className="rounded-xl border border-[#dbe3ef] bg-white p-6 text-sm leading-7 text-slate-700 shadow-sm [&_a]:font-semibold [&_a]:text-[var(--vti-deep,#0A3CA8)] [&_blockquote]:border-l-2 [&_blockquote]:border-blue-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#dbe3ef] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[#dbe3ef] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizeWikiHtml(page.content) }}
      />

      <section className="rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Lịch sử phiên bản ({page.versions.length})</h2>
        <div className="space-y-2">
          {page.versions.map((version) => (
            <details key={version.id} className="rounded-lg border border-[#dbe3ef]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-600">v{version.version} · {version.createdAt.toLocaleString("vi-VN")}</summary>
              <div className="border-t border-[#dbe3ef] px-3 py-2 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeWikiHtml(version.content) }} />
            </details>
          ))}
          {page.versions.length === 0 && <p className="text-sm text-slate-400">Chưa có phiên bản</p>}
        </div>
      </section>

      <Link href="/knowledge/wiki" className="inline-block text-sm font-semibold text-[var(--vti-deep,#0A3CA8)]">← Danh sách Wiki</Link>
    </div>
  );
}
