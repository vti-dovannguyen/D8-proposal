"use client";
import { useActionState } from "react";
import { credentialsSignIn } from "./actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(credentialsSignIn, "");
  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label htmlFor="email" className="text-xs font-medium text-slate-600">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="ten@vti.com.vn"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-xs font-medium text-slate-600">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--vti-deep,#0A3CA8)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
