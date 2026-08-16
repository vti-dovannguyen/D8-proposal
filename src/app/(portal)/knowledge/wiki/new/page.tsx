import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getCategoryValues } from "@/lib/master-data-db";
import type { WikiFormData } from "@/types/knowledge";
import { createWiki } from "../actions";
import { WikiForm } from "../wiki-form";

export default async function NewWikiPage() {
  const session = await auth();
  if (!can(session!.user.role, "content:edit")) redirect("/knowledge/wiki");

  const [projects, categories] = await Promise.all([
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true },
    }),
    getCategoryValues("WIKI"),
  ]);
  const initial: WikiFormData = { title: "", content: "", category: "Process", project: "", tags: "" };

  async function action(data: WikiFormData) {
    "use server";
    await createWiki(data);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tạo trang Wiki</h1>
          <p className="portal-page-subtitle">Soạn nội dung tri thức nội bộ với định dạng rich text, danh mục và dự án liên quan.</p>
        </div>
      </div>
      <WikiForm initial={initial} projects={projects} categories={categories} onSubmit={action} />
    </div>
  );
}
