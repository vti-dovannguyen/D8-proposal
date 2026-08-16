"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import Select from "react-select";
import { REPO_PROVIDERS, PM_TOOLS } from "@/lib/master-data";
import type { ProjectFormData } from "./actions";
import type { AllocationInput } from "@/lib/projects";
import { ImportProjects } from "./import-projects";

type PersonOption = { value: string; label: string };

type Person = { id: string; name: string };
type SkillOpt = { id: string; name: string };
type AllocRow = { userId: string | null; role: string; skillId: string | null; hoursPerDay: number };
type ProjectRow = Omit<ProjectFormData, "accessKey" | "allocations"> & {
  id: string;
  hasAccessKey: boolean;
  allocationCount: number;
  allocations: AllocRow[];
};

const EMPTY: ProjectFormData = {
  name: "", code: "", category: "", section: "", active: true, hasSubProjects: false, description: "",
  picPmIds: [], startDate: "", endDate: "", budgetedEffortMM: "",
  repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "", allocations: [],
};

const REPO_LABELS: Record<string, string> = { github: "GitHub", gitlab: "GitLab" };
const PM_LABELS: Record<string, string> = { redmine: "Redmine", backlog: "Backlog" };
const PAGE_SIZE = 10;

type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

export function ProjectForm({
  projects, categories, sections, users, skills, roles, canManage, currentUserId, onCreate, onUpdate, onDelete, onImport,
}: {
  projects: ProjectRow[];
  categories: string[];
  sections: string[];
  users: Person[];
  skills: SkillOpt[];
  roles: string[];
  // Managers can create/delete/import and edit any project. A PM (canManage
  // false) may only edit — never create/delete/import — and only the
  // project(s) already scoped to them by the server (they're PIC PM on).
  canManage: boolean;
  currentUserId: string;
  onCreate: (data: ProjectFormData) => Promise<void>;
  onUpdate: (id: string, data: ProjectFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (formData: FormData) => Promise<ImportResult>;
}) {
  const emptyForm: ProjectFormData = { ...EMPTY, category: categories[0] ?? "", section: sections[1] ?? sections[0] ?? "" };
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const showForm = canManage || editingId !== null;
  const [editingHasKey, setEditingHasKey] = useState(false);
  const [page, setPage] = useState(1);
  const [picPmFilter, setPicPmFilter] = useState("");
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const filteredProjects = projects.filter((p) => {
    if (picPmFilter && !p.picPmIds.includes(picPmFilter)) return false;
    const keyword = search.trim().toLowerCase();
    if (keyword && !p.name.toLowerCase().includes(keyword) && !p.code.toLowerCase().includes(keyword)) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const visibleProjects = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const userOptions: PersonOption[] = users.map((u) => ({ value: u.id, label: u.name }));
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  const userNames = (ids: string[]) => (ids.length ? ids.map(userName).join(", ") : "—");
  const canEditRow = (p: ProjectRow) => canManage || p.picPmIds.includes(currentUserId);
  const set = <K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dateRangeInvalid = Boolean(form.startDate && form.endDate && form.startDate >= form.endDate);

  const setAlloc = <K extends keyof AllocationInput>(i: number, key: K, value: AllocationInput[K]) =>
    setForm((f) => {
      const next = f.allocations.slice();
      next[i] = { ...next[i], [key]: value };
      return { ...f, allocations: next };
    });
  const addAlloc = () => setForm((f) => ({ ...f, allocations: [...f.allocations, { userId: "", role: roles[0] ?? "", skillId: "", hoursPerDay: 8 }] }));
  const removeAlloc = (i: number) => setForm((f) => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) }));

  function edit(project: ProjectRow) {
    setEditingId(project.id);
    setEditingHasKey(project.hasAccessKey);
    setForm({
      name: project.name, code: project.code, category: project.category, section: project.section,
      active: project.active, hasSubProjects: project.hasSubProjects, description: project.description, picPmIds: project.picPmIds,
      startDate: project.startDate, endDate: project.endDate, budgetedEffortMM: project.budgetedEffortMM,
      repoProvider: project.repoProvider,
      repoUrl: project.repoUrl, pmTool: project.pmTool, pmUrl: project.pmUrl, accessKey: "",
      allocations: project.allocations.map((a) => ({ userId: a.userId ?? "", role: a.role, skillId: a.skillId ?? "", hoursPerDay: a.hoursPerDay })),
    });
  }

  function reset() {
    setEditingId(null);
    setEditingHasKey(false);
    setForm(emptyForm);
  }

  const inputCls = "mt-1 w-full rounded border px-2 py-1";

  return (
    <div className="space-y-5">
      {showForm && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (editingId) await onUpdate(editingId, form);
            else await onCreate(form);
            reset();
          });
        }}
        className="space-y-4 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-5 shadow-[var(--sh-1)]"
      >
        <h2 className="text-sm font-semibold text-slate-950">{editingId ? "Sửa dự án" : "Tạo dự án"}</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">Project name<input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="block text-sm">Code<input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} /></label>
          <label className="block text-sm">Category
            <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-sm">Section
            <select className={inputCls} value={form.section} onChange={(e) => set("section", e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="block text-sm">
            <label htmlFor="pic-pm-select-input" className="mb-1 block">PIC PM</label>
            <Select<PersonOption, true>
              inputId="pic-pm-select-input"
              instanceId="pic-pm-select"
              isMulti
              className="text-sm"
              classNamePrefix="pic-pm"
              placeholder="Tìm và chọn PM..."
              noOptionsMessage={() => "Không tìm thấy"}
              options={userOptions}
              value={userOptions.filter((o) => form.picPmIds.includes(o.value))}
              onChange={(selected) => set("picPmIds", selected.map((o) => o.value))}
            />
          </div>
        </div>

        <label className="block text-sm">Description<textarea rows={2} className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">Start date
            <input type="date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="block text-sm">End date
            <input type="date" className={inputCls} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            {dateRangeInvalid && <p className="mt-1 text-xs text-red-500">End date phải sau Start date.</p>}
          </label>
          <label className="block text-sm">Budgeted Effort (MM)
            <input type="number" step="0.01" min="0" className={inputCls} value={form.budgetedEffortMM} onChange={(e) => set("budgetedEffortMM", e.target.value)} />
          </label>
        </div>

        <fieldset className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Source code & quản lý dự án</legend>
          <label className="block text-sm">Source code
            <select className={inputCls} value={form.repoProvider} onChange={(e) => set("repoProvider", e.target.value)}>
              <option value="">—</option>
              {REPO_PROVIDERS.map((p) => <option key={p} value={p}>{REPO_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-1 lg:col-span-2">Repository URL
            <input type="url" placeholder="https://github.com/org/repo" className={inputCls} value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} />
          </label>
          <label className="block text-sm">Quản lý dự án
            <select className={inputCls} value={form.pmTool} onChange={(e) => set("pmTool", e.target.value)}>
              <option value="">—</option>
              {PM_TOOLS.map((t) => <option key={t} value={t}>{PM_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-1 lg:col-span-2">Link dự án
            <input type="url" placeholder="https://redmine.example.com/projects/abc" className={inputCls} value={form.pmUrl} onChange={(e) => set("pmUrl", e.target.value)} />
          </label>
          <label className="block text-sm lg:col-span-3">Access key (AI MCP health check)
            <input type="password" autoComplete="off" placeholder={editingHasKey ? "•••••••• (đã có — để trống nếu giữ nguyên)" : "Nhập access key / token"} className={inputCls} value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} />
          </label>
        </fieldset>

        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Phân bổ nguồn lực</h3>
            <button type="button" onClick={addAlloc} className="text-sm text-[var(--vti-deep,#0A3CA8)]">+ Thêm dòng</button>
          </div>
          <div className="portal-table-card shadow-none">
            <table className="portal-table min-w-[720px]">
              <thead><tr><th>Member</th><th>Vai trò</th><th>Skill</th><th>Giờ/ngày</th><th></th></tr></thead>
              <tbody>
                {form.allocations.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.userId} onChange={(e) => setAlloc(i, "userId", e.target.value)}>
                        <option value="">— Chưa gán —</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.role} onChange={(e) => setAlloc(i, "role", e.target.value)}>
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="w-full rounded border px-1 py-0.5" value={a.skillId} onChange={(e) => setAlloc(i, "skillId", e.target.value)}>
                        <option value="">— Không —</option>
                        {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" step="0.5" min="0" max="24" className="w-20 rounded border px-1 py-0.5" value={a.hoursPerDay} onChange={(e) => setAlloc(i, "hoursPerDay", Number(e.target.value))} />
                    </td>
                    <td><button type="button" className="text-xs font-semibold text-red-500" onClick={() => removeAlloc(i)}>Xóa</button></td>
                  </tr>
                ))}
                {form.allocations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-400">Chưa có dòng phân bổ nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm" title="Weekly Report của dự án này sẽ dùng form chi tiết theo nhóm/sub-project">
              <input type="checkbox" checked={form.hasSubProjects} onChange={(e) => set("hasSubProjects", e.target.checked)} />
              Có nhiều sub-project
            </label>
          </div>
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-1.5 text-sm">Hủy</button>}
            <button type="submit" disabled={pending || dateRangeInvalid} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo"}
            </button>
          </div>
        </div>
      </form>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Tìm dự án theo tên hoặc code..."
            className="w-64 rounded border px-2 py-1 text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <label htmlFor="pic-pm-filter-input">Lọc theo PIC PM</label>
            <Select<PersonOption, false>
              inputId="pic-pm-filter-input"
              instanceId="pic-pm-filter"
              isClearable
              className="w-56 text-sm"
              classNamePrefix="pic-pm-filter"
              placeholder="Tất cả"
              noOptionsMessage={() => "Không tìm thấy"}
              options={userOptions}
              value={userOptions.find((o) => o.value === picPmFilter) ?? null}
              onChange={(selected) => { setPicPmFilter(selected?.value ?? ""); setPage(1); }}
            />
          </div>
          {canManage && <ImportProjects onImport={onImport} />}
        </div>
        <span className="text-sm text-slate-500">{filteredProjects.length} project</span>
      </div>

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th className="px-4 py-2">Project</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Section</th><th className="px-4 py-2">PIC PM</th><th className="px-4 py-2">Nguồn lực</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {visibleProjects.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td>
                  <Link href={`/projects/${p.id}`} className="font-semibold text-slate-950 hover:text-[var(--vti-deep,#0A3CA8)] hover:underline">{p.name}</Link>
                  <div className="portal-table-muted">{p.code || "No code"}</div>
                  {(p.repoUrl || p.pmUrl || p.hasAccessKey) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{REPO_LABELS[p.repoProvider] ?? "Repo"} ↗</a>}
                      {p.pmUrl && <a href={p.pmUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--vti-deep,#0A3CA8)] hover:underline">{PM_LABELS[p.pmTool] ?? "PM"} ↗</a>}
                      {p.hasAccessKey && <span className="portal-pill bg-amber-50 text-amber-700">🔑 key</span>}
                    </div>
                  )}
                </td>
                <td>
                  <span className="portal-pill bg-blue-50 text-blue-700">{p.category}</span>
                  {p.hasSubProjects && <span className="ml-1 portal-pill bg-violet-50 text-violet-700">Sub-project</span>}
                </td>
                <td><span className="portal-pill bg-slate-100 text-slate-600">{p.section}</span></td>
                <td className="portal-table-muted">{userNames(p.picPmIds)}</td>
                <td><span className="portal-pill bg-violet-50 text-violet-700">{p.allocationCount} nguồn lực</span></td>
                <td><span className={"portal-pill " + (p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{p.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right">
                  {canEditRow(p) && <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => edit(p)}>Edit</button>}
                  {canManage && <button type="button" className="text-red-600" onClick={() => start(() => onDelete(p.id))}>Delete</button>}
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No projects yet</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-[#dbe3ef] px-4 py-3 text-sm text-slate-600">
          <span>Hiển thị {filteredProjects.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(filteredProjects.length, page * PAGE_SIZE)} / {filteredProjects.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Trước</button>
            <span className="font-semibold text-slate-900">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Sau</button>
          </div>
        </div>
      </div>
    </div>
  );
}
