import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CATEGORY_TYPES, CATEGORY_LABELS } from "@/lib/master-data-db";
import { ReloadButton } from "@/components/ui/reload-button";
import { CategoryManager } from "./category-manager";
import { createCategory, updateCategory, deleteCategory, type CategoryFormData } from "./actions";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const all = await db.masterCategory.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }, { value: "asc" }] });
  const groups = CATEGORY_TYPES.map((type) => ({
    type,
    label: CATEGORY_LABELS[type],
    rows: all.filter((r) => r.type === type).map((r) => ({ id: r.id, type: r.type, value: r.value, order: r.order, active: r.active })),
  }));

  async function createAction(data: CategoryFormData) { "use server"; await createCategory(data); }
  async function updateAction(id: string, data: CategoryFormData) { "use server"; await updateCategory(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteCategory(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý danh mục</h1>
          <p className="portal-page-subtitle">Danh mục dùng chung cho dự án, tài liệu, topic, họp tuần và wiki.</p>
        </div>
        <ReloadButton />
      </div>
      <CategoryManager groups={groups} onCreate={createAction} onUpdate={updateAction} onDelete={deleteAction} />
    </div>
  );
}
