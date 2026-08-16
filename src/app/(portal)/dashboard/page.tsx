import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { rollingMonths, aggregateUnitReport, monthLabel, type ProjMonthRow } from "@/lib/unit-report";
import { MeetingStatusWidget } from "./meeting-status-widget";
import { BillableRaSection } from "./billable-ra-section";

export default async function DashboardPage() {
  const session = await auth();
  if (!can(session!.user.role, "dashboard:view")) redirect("/");

  const months = rollingMonths(new Date());
  const [details, projects, units] = await Promise.all([
    db.projectMonthlyDetail.findMany({
      where: { month: { in: months } },
      select: {
        month: true, billableProject: true, calendarMember: true,
        calendarIntern: true, otMemberEffort: true, absent: true,
        project: { select: { name: true } },
      },
    }),
    db.project.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
    db.unitMonthly.findMany({ where: { month: { in: months } } }),
  ]);

  const rows: ProjMonthRow[] = details.map((d) => ({
    project: d.project.name, month: d.month, billableProject: d.billableProject,
    calendarMember: d.calendarMember, calendarIntern: d.calendarIntern,
    otMemberEffort: d.otMemberEffort, absent: d.absent,
  }));
  const { projectRows, po, ee } = aggregateUnitReport(rows, months, projects.map((p) => p.name));
  const headcounts: Record<string, { lbQaOt: number; intern: number; official: number }> = {};
  for (const u of units) headcounts[u.month] = { lbQaOt: u.lbQaOt, intern: u.intern, official: u.official };
  const monthLabels = months.map((m) => monthLabel(m, months));
  const canEdit = can(session!.user.role, "project:manage");

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/82 p-6 shadow-[var(--sh-1)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vti-sepia,#8A5A32)]">Operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Monitor weekly report flow and recent activity from a cleaner control surface.
        </p>
      </section>
      <BillableRaSection
        months={months}
        monthLabels={monthLabels}
        overview={{ ee, po }}
        projectRows={projectRows}
        headcounts={headcounts}
        canEdit={canEdit}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <MeetingStatusWidget />
      </div>
    </div>
  );
}
