import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { CertTypeManager } from "./cert-type-manager";
import { createCertType, updateCertType, deleteCertType, type CertTypeFormData } from "./actions";

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const types = await db.certificateType.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const rows = types.map((t) => ({ id: t.id, name: t.name, issuer: t.issuer ?? "", category: t.category ?? "", active: t.active }));

  async function createAction(data: CertTypeFormData) { "use server"; await createCertType(data); }
  async function updateAction(id: string, data: CertTypeFormData) { "use server"; await updateCertType(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteCertType(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý Chứng chỉ</h1>
          <p className="portal-page-subtitle">Danh mục loại chứng chỉ dùng để gán cho thành viên.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{rows.length} loại</span>
          <ReloadButton />
        </div>
      </div>
      <CertTypeManager types={rows} onCreate={createAction} onUpdate={updateAction} onDelete={deleteAction} />
    </div>
  );
}
