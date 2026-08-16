import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { AgentFormData } from "@/types/community";
import { createAgent } from "../actions";
import { NewAgentForm } from "./form";

export default async function NewAgentPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "content:edit")) redirect("/agents");

  async function action(data: AgentFormData) {
    "use server";
    return createAgent(data);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tạo AI Agent</h1>
        <p className="mt-1 text-sm text-slate-500">Khai báo agent nội bộ theo use case, category và prompt vận hành.</p>
      </div>
      <NewAgentForm onSubmit={action} />
    </div>
  );
}
