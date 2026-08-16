"use client";

import { useState, useTransition } from "react";
import type { ProjectOption } from "@/lib/master-data";
import type { AIAccountFormData } from "./actions";

type UserOption = { id: string; name: string; email: string };
type AIAccountRow = AIAccountFormData & { id: string; memberNames: string[]; assignedToName: string };

const PROVIDERS = ["OpenAI", "Azure OpenAI", "Anthropic", "Google Gemini", "AWS Bedrock", "Other"];
const ACCOUNT_TYPES = ["Team", "Enterprise", "Individual", "API Key", "Trial"];
const SUBSCRIPTION_TYPES = ["Monthly", "Annual", "Pay-as-you-go", "Trial", "One-time"];
const STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED", "SUSPENDED"];
const PAGE_SIZE = 10;

const EMPTY: AIAccountFormData = {
  email: "",
  provider: PROVIDERS[0],
  accountType: ACCOUNT_TYPES[0],
  project: "",
  assignedToId: "",
  memberIds: [],
  purchaseDate: "",
  cost: "",
  currency: "USD",
  subscriptionType: SUBSCRIPTION_TYPES[0],
  status: "ACTIVE",
  notes: "",
};

export function AIAccountForm({
  accounts,
  projects,
  users,
  onCreate,
  onUpdate,
  onDelete,
}: {
  accounts: AIAccountRow[];
  projects: ProjectOption[];
  users: UserOption[];
  onCreate: (data: AIAccountFormData) => Promise<void>;
  onUpdate: (id: string, data: AIAccountFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<AIAccountFormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();
  const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const visibleAccounts = accounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const set = <K extends keyof AIAccountFormData>(key: K, value: AIAccountFormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function edit(account: AIAccountRow) {
    setEditingId(account.id);
    setForm({
      email: account.email,
      provider: account.provider,
      accountType: account.accountType,
      project: account.project,
      assignedToId: account.assignedToId,
      memberIds: account.memberIds,
      purchaseDate: account.purchaseDate,
      cost: account.cost,
      currency: account.currency,
      subscriptionType: account.subscriptionType,
      status: account.status,
      notes: account.notes,
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[28rem_1fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            if (editingId) await onUpdate(editingId, form);
            else await onCreate(form);
            reset();
          });
        }}
        className="space-y-4 rounded-xl border border-[#dbe3ef] bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-bold text-slate-950">{editingId ? "Update AI account" : "Create AI account"}</h2>
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" value={form.email} onChange={(event) => set("email", event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="LLM provider" value={form.provider} options={PROVIDERS} onChange={(value) => set("provider", value)} />
          <Select label="Account type" value={form.accountType} options={ACCOUNT_TYPES} onChange={(value) => set("accountType", value)} />
          <label className="block text-sm font-semibold text-slate-700">
            Project
            <select className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={form.project} onChange={(event) => set("project", event.target.value)}>
              <option value="">No project</option>
              {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Người phụ trách
            <select className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={form.assignedToId} onChange={(event) => set("assignedToId", event.target.value)}>
              <option value="">— Chưa gán —</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
          <Select label="Subscription" value={form.subscriptionType} options={SUBSCRIPTION_TYPES} onChange={(value) => set("subscriptionType", value)} />
          <label className="block text-sm font-semibold text-slate-700">
            Purchase date
            <input type="date" className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" value={form.purchaseDate} onChange={(event) => set("purchaseDate", event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Cost
            <input type="number" min="0" step="0.01" className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" value={form.cost} onChange={(event) => set("cost", event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Currency
            <input className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] px-3 text-sm" value={form.currency} onChange={(event) => set("currency", event.target.value)} />
          </label>
          <Select label="Status" value={form.status} options={STATUSES} onChange={(value) => set("status", value)} />
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Members using account
          <select
            multiple
            className="mt-1.5 min-h-32 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 py-2 text-sm"
            value={form.memberIds}
            onChange={(event) => set("memberIds", Array.from(event.target.selectedOptions).map((option) => option.value))}
          >
            {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Notes
          <textarea rows={3} className="mt-1.5 w-full rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm" value={form.notes} onChange={(event) => set("notes", event.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          {editingId && <button type="button" onClick={reset} className="rounded-lg border px-3 py-2 text-sm font-semibold">Cancel</button>}
          <button disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {pending ? "Saving..." : editingId ? "Update" : "Create"}
          </button>
        </div>
      </form>

      <div className="portal-table-card">
        <table className="portal-table">
          <thead>
            <tr><th>Email</th><th>Provider</th><th>Project</th><th>Người phụ trách</th><th>Members</th><th>Cost</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {visibleAccounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <div className="font-semibold text-slate-950">{account.email}</div>
                  <div className="portal-table-muted">{account.accountType} · {account.subscriptionType}</div>
                </td>
                <td><span className="portal-pill bg-blue-50 text-blue-700">{account.provider}</span></td>
                <td className="portal-table-muted">{account.project || "-"}</td>
                <td className="portal-table-muted">{account.assignedToName || "-"}</td>
                <td className="portal-table-muted">{account.memberNames.join(", ") || "-"}</td>
                <td className="portal-table-muted">{account.cost ? `${account.cost} ${account.currency}` : "-"}</td>
                <td><span className={"portal-pill " + (account.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{account.status}</span></td>
                <td className="text-right">
                  <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => edit(account)}>Edit</button>
                  <button type="button" className="text-red-600" onClick={() => start(() => onDelete(account.id))}>Delete</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No AI accounts yet</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-[#dbe3ef] px-4 py-3 text-sm text-slate-600">
          <span>Showing {accounts.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(accounts.length, page * PAGE_SIZE)} / {accounts.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Previous</button>
            <span className="font-semibold text-slate-900">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border px-3 py-1.5 font-semibold disabled:text-slate-300">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select className="mt-1.5 h-10 w-full rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
