import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getCategoryValues } from "@/lib/master-data-db";
import type { WikiFormData } from "@/types/knowledge";
import { updateWiki } from "../../actions";
import { WikiForm } from "../../wiki-form";

export default async function EditWikiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!can(session!.user.role, "content:edit")) redirect(`/knowledge/wiki/${id}`);

  const [page, projects, categories] = await Promise.all([
    db.wikiPage.findUnique({ where: { id }, include: { tags: true } }),
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true },
    }),
    getCategoryValues("WIKI"),
  ]);
  if (!page) notFound();

  const initial: WikiFormData = {
    title: page.title,
    content: page.content,
    category: page.category,
    project: page.project ?? "",
    tags: page.tags.map((tag) => tag.name).join(", "),
  };

  async function action(data: WikiFormData) {
    "use server";
    await updateWiki(id, data);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Sửa Wiki</h1>
          <p className="portal-page-subtitle">{page.title}</p>
        </div>
      </div>
      <WikiForm initial={initial} projects={projects} categories={categories} onSubmit={action} />
    </div>
  );
}
