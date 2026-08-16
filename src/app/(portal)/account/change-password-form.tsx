"use client";
import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: "", success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <div>
        <label htmlFor="currentPassword" className="text-xs font-medium text-slate-600">
          Mật khẩu hiện tại
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="text-xs font-medium text-slate-600">
          Mật khẩu mới
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-600">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Đổi mật khẩu thành công.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
