"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-center">
        <p className="text-2xl font-semibold text-slate-900">Đã xảy ra lỗi</p>
        <p className="text-sm text-slate-500">Hệ thống gặp sự cố. Vui lòng tải lại trang.</p>
        <button onClick={reset} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white">Tải lại</button>
      </body>
    </html>
  );
}
