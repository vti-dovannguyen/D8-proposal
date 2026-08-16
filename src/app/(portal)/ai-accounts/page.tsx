import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { createAIAccount, deleteAIAccount, updateAIAccount, type AIAccountFormData } from "./actions";
import { AIAccountForm } from "./ai-account-form";

export default async function AIAccountsPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "ai-account:manage")) redirect("/");

  const [accounts, projects, users] = await Promise.all([
    db.aIAccount.findMany({ orderBy: [{ status: "asc" }, { provider: "asc" }, { email: "asc" }], include: { members: true, assignedTo: true } }),
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  async function createAction(data: AIAccountFormData) {
    "use server";
    await createAIAccount(data);
  }
  async function updateAction(id: string, data: AIAccountFormData) {
    "use server";
    await updateAIAccount(id, data);
  }
  async function deleteAction(id: string) {
    "use server";
    await deleteAIAccount(id);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">AI Account Management</h1>
          <p className="portal-page-subtitle">Quản lý tài khoản AI theo provider, dự án, thành viên sử dụng, chi phí và subscription.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{accounts.length} account</span>
          <ReloadButton />
        </div>
      </div>
      <AIAccountForm
        accounts={accounts.map((account) => ({
          id: account.id,
          email: account.email,
          provider: account.provider,
          accountType: account.accountType,
          project: account.project ?? "",
          assignedToId: account.assignedToId ?? "",
          assignedToName: account.assignedTo?.name ?? "",
          memberIds: account.members.map((member) => member.id),
          memberNames: account.members.map((member) => member.name),
          purchaseDate: account.purchaseDate ? account.purchaseDate.toISOString().slice(0, 10) : "",
          cost: account.cost == null ? "" : String(account.cost),
          currency: account.currency,
          subscriptionType: account.subscriptionType,
          status: account.status,
          notes: account.notes ?? "",
        }))}
        projects={projects}
        users={users}
        onCreate={createAction}
        onUpdate={updateAction}
        onDelete={deleteAction}
      />
    </div>
  );
}
