import type { ReactNode } from "react";
import {
  CalendarCheck,
  ClipboardList,
  Lock,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditMeeting, eeTotals, formatDateOnlyRange, getEeNorm, milestoneStatusClass, projectStatusClass, SUMMARY_WEEKLY_CATEGORY } from "@/lib/meetings";
import { canManagePmMeeting } from "@/lib/projects";
import { shouldHideWeeklyReportFields } from "@/lib/permissions";
import { sanitizeMeetingRichTextHtml } from "@/lib/sanitize";
import { MeetingButtons } from "./meeting-buttons";
import { SummaryWeeklyReport } from "../summary-weekly-report";
import { queryWeeklySummaryReport } from "@/lib/weekly-summary-report";
import { buildWeeklySummaryMarkdown } from "@/lib/weekly-summary-export";
import { ExportMarkdownButton } from "@/components/ui/export-markdown-button";

type IssueItem = {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  owner: { name: string };
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date).replace(",", "");
}

function formatDateOnly(date: Date | null) {
  if (!date) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function statusLabel(status: string) {
  if (status === "CLOSED") return "Đã chốt";
  if (status === "OPEN") return "Đang mở";
  return "Bản nháp";
}

function statusClass(status: string) {
  if (status === "CLOSED") return "bg-slate-100 text-slate-600";
  if (status === "OPEN") return "bg-emerald-50 text-emerald-700";
  return "bg-amber-50 text-amber-700";
}

function severityLabel(severity: IssueItem["severity"]) {
  const labels = {
    LOW: "Thấp",
    MEDIUM: "Trung bình",
    HIGH: "Cao",
    CRITICAL: "Khẩn cấp",
  };
  return labels[severity];
}

function severityClass(severity: IssueItem["severity"]) {
  if (severity === "CRITICAL" || severity === "HIGH") return "bg-red-100 text-red-700";
  if (severity === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function varianceClass(value: number) {
  if (value < 0) return "text-blue-600";
  if (value > 0) return "text-amber-600";
  return "text-slate-500";
}

function formatVariance(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#dbe3ef] bg-white shadow-sm">
      <div className="flex min-h-9 items-center gap-2 border-b border-[#dbe3ef] px-4 py-2 text-sm font-semibold text-slate-950">
        <span className="text-blue-600">{icon}</span>
        <h2>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RichHtml({ html }: { html?: string | null }) {
  if (!html) return <p className="text-sm text-slate-400">Không có.</p>;
  return (
    <div
      className={
        // No overflow-x here on purpose: tables are normalized to fit the card
        // (see lib/rich-text-tables.ts), so nothing should ever scroll sideways.
        "space-y-2 break-words text-sm leading-6 text-slate-800 " +
        "[&_a]:font-semibold [&_a]:text-[var(--vti-deep,#0A3CA8)] " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-blue-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 " +
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 " +
        "[&_table]:my-2 [&_table]:w-full [&_table]:max-w-full [&_table]:table-fixed [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-[#dbe3ef] " +
        "[&_thead]:bg-slate-50 " +
        "[&_th]:border [&_th]:border-[#dbe3ef] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 [&_th]:break-words " +
        "[&_td]:border [&_td]:border-[#dbe3ef] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:break-words " +
        // A <pre> block can't be reflowed, so let it wrap rather than scroll.
        "[&_pre]:whitespace-pre-wrap [&_pre]:break-words " +
        "[&_details]:my-2 [&_details]:overflow-hidden [&_details]:rounded-lg [&_details]:border [&_details]:border-[#dbe3ef] " +
        "[&_summary]:cursor-pointer [&_summary]:bg-slate-50 [&_summary]:px-3 [&_summary]:py-2 [&_summary]:font-semibold [&_summary]:text-slate-900 " +
        "[&_.mce-accordion-body]:p-3"
      }
      dangerouslySetInnerHTML={{ __html: sanitizeMeetingRichTextHtml(html) }}
    />
  );
}

type MilestoneRow = { id: string; name: string; planDate: Date | null; status: string; note: string | null };
type RiskRow = { id: string; type: string; title: string; impact: IssueItem["severity"]; actionPlan: string | null; status: string; planDate: Date | null };

function MilestoneTable({ rows }: { rows: MilestoneRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Không có milestone.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="portal-table">
        <thead>
          <tr>
            <th>Milestone</th>
            <th>Plan Date</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ms) => (
            <tr key={ms.id}>
              <td className="font-semibold text-slate-950">{ms.name}</td>
              <td>{formatDateOnly(ms.planDate)}</td>
              <td><span className={`portal-pill ${milestoneStatusClass(ms.status)}`}>{ms.status}</span></td>
              <td className="portal-table-muted">{ms.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskTable({ rows }: { rows: RiskRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Không có issue/risk.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="portal-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Mitigation / Action</th>
            <th>Status</th>
            <th>Plan Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((risk) => (
            <tr key={risk.id}>
              <td><span className="portal-pill bg-slate-100 text-slate-600">{risk.type}</span></td>
              <td className="font-semibold text-slate-950">{risk.title}</td>
              <td><span className={`portal-pill ${severityClass(risk.impact)}`}>{severityLabel(risk.impact)}</span></td>
              <td className="portal-table-muted">{risk.actionPlan || "—"}</td>
              <td><span className="portal-pill bg-amber-50 text-amber-700">{risk.status}</span></td>
              <td>{formatDateOnly(risk.planDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type NextWeekPlanRow = { id: string; keyActivity: string; note: string | null };

function NextWeekPlanTable({ rows }: { rows: NextWeekPlanRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">Không có kế hoạch tuần tới.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="portal-table">
        <thead>
          <tr>
            <th>Key Activity</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="font-semibold text-slate-950">{p.keyActivity}</td>
              <td className="portal-table-muted">{p.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuePanel({ title, issues }: { title: string; issues: IssueItem[] }) {
  return (
    <SectionCard title={title} icon={<TriangleAlert size={15} />}>
      {issues.length === 0 ? (
        <p className="text-sm text-slate-400">Không có issue.</p>
      ) : (
        <ul className="space-y-4">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-3">
              <span className={`portal-pill mt-0.5 ${severityClass(issue.severity)}`}>{severityLabel(issue.severity)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{issue.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Phụ trách: {issue.owner.name} · {issue.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const m = await db.meeting.findUnique({
    where: { id },
    include: {
      owner: true,
      project: { include: { picPms: { select: { id: true } } } },
      eeRows: true,
      raRows: true,
      risks: true,
      milestones: true,
      nextWeekPlans: true,
      groups: { orderBy: { order: "asc" }, include: { milestones: true, risks: true, nextWeekPlans: true } },
      divisionIssues: { include: { owner: true } },
      companyIssues: { include: { owner: true } },
    },
  });
  if (!m) notFound();

  const totals = eeTotals(m.eeRows.map((r) => ({ ...r, note: r.note ?? "" })));
  const eeNorm = getEeNorm();
  const role = session!.user.role;
  const isPm = role === "PM";
  const hideManagerFields = shouldHideWeeklyReportFields(role);
  const canEditProject = role !== "PM" || canManagePmMeeting(session!.user.id, m.projectId, m.ownerId, m.project?.picPms ?? []);
  const editable = canEditMeeting(role, m.status) && canEditProject;
  const isSummaryWeekly = m.category === SUMMARY_WEEKLY_CATEGORY;
  const summaryGroups =
    isSummaryWeekly && m.weekStart && m.weekEnd
      ? await queryWeeklySummaryReport(m.weekStart.toISOString(), m.weekEnd.toISOString(), m.id)
      : [];
  // EE data is hidden from PM on-screen (see the EE - Effort section below) —
  // keep the export consistent with that and only offer it to non-PM roles.
  const exportMarkdown =
    isSummaryWeekly && !isPm
      ? buildWeeklySummaryMarkdown({
          week: m.week,
          weekStart: m.weekStart,
          weekEnd: m.weekEnd,
          weekRange: m.weekRange,
          execSummary: m.execSummary,
          eeRows: m.eeRows,
          risks: m.risks,
          eeNorm,
          summaryGroups,
        })
      : null;

  return (
    <div className="space-y-4">
      <div className="portal-page-heading">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/meetings" className="hover:text-[var(--vti-deep,#0A3CA8)]">
              Weekly Report
            </Link>
            <span>›</span>
            <span className="font-semibold text-slate-700">{m.week}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="portal-page-title">
              {m.week} · {formatDateOnlyRange(m.weekStart, m.weekEnd, m.weekRange)}
            </h1>
            <span className={`portal-pill ${statusClass(m.status)}`}>
              {m.status === "CLOSED" && <Lock size={12} />}
              {statusLabel(m.status)}
            </span>
            <span className={`portal-pill ${projectStatusClass(m.projectStatus)}`}>{m.projectStatus}</span>
          </div>
          <p className="portal-page-subtitle">
            Section {m.section}{m.project ? ` · Dự án: ${m.project.name}` : ""} · PM phụ trách: {m.owner.name} · Cập nhật lần cuối {formatDateTime(m.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {exportMarkdown && (
            <ExportMarkdownButton filename={`${m.week.replace(/\s+/g, "_")}_summary-weekly.md`} content={exportMarkdown} />
          )}
          {editable && (
            <Link
              href={`/meetings/${m.id}/edit`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sửa
            </Link>
          )}
          <MeetingButtons id={m.id} status={m.status} canEdit={editable} />
        </div>
      </div>

      {m.status === "CLOSED" && (
        <div className="flex items-center gap-3 rounded-lg border border-[#dbe3ef] bg-[#f8fbff] px-4 py-3 text-sm text-slate-600">
          <Lock size={15} className="text-slate-500" />
          Meeting đã chốt - nội dung ở chế độ chỉ đọc. Liên hệ Admin nếu cần mở lại để chỉnh sửa.
        </div>
      )}

      <SectionCard title="Executive Summary" icon={<Zap size={15} />}>
        <RichHtml html={m.execSummary} />
      </SectionCard>

      {!isPm && (
        <SectionCard
          title={`EE - Effort Efficiency (man-hours) · Plan ${totals.plan} / Actual ${totals.actual} / Variance ${formatVariance(totals.variance)}`}
          icon={<TrendingUp size={15} />}
        >
          {m.divisionEE != null && (
            <p className="mb-3 text-sm">
              EE của Division:{" "}
              <span className={`font-semibold ${m.divisionEE < eeNorm ? "text-red-600" : "text-emerald-600"}`}>
                {m.divisionEE}%
              </span>
              <span className="ml-1 text-xs text-slate-400">(NORM: {eeNorm}%)</span>
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Dự án</th>
                  <th>Plan</th>
                  <th>Actual</th>
                  <th>Chênh lệch</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {m.eeRows.map((row) => {
                  const variance = row.actual - row.plan;
                  return (
                    <tr key={row.id}>
                      <td className="font-semibold text-slate-950">{row.project}</td>
                      <td>{row.plan}</td>
                      <td>{row.actual}</td>
                      <td className={`font-semibold ${varianceClass(variance)}`}>{formatVariance(variance)}</td>
                      <td className="portal-table-muted">{row.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!isSummaryWeekly && !isPm && (
        <SectionCard title="RA - Resource Allocation (nhu cầu nhân sự)" icon={<UsersRound size={15} />}>
          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Vị trí</th>
                  <th>Dự án</th>
                  <th>Từ</th>
                  <th>Effort</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {m.raRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-slate-950">{row.name}</td>
                    <td>{row.project}</td>
                    <td>{row.from}</td>
                    <td>{row.effort}</td>
                    <td>
                      <span className="portal-pill bg-amber-50 text-amber-700">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!isPm && !hideManagerFields && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IssuePanel title="Division Issues" issues={m.divisionIssues} />
          <IssuePanel title="Company Issues" issues={m.companyIssues} />
        </div>
      )}

      {m.groups.length > 0 ? (
        <SectionCard title={`Chi tiết theo nhóm / Sub-project (${m.groups.length})`} icon={<CalendarCheck size={15} />}>
          <div className="space-y-4">
            {m.groups.map((g) => (
              <div key={g.id} className="rounded-lg border border-[#dbe3ef] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{g.name}</span>
                  <span className={`portal-pill ${milestoneStatusClass(g.status)}`}>{g.status}</span>
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">1. Progress / Key Update</div>
                    {g.progressNote ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{g.progressNote}</p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">Chưa có cập nhật.</p>
                    )}
                  </div>
                  {!hideManagerFields && (
                    <div>
                      <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">2. Milestone</div>
                      <div className="mt-2"><MilestoneTable rows={g.milestones} /></div>
                    </div>
                  )}
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">{hideManagerFields ? "2" : "3"}. Risk / Issue</div>
                    <div className="mt-2"><RiskTable rows={g.risks} /></div>
                  </div>
                  {!hideManagerFields && (
                    <div>
                      <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">4. Next Week Plan</div>
                      <div className="mt-2"><NextWeekPlanTable rows={g.nextWeekPlans} /></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : (
        <>
          {!hideManagerFields && (
            <SectionCard title={`Milestone (${m.milestones.length})`} icon={<CalendarCheck size={15} />}>
              <MilestoneTable rows={m.milestones} />
            </SectionCard>
          )}

          <SectionCard title={`Issues/Risks (${m.risks.length})`} icon={<TriangleAlert size={15} />}>
            <RiskTable rows={m.risks} />
          </SectionCard>

          {!hideManagerFields && (
            <SectionCard title={`Next Week Plan (${m.nextWeekPlans.length})`} icon={<ClipboardList size={15} />}>
              <NextWeekPlanTable rows={m.nextWeekPlans} />
            </SectionCard>
          )}
        </>
      )}

      {!hideManagerFields && (
        <SectionCard title="Team Summary" icon={<UsersRound size={15} />}>
          <RichHtml html={m.teamSummary} />
        </SectionCard>
      )}

      <SectionCard title="Opportunities" icon={<TrendingUp size={15} />}>
        <RichHtml html={m.opportunities} />
      </SectionCard>

      {isSummaryWeekly && (
        <SummaryWeeklyReport
          weekStart={m.weekStart?.toISOString()}
          weekEnd={m.weekEnd?.toISOString()}
          eeNorm={eeNorm}
          initialGroups={summaryGroups}
        />
      )}
    </div>
  );
}
