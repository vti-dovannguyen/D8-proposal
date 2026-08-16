import { Megaphone, Pin } from "lucide-react";
import { db } from "@/lib/db";
import { activeAnnouncementWhere, htmlToText } from "@/lib/announcements";

export async function AnnouncementList() {
  const items = await db.announcement.findMany({
    where: activeAnnouncementWhere(),
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
    include: { author: true },
  });
  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/85 p-5 shadow-[var(--sh-1)] backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-[var(--vti-warm,#F7F0E7)] text-[var(--vti-sepia,#8A5A32)]">
          <Megaphone size={19} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Broadcasts</p>
          <h2 className="text-base font-semibold text-slate-950">Thông báo</h2>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-[var(--vti-porcelain,#FFFCF7)] p-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--vti-copper,#B7793B)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      <Pin size={12} />
                      Ghim
                    </span>
                  )}
                  <span className="font-semibold text-slate-950">{a.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-600">{htmlToText(a.body)}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">{a.author.name}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
