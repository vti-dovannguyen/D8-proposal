export function Spinner({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--vti-deep,#0A3CA8)]" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ title = "Đã xảy ra lỗi", onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 py-12 text-center">
      <p className="text-sm font-medium text-red-700">{title}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700">
          Thử lại
        </button>
      )}
    </div>
  );
}
