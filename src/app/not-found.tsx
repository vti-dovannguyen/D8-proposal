import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-center">
      <p className="text-2xl font-semibold text-slate-900">404</p>
      <p className="text-sm text-slate-500">Không tìm thấy trang.</p>
      <Link href="/" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white">Về trang chủ</Link>
    </main>
  );
}
