import Link from "next/link";
import { Clock3 } from "lucide-react";
import { db } from "@/lib/db";

export async function RecentActivity() {
  const meetings = await db.meeting.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { owner: true },
  });
  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/85 p-5 shadow-[var(--sh-1)] backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-[var(--vti-warm,#F7F0E7)] text-[var(--vti-sepia,#8A5A32)]">
          <Clock3 size={19} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Timeline</p>
          <h2 className="text-base font-semibold text-slate-950">Hoạt động gần đây</h2>
        </div>
      </div>
      <ul className="space-y-0 text-sm">
        {meetings.map((m, index) => (
          <li key={m.id} className="relative grid grid-cols-[1rem_1fr] gap-3 pb-4 last:pb-0">
            {index !== meetings.length - 1 && <span className="absolute left-[0.3rem] top-4 h-full w-px bg-[var(--vti-line,#E7DED2)]" />}
            <span className="relative mt-1.5 size-2.5 rounded-full border-2 border-white bg-[var(--vti-olive,#5F6F52)] shadow-sm" />
            <div className="min-w-0 rounded-lg bg-[var(--vti-porcelain,#FFFCF7)] px-3 py-2">
              <Link href={`/meetings/${m.id}`} className="font-medium text-slate-800 hover:text-[var(--vti-deep,#0A3CA8)]">
                {m.week} · {m.section}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">{m.owner.name}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
