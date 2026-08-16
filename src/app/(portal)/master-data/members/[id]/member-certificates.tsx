"use client";
import { useRef, useTransition } from "react";
import { addUserCertificate, deleteUserCertificate } from "./actions";

export type UserCertRow = { id: string; typeName: string; issuer: string; issuedAt: string; expiresAt: string; credentialId: string; downloadUrl: string };
type TypeOption = { id: string; name: string };

export function MemberCertificates({ userId, current, options }: { userId: string; current: UserCertRow[]; options: TypeOption[] }) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Chứng chỉ</h2>
      <ul className="mb-3 space-y-1">
        {current.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span>{c.typeName}{c.issuer ? ` — ${c.issuer}` : ""}{c.issuedAt ? ` (${c.issuedAt}${c.expiresAt ? ` → ${c.expiresAt}` : ""})` : ""}</span>
            <span className="flex items-center gap-2">
              {c.downloadUrl && <a href={c.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--vti-deep,#0A3CA8)]">tải file</a>}
              <button type="button" className="text-xs text-red-500" onClick={() => start(() => deleteUserCertificate(c.id, userId))}>xóa</button>
            </span>
          </li>
        ))}
        {current.length === 0 && <li className="text-sm text-slate-400">Chưa có chứng chỉ</li>}
      </ul>
      <form
        ref={formRef}
        className="grid gap-2 sm:grid-cols-2"
        action={(fd) => start(async () => { await addUserCertificate(userId, fd); formRef.current?.reset(); })}
      >
        <select name="typeId" required className="rounded border px-2 py-1 text-sm">
          <option value="">Chọn loại chứng chỉ…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input name="issuer" placeholder="Nơi cấp" className="rounded border px-2 py-1 text-sm" />
        <label className="text-xs text-slate-500">Ngày cấp<input name="issuedAt" type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
        <label className="text-xs text-slate-500">Hết hạn<input name="expiresAt" type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
        <input name="credentialId" placeholder="Mã chứng chỉ" className="rounded border px-2 py-1 text-sm" />
        <input name="file" type="file" className="text-sm" />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">Thêm chứng chỉ</button>
      </form>
    </section>
  );
}
