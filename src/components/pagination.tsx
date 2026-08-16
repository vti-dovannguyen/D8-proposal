import Link from "next/link";

const DEFAULT_PAGE_SIZE = 10;

export function parsePage(value: string | undefined) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function paginationArgs(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function totalPages(total: number, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function hrefFor(basePath: string, params: Record<string, string | undefined>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") next.set(key, value);
  }
  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const pages = totalPages(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbe3ef] bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <span>
        Hiển thị {from}-{to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(basePath, params, Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={"rounded-lg border px-3 py-1.5 font-semibold " + (page <= 1 ? "pointer-events-none text-slate-300" : "hover:bg-slate-50")}
        >
          Trước
        </Link>
        <span className="font-semibold text-slate-900">
          {page} / {pages}
        </span>
        <Link
          href={hrefFor(basePath, params, Math.min(pages, page + 1))}
          aria-disabled={page >= pages}
          className={"rounded-lg border px-3 py-1.5 font-semibold " + (page >= pages ? "pointer-events-none text-slate-300" : "hover:bg-slate-50")}
        >
          Sau
        </Link>
      </div>
    </div>
  );
}
