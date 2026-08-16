import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { MeetingStatus } from "@/generated/prisma/enums";

export async function MeetingStatusWidget() {
  const [draft, open, closed] = await Promise.all([
    db.meeting.count({ where: { status: MeetingStatus.DRAFT } }),
    db.meeting.count({ where: { status: MeetingStatus.OPEN } }),
    db.meeting.count({ where: { status: MeetingStatus.CLOSED } }),
  ]);
  const recent = await db.meeting.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { owner: true },
  });

  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/85 p-5 shadow-[var(--sh-1)] backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-[var(--vti-warm,#F7F0E7)] text-[var(--vti-sepia,#8A5A32)]">
          <ClipboardList size={19} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Weekly pulse</p>
          <h2 className="text-base font-semibold text-slate-950">Trạng thái Weekly Report</h2>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Draft" value={draft} tone="bg-slate-100 text-slate-700" />
        <Stat label="Open" value={open} tone="bg-blue-50 text-blue-700" />
        <Stat label="Closed" value={closed} tone="bg-emerald-50 text-emerald-700" />
      </div>
      <ul className="mt-5 divide-y divide-[var(--vti-line,#E7DED2)] rounded-lg border border-[var(--vti-line,#E7DED2)] bg-[var(--vti-porcelain,#FFFCF7)] text-sm">
        {recent.map((m) => (
          <li key={m.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/meetings/${m.id}`} className="font-medium text-[var(--vti-deep,#0A3CA8)] hover:text-[var(--vti-deep-hover,#082F86)]">
              {m.week} · {m.section}
            </Link>
            <span className="text-xs font-medium text-slate-500">
              {m.status} · {m.owner.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 text-center shadow-sm">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className={`mt-2 rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{label}</div>
    </div>
  );
}
