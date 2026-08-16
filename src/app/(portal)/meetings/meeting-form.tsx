"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { MeetingFormData, IssueInput, RiskInput, MilestoneInput, NextWeekPlanInput, MeetingGroupInput } from "@/types/meeting";
import type { Severity } from "@/generated/prisma/enums";
import type { Role } from "@/types";
import { type ProjectOption } from "@/lib/master-data";
import { htmlToText } from "@/lib/announcements";
import { SUMMARY_WEEKLY_CATEGORY, SUMMARY_WEEKLY_TEMPLATE, RISK_TYPES, RISK_STATUSES, MILESTONE_STATUSES, PROJECT_STATUSES } from "@/lib/meetings";
import { MEETING_WEEK_OPTIONS } from "@/lib/meeting-week-options";
import { syncWeeklyTasks } from "./actions";
import { SummaryWeeklyReport } from "./summary-weekly-report";

type Person = { id: string; name: string };

const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function MeetingForm({
  initial,
  people,
  projects,
  categories,
  sections,
  role,
  currentUserId,
  onSubmit,
  isNew = false,
  eeNorm,
}: {
  initial: MeetingFormData;
  people: Person[];
  projects: ProjectOption[];
  categories: string[];
  sections: string[];
  role: Role;
  currentUserId: string;
  onSubmit: (data: MeetingFormData, filesFormData: FormData) => Promise<void>;
  /** NORM threshold (see lib/meetings.ts#getEeNorm) — for the Summary Weekly report's Tình trạng EE column. */
  eeNorm: number;
  /**
   * True on the create screen (no persisted meeting exists yet). "Lưu nháp"
   * is only ever allowed to move a meeting INTO DRAFT, never demote an
   * already-persisted OPEN/CLOSED report — so on the edit screen the button
   * is gated to when the report is already DRAFT.
   */
  isNew?: boolean;
}) {
  const [form, setForm] = useState<MeetingFormData>(() => withDateParts(initial));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  function buildFilesFormData(): FormData {
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append("files", f));
    return fd;
  }
  const [pending, start] = useTransition();
  const set = <K extends keyof MeetingFormData>(k: K, v: MeetingFormData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const weekOptions = useMemo(() => {
    if (initial.week && !MEETING_WEEK_OPTIONS.some((o) => o.week === initial.week)) {
      return [{ week: initial.week, label: `${initial.week} (tuỳ chỉnh)`, weekStart: "", weekEnd: "" }, ...MEETING_WEEK_OPTIONS];
    }
    return MEETING_WEEK_OPTIONS;
  }, [initial.week]);

  function handleWeekSelect(value: string) {
    const generated = MEETING_WEEK_OPTIONS.find((o) => o.week === value);
    if (generated) {
      setForm((f) => ({
        ...f,
        week: generated.week,
        weekStart: generated.weekStart,
        weekEnd: generated.weekEnd,
        weekRange: composeWeekRange(generated.weekStart, generated.weekEnd, f.weekRange),
      }));
    } else {
      set("week", value);
    }
  }

  const isSectionManager = role === "SECTION_MANAGER";
  const isDivisionLeader = role === "DIVISION_LEADER";
  const isPm = role === "PM";
  const canSummaryWeekly = isSectionManager || isDivisionLeader;
  const categoryOptions = useMemo(
    () => (canSummaryWeekly && !categories.includes(SUMMARY_WEEKLY_CATEGORY) ? [...categories, SUMMARY_WEEKLY_CATEGORY] : categories),
    [categories, canSummaryWeekly],
  );
  const isSummaryWeekly = canSummaryWeekly && form.category === SUMMARY_WEEKLY_CATEGORY;

  function handleCategorySelect(value: string) {
    setForm((f) => {
      const shouldAutoFill = value === SUMMARY_WEEKLY_CATEGORY && canSummaryWeekly && !htmlToText(f.execSummary);
      return { ...f, category: value, execSummary: shouldAutoFill ? SUMMARY_WEEKLY_TEMPLATE : f.execSummary };
    });
  }

  const syncProjectId = form.projectId ?? "";
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const syncProject = projects.find((p) => p.id === syncProjectId);
  const hasSubProjects = Boolean(syncProject?.hasSubProjects);
  const hasWeek = Boolean(form.weekStart && form.weekEnd);
  const canSync = Boolean(syncProject?.pmConfigured) && hasWeek && !syncing;
  const syncHint = !syncProjectId
    ? "Chọn dự án để đồng bộ task tuần"
    : !syncProject?.pmConfigured
      ? "Dự án này chưa cấu hình PM tool / URL / token"
      : !hasWeek
        ? "Nhập khoảng tuần (Từ / Đến) trước khi sync"
        : "Lấy task của tuần và tạo tóm tắt";

  async function runSync() {
    if (!syncProjectId || !form.weekStart || !form.weekEnd) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncWeeklyTasks(syncProjectId, form.weekStart, form.weekEnd);
      setForm((f) => ({
        ...f,
        execSummary: (f.execSummary ? f.execSummary : "") + res.summaryHtml,
        eeRows: [...f.eeRows, ...res.eeRows],
      }));
      setSyncMsg({ type: "ok", text: `Đã đồng bộ ${res.taskCount} task vào Executive Summary.` });
    } catch (e) {
      setSyncMsg({ type: "error", text: e instanceof Error ? e.message : "Đồng bộ thất bại." });
    } finally {
      setSyncing(false);
    }
  }

  function setWeekDate(key: "weekStart" | "weekEnd", value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      return { ...next, weekRange: composeWeekRange(next.weekStart, next.weekEnd, next.weekRange) };
    });
  }

  const validationErrors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!form.week.trim()) next.week = "Vui lòng nhập Tuần.";
    if (!form.weekStart) next.weekStart = "Vui lòng nhập thời gian Từ.";
    if (!form.weekEnd) next.weekEnd = "Vui lòng nhập thời gian Đến.";
    if (form.weekStart && form.weekEnd && form.weekEnd <= form.weekStart) next.weekEnd = "Thời gian Đến phải sau thời gian Từ.";
    if (!htmlToText(form.execSummary)) next.execSummary = "Vui lòng nhập Executive Summary.";
    return next;
  }, [form.week, form.weekStart, form.weekEnd, form.execSummary]);
  const isValid = Object.keys(validationErrors).length === 0;
  // A DRAFT report may always be re-saved as a draft; a NEW (not-yet-created)
  // report has no persisted status to protect. An already-persisted
  // OPEN/CLOSED report must never be silently demoted to DRAFT by this button.
  const canSaveDraft = isNew || form.status === "DRAFT";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    start(() => onSubmit({ ...form, weekRange: composeWeekRange(form.weekStart, form.weekEnd, form.weekRange) }, buildFilesFormData()));
  }

  function saveDraft() {
    start(() =>
      onSubmit(
        { ...form, status: "DRAFT", weekRange: composeWeekRange(form.weekStart, form.weekEnd, form.weekRange) },
        buildFilesFormData(),
      ),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)] md:grid-cols-6">
        <label className="text-sm md:col-span-1">
          Tuần <span className="text-red-500">*</span>
          <select className="mt-1 w-full rounded border px-2 py-1" value={form.week} onChange={(e) => handleWeekSelect(e.target.value)}>
            <option value="">Chọn tuần…</option>
            {weekOptions.map((o) => <option key={o.week} value={o.week}>{o.label}</option>)}
          </select>
          {validationErrors.week && <p className="mt-1 text-xs text-red-500">{validationErrors.week}</p>}
        </label>
        <label className="text-sm">
          Từ <span className="text-red-500">*</span>
          <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1" value={form.weekStart ?? ""} onChange={(e) => setWeekDate("weekStart", e.target.value)} />
          {validationErrors.weekStart && <p className="mt-1 text-xs text-red-500">{validationErrors.weekStart}</p>}
        </label>
        <label className="text-sm">
          Đến <span className="text-red-500">*</span>
          <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1" value={form.weekEnd ?? ""} onChange={(e) => setWeekDate("weekEnd", e.target.value)} />
          {validationErrors.weekEnd && <p className="mt-1 text-xs text-red-500">{validationErrors.weekEnd}</p>}
        </label>
        <label className="text-sm">
          Section
          <select className="mt-1 w-full rounded border px-2 py-1" value={form.section} onChange={(e) => set("section", e.target.value)}>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Category
          <select className="mt-1 w-full rounded border px-2 py-1" value={form.category ?? categories[0]} onChange={(e) => handleCategorySelect(e.target.value)}>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Project Status
          <select className="mt-1 w-full rounded border px-2 py-1" value={form.projectStatus} onChange={(e) => set("projectStatus", e.target.value)}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-3 text-sm shadow-[var(--sh-1)]">
        <span className="font-medium text-slate-700">Dự án của weekly report:</span>
        <select
          className="rounded border px-2 py-1"
          value={syncProjectId}
          onChange={(e) => { set("projectId", e.target.value || undefined); setSyncMsg(null); }}
        >
          <option value="">Chọn dự án…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.pmConfigured ? "" : " (chưa cấu hình PM)"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={runSync}
          disabled={!canSync}
          title={syncHint}
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {syncing ? "Đang đồng bộ…" : "Sync tóm tắt tuần"}
        </button>
        {syncMsg && (
          <span className={syncMsg.type === "error" ? "text-red-600" : "text-emerald-600"}>{syncMsg.text}</span>
        )}
      </div>

      <RichTextEditor label="Executive Summary" required value={form.execSummary} onChange={(v) => set("execSummary", v)} error={validationErrors.execSummary} />

      {!isPm && (
        <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">EE - Effort</h3>
          <label className="block max-w-xs text-sm">
            EE của Division (%)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border px-2 py-1"
              value={form.divisionEE ?? ""}
              onChange={(e) => set("divisionEE", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {!isPm && (
        <IssueEditor title="Division Issues" rows={form.divisionIssues} people={people} currentUserId={currentUserId} severities={SEVERITIES} onChange={(rows) => set("divisionIssues", rows)} />
      )}
      {!isPm && (
        <IssueEditor title="Company Issues" rows={form.companyIssues} people={people} currentUserId={currentUserId} severities={SEVERITIES} onChange={(rows) => set("companyIssues", rows)} />
      )}

      {hasSubProjects ? (
        <GroupsEditor rows={form.groups} onChange={(rows) => set("groups", rows)} />
      ) : (
        <>
          <MilestoneEditor rows={form.milestones} onChange={(rows) => set("milestones", rows)} />
          <RiskEditor rows={form.risks} onChange={(rows) => set("risks", rows)} />
          <NextWeekPlanEditor rows={form.nextWeekPlans} onChange={(rows) => set("nextWeekPlans", rows)} />
        </>
      )}
      <FileStager files={pendingFiles} onChange={setPendingFiles} />

      <RichTextEditor label="Team Summary" value={form.teamSummary} onChange={(v) => set("teamSummary", v)} />
      <RichTextEditor label="Opportunities" value={form.opportunities} onChange={(v) => set("opportunities", v)} />

      {isSummaryWeekly && <SummaryWeeklyReport weekStart={form.weekStart} weekEnd={form.weekEnd} eeNorm={eeNorm} />}

      <div className="flex items-center justify-end gap-2">
        {!isValid && <span className="text-xs text-slate-500">Vui lòng nhập đủ Tuần, Từ, Đến và Executive Summary.</span>}
        {canSaveDraft && (
          <button
            type="button"
            onClick={saveDraft}
            disabled={pending}
            className="rounded-lg border border-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-[var(--vti-deep,#0A3CA8)] disabled:opacity-50"
          >
            {pending ? "Đang lưu..." : "Lưu nháp"}
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !isValid}
          title={!isValid ? "Vui lòng nhập đủ Tuần, Từ, Đến và Executive Summary." : undefined}
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu meeting"}
        </button>
      </div>
    </form>
  );
}

function RichTextEditor({ label, value, onChange, required, error }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; error?: string }) {
  return (
    <section className="meeting-rich-editor rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 text-sm shadow-[var(--sh-1)]">
      <h2 className="mb-2 font-semibold text-slate-900">{label}{required && <span className="text-red-500"> *</span>}</h2>
      <Editor
        licenseKey="gpl"
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        value={value}
        onEditorChange={onChange}
        init={{
          height: 500,
          base_url: "/tinymce",
          suffix: ".min",
          menubar: false,
          plugins: "lists link table code accordion accordiontoggle fullscreen emoticons",
          toolbar: "fullscreen | accordion | redo | undo | blocks | bold italic underline | bullist numlist | emoticons | backcolor | forecolor | link table | code | selectall | styles | subscript | outdent | hr | indent",
          skin: "oxide",
          content_css: "default",
          branding: false,
          promotion: false,
          statusbar: false,
          // Tables are normalized to fit the layout on save (lib/rich-text-tables.ts).
          // Mirror that inside the editor so what the author sees while typing is
          // what the detail page renders — no sideways scrolling either way.
          table_sizing_mode: "relative",
          table_default_attributes: {},
          table_default_styles: { width: "100%", "table-layout": "fixed" },
          content_style:
            "body { font-family: Inter, Arial, sans-serif; font-size: 14px; color: #334155; overflow-wrap: break-word; }" +
            " table { width: 100% !important; max-width: 100% !important; table-layout: fixed; }" +
            " th, td { word-break: break-word; overflow-wrap: break-word; }",
        }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </section>
  );
}

function IssueEditor({ title, rows, people, currentUserId, severities, onChange }: {
  title: string; rows: IssueInput[]; people: Person[]; currentUserId: string; severities: Severity[]; onChange: (rows: IssueInput[]) => void;
}) {
  const ownerName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button type="button" className="text-sm text-[var(--vti-deep,#0A3CA8)]" onClick={() => onChange([...rows, { title: "", severity: "MEDIUM", ownerId: currentUserId, status: "open" }])}>+ Thêm issue</button></div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input className="col-span-12 rounded border px-1 py-0.5 text-sm sm:col-span-7" placeholder="Tiêu đề" value={row.title} onChange={(e) => { const n = rows.slice(); n[i] = { ...row, title: e.target.value }; onChange(n); }} />
            <select className="col-span-5 rounded border px-1 py-0.5 text-sm sm:col-span-2" value={row.severity} onChange={(e) => { const n = rows.slice(); n[i] = { ...row, severity: e.target.value as Severity }; onChange(n); }}>{severities.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <span className="col-span-5 truncate rounded border border-transparent px-1 py-0.5 text-sm text-slate-500 sm:col-span-2" title="Người tạo issue">{ownerName(row.ownerId)}</span>
            <button type="button" className="col-span-2 text-xs text-red-500 sm:col-span-1" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Xóa</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTable({ rows, onChange }: { rows: MilestoneInput[]; onChange: (rows: MilestoneInput[]) => void }) {
  const emptyRow: MilestoneInput = { name: "", planDate: "", status: MILESTONE_STATUSES[2], note: "" };
  function update(i: number, patch: Partial<MilestoneInput>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-1 py-1">Milestone <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Plan Date <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Status <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Note</th>
              <th className="w-8 px-1 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
                <td className="p-1"><input type="date" className="w-full rounded border px-2 py-1" value={row.planDate} onChange={(e) => update(i, { planDate: e.target.value })} /></td>
                <td className="p-1">
                  <select className="w-full rounded border px-2 py-1" value={row.status} onChange={(e) => update(i, { status: e.target.value })}>
                    {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.note} onChange={(e) => update(i, { note: e.target.value })} /></td>
                <td className="p-1 text-center">
                  <button type="button" title="Xóa" className="text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-1 py-2 text-slate-400">Chưa có milestone nào.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm text-[var(--vti-deep,#0A3CA8)]" onClick={() => onChange([...rows, { ...emptyRow }])}>
        + Thêm milestone
      </button>
    </div>
  );
}

function MilestoneEditor({ rows, onChange }: { rows: MilestoneInput[]; onChange: (rows: MilestoneInput[]) => void }) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Milestone (tháng này)</h3>
      </div>
      <MilestoneTable rows={rows} onChange={onChange} />
    </div>
  );
}

function RiskTable({ rows, onChange }: { rows: RiskInput[]; onChange: (rows: RiskInput[]) => void }) {
  const emptyRisk: RiskInput = { type: RISK_TYPES[0], title: "", impact: "MEDIUM", actionPlan: "", status: RISK_STATUSES[0], planDate: "" };
  function update(i: number, patch: Partial<RiskInput>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-1 py-1">Type <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Title <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Priority <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Mitigation / Action <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Status <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Plan Date <span className="text-red-500">*</span></th>
              <th className="w-8 px-1 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="p-1">
                  <select className="w-full rounded border px-2 py-1" value={row.type} onChange={(e) => update(i, { type: e.target.value })}>
                    {RISK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.title} onChange={(e) => update(i, { title: e.target.value })} /></td>
                <td className="p-1">
                  <select className="w-full rounded border px-2 py-1" value={row.impact} onChange={(e) => update(i, { impact: e.target.value as Severity })}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.actionPlan} onChange={(e) => update(i, { actionPlan: e.target.value })} /></td>
                <td className="p-1">
                  <select className="w-full rounded border px-2 py-1" value={row.status} onChange={(e) => update(i, { status: e.target.value })}>
                    {RISK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-1"><input type="date" className="w-full rounded border px-2 py-1" value={row.planDate} onChange={(e) => update(i, { planDate: e.target.value })} /></td>
                <td className="p-1 text-center">
                  <button type="button" title="Xóa" className="text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-1 py-2 text-slate-400">Chưa có issue/risk nào.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm text-[var(--vti-deep,#0A3CA8)]" onClick={() => onChange([...rows, { ...emptyRisk }])}>
        + Thêm issue/risk
      </button>
    </div>
  );
}

function RiskEditor({ rows, onChange }: { rows: RiskInput[]; onChange: (rows: RiskInput[]) => void }) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Issues / Risks</h3>
      </div>
      <RiskTable rows={rows} onChange={onChange} />
    </div>
  );
}

function GroupsEditor({ rows, onChange }: { rows: MeetingGroupInput[]; onChange: (rows: MeetingGroupInput[]) => void }) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const emptyGroup: MeetingGroupInput = { name: "", status: MILESTONE_STATUSES[0], progressNote: "", milestones: [], risks: [], nextWeekPlans: [] };
  function update(i: number, patch: Partial<MeetingGroupInput>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function toggle(i: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Chi tiết theo nhóm / Sub-project</h3>
        <button
          type="button"
          className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1.5 text-xs font-medium text-white"
          onClick={() => onChange([...rows, { ...emptyGroup }])}
        >
          + Add Group
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-400">Chưa có nhóm/sub-project nào.</p>}
      <div className="space-y-4">
        {rows.map((group, i) => {
          const isCollapsed = collapsed.has(i);
          return (
            <div key={i} className="rounded-lg border border-[var(--vti-line,#E7DED2)] p-3">
              <div className="grid grid-cols-12 items-start gap-2">
                <label className="col-span-12 text-sm sm:col-span-7">
                  Tên nhóm / Sub-project <span className="text-red-500">*</span>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    placeholder="Nhập tên nhóm hoặc sub-project (VD: OD + SG, Common, App,...)"
                    value={group.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </label>
                <label className="col-span-8 text-sm sm:col-span-3">
                  Status <span className="text-red-500">*</span>
                  <select className="mt-1 w-full rounded border px-2 py-1" value={group.status} onChange={(e) => update(i, { status: e.target.value })}>
                    {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <div className="col-span-4 flex items-center justify-end gap-2 pt-6 sm:col-span-2">
                  <button type="button" title={isCollapsed ? "Mở rộng" : "Thu gọn"} className="text-slate-500" onClick={() => toggle(i)}>
                    {isCollapsed ? "⌄" : "⌃"}
                  </button>
                  <button type="button" title="Xóa nhóm" className="text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">1. Progress / Key Update</div>
                    <textarea
                      className="mt-2 w-full rounded border px-2 py-1 text-sm"
                      rows={3}
                      placeholder={"Nhập tiến độ, cập nhật chính trong tuần...\n- Ví dụ: Sprint, task hoàn thành, đang thực hiện, chuyển trạng thái, v.v.\n- Có thể dùng bullet để dễ đọc."}
                      value={group.progressNote}
                      onChange={(e) => update(i, { progressNote: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">2. Milestone</div>
                    <div className="mt-2">
                      <MilestoneTable rows={group.milestones} onChange={(milestones) => update(i, { milestones })} />
                    </div>
                  </div>
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">3. Risk / Issue</div>
                    <div className="mt-2">
                      <RiskTable rows={group.risks} onChange={(risks) => update(i, { risks })} />
                    </div>
                  </div>
                  <div>
                    <div className="rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">4. Next Week Plan</div>
                    <div className="mt-2">
                      <NextWeekPlanTable rows={group.nextWeekPlans} onChange={(nextWeekPlans) => update(i, { nextWeekPlans })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextWeekPlanTable({ rows, onChange }: { rows: NextWeekPlanInput[]; onChange: (rows: NextWeekPlanInput[]) => void }) {
  const emptyRow: NextWeekPlanInput = { keyActivity: "", note: "" };
  function update(i: number, patch: Partial<NextWeekPlanInput>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-1 py-1">Key Activity <span className="text-red-500">*</span></th>
              <th className="px-1 py-1">Note</th>
              <th className="w-8 px-1 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.keyActivity} onChange={(e) => update(i, { keyActivity: e.target.value })} /></td>
                <td className="p-1"><input className="w-full rounded border px-2 py-1" value={row.note} onChange={(e) => update(i, { note: e.target.value })} /></td>
                <td className="p-1 text-center">
                  <button type="button" title="Xóa" className="text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="px-1 py-2 text-slate-400">Chưa có hoạt động nào.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm text-[var(--vti-deep,#0A3CA8)]" onClick={() => onChange([...rows, { ...emptyRow }])}>
        + Thêm hoạt động
      </button>
    </div>
  );
}

function NextWeekPlanEditor({ rows, onChange }: { rows: NextWeekPlanInput[]; onChange: (rows: NextWeekPlanInput[]) => void }) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Next Week Plan</h3>
      </div>
      <NextWeekPlanTable rows={rows} onChange={onChange} />
    </div>
  );
}

function FileStager({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Tệp đính kèm</h3>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="text-sm"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) onChange([...files, ...picked]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm text-slate-600">
              <span className="truncate">{f.name} ({Math.ceil(f.size / 1024)} KB)</span>
              <button type="button" className="text-xs font-semibold text-red-500" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function composeWeekRange(start?: string, end?: string, fallback = "") {
  if (start && end) return `${start} - ${end}`;
  return fallback;
}

function withDateParts(data: MeetingFormData): MeetingFormData {
  if (data.weekStart || data.weekEnd) return data;
  const [start, end] = data.weekRange.split(" - ");
  if (isDateTimeLocal(start) && isDateTimeLocal(end)) return { ...data, weekStart: start, weekEnd: end };
  return data;
}

function isDateTimeLocal(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value));
}
