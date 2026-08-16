import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div className="rounded-xl border bg-white py-16 text-center">
      <p className="text-lg font-semibold text-slate-900">Không tìm thấy trang</p>
      <p className="mt-1 text-sm text-slate-500">Nội dung bạn tìm không tồn tại hoặc đã bị xóa.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white">Về trang chủ</Link>
    </div>
  );
}
