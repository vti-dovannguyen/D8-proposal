import type { ProjectOption } from "@/lib/master-data";
import { AIAccountForm } from "../../ai-accounts/ai-account-form";
import { createAIAccount, updateAIAccount, deleteAIAccount, type AIAccountFormData } from "../../ai-accounts/actions";

type AIAccountRow = AIAccountFormData & { id: string; memberNames: string[]; assignedToName: string };
type UserOption = { id: string; name: string; email: string };

export function AiAccountsTab({
  projectName,
  accounts,
  projectOption,
  users,
  canEdit,
}: {
  projectName: string;
  accounts: AIAccountRow[];
  projectOption: ProjectOption;
  users: UserOption[];
  canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <div className="portal-table-card">
        <table className="portal-table min-w-[640px]">
          <thead>
            <tr>
              <th>Email</th>
              <th>Provider</th>
              <th>Loại</th>
              <th>Người phụ trách</th>
              <th>Members</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-slate-900">{a.email}</td>
                <td>{a.provider}</td>
                <td className="portal-table-muted">{a.accountType}</td>
                <td className="portal-table-muted">{a.assignedToName || "-"}</td>
                <td className="portal-table-muted">{a.memberNames.join(", ") || "-"}</td>
                <td>
                  <span className="portal-pill bg-slate-100 text-slate-600">{a.status}</span>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Chưa có tài khoản AI cho dự án này
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  async function onCreate(data: AIAccountFormData) {
    "use server";
    await createAIAccount({ ...data, project: data.project || projectName });
  }
  async function onUpdate(id: string, data: AIAccountFormData) {
    "use server";
    await updateAIAccount(id, data);
  }
  async function onDelete(id: string) {
    "use server";
    await deleteAIAccount(id);
  }

  return (
    <AIAccountForm
      accounts={accounts}
      projects={[projectOption]}
      users={users}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
