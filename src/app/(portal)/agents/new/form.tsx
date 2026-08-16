"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AgentFormData } from "@/types/community";

export function NewAgentForm({ onSubmit }: { onSubmit: (data: AgentFormData) => Promise<{ id: string }> }) {
  const router = useRouter();
  const [form, setForm] = useState<AgentFormData>({
    name: "",
    description: "",
    useCase: "",
    prompt: "",
    category: "Chung",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          try {
            const created = await onSubmit(form);
            router.push(`/agents/${created.id}`);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo agent. Vui lòng thử lại.");
          }
        });
      }}
      className="space-y-3 rounded-xl border bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Tên
          <input className="mt-1 w-full rounded border px-2 py-1" value={form.name} onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="text-sm">
          Danh mục
          <input className="mt-1 w-full rounded border px-2 py-1" value={form.category} onChange={(event) => set("category", event.target.value)} />
        </label>
        <label className="text-sm">
          Mô tả
          <input className="mt-1 w-full rounded border px-2 py-1" value={form.description} onChange={(event) => set("description", event.target.value)} />
        </label>
        <label className="text-sm">
          Use case
          <input className="mt-1 w-full rounded border px-2 py-1" value={form.useCase} onChange={(event) => set("useCase", event.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        Prompt (hướng dẫn agent)
        <textarea rows={4} className="mt-1 w-full rounded border px-2 py-1" value={form.prompt} onChange={(event) => set("prompt", event.target.value)} />
      </label>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Đang tạo..." : "Tạo agent"}
        </button>
      </div>
    </form>
  );
}
