import Link from "next/link";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = sp.category ? { category: sp.category } : {};
  const [agents, total, categories] = await Promise.all([
    db.aIAgent.findMany({ where, orderBy: { createdAt: "desc" }, include: { owner: true }, ...paginationArgs(page) }),
    db.aIAgent.count({ where }),
    db.aIAgent.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  const editable = can(session!.user.role, "content:edit");

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">AI Agents</h1>
          <p className="portal-page-subtitle">Danh sách agent nội bộ theo use case, category và owner.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <ReloadButton />
          {editable && <Link href="/agents/new" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Tạo agent</Link>}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="portal-chip-row">
          <Link href="/agents" className={"portal-chip " + (!sp.category ? "portal-chip-active" : "")}>Tất cả</Link>
          {categories.map((c) => (
            <Link key={c.category} href={`/agents?category=${encodeURIComponent(c.category)}`} className={"portal-chip " + (sp.category === c.category ? "portal-chip-active" : "")}>{c.category}</Link>
          ))}
        </div>
      )}

      <div className="flex justify-end text-sm text-slate-500">{total} agent</div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Agent</th><th>Category</th><th>Owner</th><th>Rating</th><th>Mô tả</th></tr></thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/agents/${a.id}`} className="portal-table-title">{a.name}</Link></td>
                <td><span className="portal-pill bg-indigo-100 text-indigo-700">{a.category}</span></td>
                <td>{a.owner.name}</td>
                <td className="portal-table-muted">★ {a.rating.toFixed(1)}</td>
                <td className="max-w-xl portal-table-muted">{a.description}</td>
              </tr>
            ))}
            {agents.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có agent nào</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/agents" params={sp} page={page} total={total} />
    </div>
  );
}
