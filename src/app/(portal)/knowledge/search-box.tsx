export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/knowledge/search" method="get" className="flex gap-2">
      <input name="q" defaultValue={defaultValue ?? ""} placeholder="Tìm kiếm tài liệu, wiki…" className="w-full rounded-lg border px-3 py-1.5 text-sm" />
      <button type="submit" className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 text-sm font-medium text-white">Tìm</button>
    </form>
  );
}
