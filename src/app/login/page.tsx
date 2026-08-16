import { signIn } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[var(--vti-ink,#0B1B3B)] text-white">
      <div className="w-full max-w-sm rounded-xl bg-white text-slate-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold">PM Sharing Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Division D8 — VTI Group</p>
        {/* <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Đăng nhập với Google
          </button>
        </form> */}
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
          {/* <div className="h-px flex-1 bg-slate-200" />
          hoặc
          <div className="h-px flex-1 bg-slate-200" /> */}
        </div>
        <LoginForm />
        <p className="mt-4 text-xs text-slate-400">
          Chỉ dành cho email @vti.com.vn
        </p>
      </div>
    </main>
  );
}
