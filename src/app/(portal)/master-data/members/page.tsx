import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { EMPLOYEE_TYPE_LABELS, type EmployeeType } from "@/types";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [users, total] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      ...paginationArgs(page),
      select: { id: true, name: true, email: true, section: true, employeeType: true, _count: { select: { userSkills: true, certificates: true } } },
    }),
    db.user.count(),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Hồ sơ thành viên</h1>
          <p className="portal-page-subtitle">Quản lý skills và chứng chỉ của từng thành viên.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{total} user</span>
          <ReloadButton />
        </div>
      </div>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Skills</th><th>Chứng chỉ</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold text-slate-900">{u.name}</td>
                <td className="portal-table-muted">{u.email}</td>
                <td>{u.section ?? "-"}</td>
                <td>
                  <span className={`portal-pill ${u.employeeType === "INTERN" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {EMPLOYEE_TYPE_LABELS[u.employeeType as EmployeeType]}
                  </span>
                </td>
                <td>{u._count.userSkills}</td>
                <td>{u._count.certificates}</td>
                <td className="text-right"><Link href={`/master-data/members/${u.id}`} className="text-[var(--vti-deep,#0A3CA8)]">Quản lý</Link></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Không có user</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/master-data/members" params={sp} page={page} total={total} />
    </div>
  );
}
