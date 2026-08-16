import { redirect } from "next/navigation";
import { Pagination, paginationArgs, parsePage } from "@/components/pagination";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCategoryValues } from "@/lib/master-data-db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { EMPLOYEE_TYPES, EMPLOYEE_TYPE_LABELS, type EmployeeType } from "@/types";
import { RoleSelect } from "./role-select";
import { ImportUsers } from "./import-users";
import { ResetPasswordButton } from "./reset-password-button";

function fmtDate(d: Date | null) { return d ? d.toISOString().slice(0, 10) : "-"; }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ role?: string; section?: string; employeeType?: string; page?: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "admin:access")) redirect("/");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const roleValues = Object.values(Role);
  const where = {
    ...(sp.role && roleValues.includes(sp.role as Role) ? { role: sp.role as Role } : {}),
    ...(sp.section ? { section: sp.section } : {}),
    ...(sp.employeeType && EMPLOYEE_TYPES.includes(sp.employeeType as EmployeeType) ? { employeeType: sp.employeeType as EmployeeType } : {}),
  };
  const [users, total, sections] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "asc" }, ...paginationArgs(page) }),
    db.user.count({ where }),
    getCategoryValues("MEETING_SECTION"),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý người dùng</h1>
          <p className="portal-page-subtitle">Phân quyền truy cập portal theo vai trò và section.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{total} user</span>
          <ReloadButton />
          <ImportUsers />
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-[#dbe3ef] bg-white p-4 shadow-sm md:grid-cols-4">
        <select name="role" defaultValue={sp.role ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi vai trò</option>
          {roleValues.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select name="section" defaultValue={sp.section ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi section</option>
          {sections.map((section) => <option key={section} value={section}>{section}</option>)}
        </select>
        <select name="employeeType" defaultValue={sp.employeeType ?? ""} className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm">
          <option value="">Mọi phân loại</option>
          {EMPLOYEE_TYPES.map((t) => <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t]}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="h-10 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-semibold text-white">Lọc</button>
          <a href="/admin" className="inline-flex h-10 items-center rounded-lg border border-[#dbe3ef] px-4 text-sm font-semibold text-slate-600">Reset</a>
        </div>
      </form>

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th>Tên</th><th>Email</th><th>Section</th><th>Phân loại</th><th>Giới tính</th><th>Ngày sinh</th><th>Vai trò</th><th>Mật khẩu</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-semibold text-slate-900">{user.name}</td>
                <td className="portal-table-muted">{user.email}</td>
                <td>{user.section ? <span className="portal-pill bg-slate-100 text-slate-600">{user.section}</span> : <span className="portal-table-muted">-</span>}</td>
                <td>
                  <span className={`portal-pill ${user.employeeType === "INTERN" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {EMPLOYEE_TYPE_LABELS[user.employeeType as EmployeeType]}
                  </span>
                </td>
                <td className="portal-table-muted">{user.gender ?? "-"}</td>
                <td className="portal-table-muted">{fmtDate(user.dateOfBirth)}</td>
                <td><RoleSelect userId={user.id} role={user.role} /></td>
                <td><ResetPasswordButton userId={user.id} /></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Không có user phù hợp</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/admin" params={sp} page={page} total={total} />
    </div>
  );
}
