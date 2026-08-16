"use client";
import { useState, useTransition } from "react";
import { REPO_PROVIDERS, PM_TOOLS } from "@/lib/master-data";
import { updateProjectIntegration, type IntegrationFormData } from "../actions";

const REPO_LABELS: Record<string, string> = { github: "GitHub", gitlab: "GitLab" };
const PM_LABELS: Record<string, string> = { redmine: "Redmine", backlog: "Backlog" };

export function IntegrationTab({ projectId, initial, hasAccessKey, canEdit }: {
  projectId: string;
  initial: IntegrationFormData;
  hasAccessKey: boolean;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<IntegrationFormData>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof IntegrationFormData>(k: K, v: IntegrationFormData[K]) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };
  const inputCls = "mt-1 w-full rounded border px-2 py-1 text-sm";

  if (!canEdit) {
    return (
      <div className="space-y-2 text-sm">
        <p>Source code: {initial.repoUrl ? <a className="text-[var(--vti-deep,#0A3CA8)] hover:underline" href={initial.repoUrl} target="_blank" rel="noopener noreferrer">{REPO_LABELS[initial.repoProvider] ?? "Repo"} ↗</a> : "-"}</p>
        <p>Quản lý dự án: {initial.pmUrl ? <a className="text-[var(--vti-deep,#0A3CA8)] hover:underline" href={initial.pmUrl} target="_blank" rel="noopener noreferrer">{PM_LABELS[initial.pmTool] ?? "PM"} ↗</a> : "-"}</p>
        <p>Access key: {hasAccessKey ? "đã cấu hình" : "chưa có"}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => { await updateProjectIntegration(projectId, form); setSaved(true); }); }}
      className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)] sm:grid-cols-2 lg:grid-cols-3"
    >
      <label className="block text-sm">Source code
        <select className={inputCls} value={form.repoProvider} onChange={(e) => set("repoProvider", e.target.value)}>
          <option value="">—</option>
          {REPO_PROVIDERS.map((p) => <option key={p} value={p}>{REPO_LABELS[p]}</option>)}
        </select>
      </label>
      <label className="block text-sm lg:col-span-2">Repository URL<input type="url" className={inputCls} value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/org/repo" /></label>
      <label className="block text-sm">Quản lý dự án
        <select className={inputCls} value={form.pmTool} onChange={(e) => set("pmTool", e.target.value)}>
          <option value="">—</option>
          {PM_TOOLS.map((t) => <option key={t} value={t}>{PM_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="block text-sm lg:col-span-2">Link dự án<input type="url" className={inputCls} value={form.pmUrl} onChange={(e) => set("pmUrl", e.target.value)} placeholder="https://redmine.example.com/projects/abc" /></label>
      <label className="block text-sm lg:col-span-3">Access key (AI MCP health check)
        <input type="password" autoComplete="off" className={inputCls} value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} placeholder={hasAccessKey ? "•••• (đã có — để trống nếu giữ nguyên)" : "Nhập access key / token"} />
      </label>
      <div className="flex items-center justify-end gap-3 lg:col-span-3">
        {saved && <span className="text-sm text-emerald-600">Đã lưu</span>}
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Đang lưu..." : "Lưu"}</button>
      </div>
    </form>
  );
}
