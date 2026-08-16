import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { rankAwards, formatMonth } from "@/lib/point-award";
import { ReloadButton } from "@/components/ui/reload-button";
import { PointAwardBoard, type BoardRow } from "./point-award-board";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PointAwardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canManage = can(session.user.role, "point:award");

  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? (sp.month as string) : currentMonth();

  const awards = await db.pointAward.findMany({
    where: { month },
    include: { user: { select: { name: true, image: true } }, project: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  const toRows = (kind: "PERSON" | "PROJECT"): BoardRow[] =>
    rankAwards(awards.filter((a) => a.type === kind)).map((a) => ({
      id: a.id,
      name: kind === "PERSON" ? a.user?.name ?? "N/A" : a.project?.name ?? "N/A",
      image: kind === "PERSON" ? a.user?.image ?? null : null,
      points: a.points,
      reason: a.reason,
      awarder: a.createdBy?.name ?? "",
    }));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Point Award</h1>
          <p className="portal-page-subtitle">Bảng xếp hạng điểm thưởng — {formatMonth(month)}.</p>
        </div>
        <div className="flex items-center gap-3">
          <form>
            <input type="month" name="month" defaultValue={month}
              className="h-10 rounded-lg border border-[#dbe3ef] bg-white px-3 text-sm" />
          </form>
          <ReloadButton />
          {canManage && (
            <Link href="/point-award/new"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 text-sm font-semibold text-white">
              ＋ Tạo thưởng
            </Link>
          )}
        </div>
      </div>

      <PointAwardBoard person={toRows("PERSON")} project={toRows("PROJECT")} canManage={canManage} />
    </div>
  );
}
