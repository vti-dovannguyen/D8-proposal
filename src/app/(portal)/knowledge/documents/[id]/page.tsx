import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSignedUrl } from "@/lib/storage";
import { DocumentActionsBar } from "./document-actions-bar";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const doc = await db.document.findUnique({ where: { id }, include: { author: true, tags: true } });
  if (!doc) notFound();

  const url = await getSignedUrl(doc.fileUrl);
  const editable = can(session!.user.role, "content:edit");
  const meta = [doc.category, doc.project, `v${doc.version}`, doc.author.name, `${(doc.fileSize / 1024).toFixed(0)} KB`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">{doc.title}</h1>
          <p className="portal-page-subtitle">{meta}</p>
          <p className="mt-1 text-xs text-slate-400">{doc.tags.map((tag) => tag.name).join(", ")}</p>
        </div>
        <a href={url} download className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Tải xuống</a>
      </div>

      <section className="rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm">
        {doc.mimeType === "application/pdf" ? (
          <iframe src={url} className="h-[600px] w-full rounded-lg border border-[#dbe3ef]" title={doc.title} />
        ) : doc.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={doc.title} className="max-h-[600px] rounded-lg border border-[#dbe3ef]" />
        ) : (
          <p className="text-sm text-slate-500">Không thể xem trước định dạng này. Hãy tải xuống để mở.</p>
        )}
      </section>

      {editable && <DocumentActionsBar id={doc.id} />}

      <Link href="/knowledge/documents" className="inline-block text-sm font-semibold text-[var(--vti-deep,#0A3CA8)]">← Danh sách tài liệu</Link>
    </div>
  );
}
