import "server-only";

// Pulls the week's tasks from a project's configured PM tool (Redmine or
// Backlog) using the write-only `accessKey` stored on the Project. Never expose
// the token or raw URLs to the client — only call this from server actions.

export type WeeklyTask = {
  key: string; // issue id (Redmine) or issueKey (Backlog)
  title: string;
  status: string;
  assignee: string;
  hours: number; // hours logged/actual within the week (0 when unknown)
  // Extra fields for the Weekly Progress Report template — best-effort, may be
  // undefined when the PM tool doesn't expose them.
  priority?: string;
  category?: string;
  milestone?: string;
  dueDate?: string | null;
  createdAt?: string;
};

export type PmProject = {
  name: string;
  code: string | null;
  pmTool: string | null;
  pmUrl: string | null;
  accessKey: string | null;
};

const FETCH_TIMEOUT_MS = 15_000;

/** A project can be synced only when tool + URL + token are all present. */
export function isPmConfigured(p: {
  pmTool: string | null;
  pmUrl: string | null;
  accessKey: string | null;
}): boolean {
  const tool = (p.pmTool ?? "").toLowerCase();
  return (tool === "redmine" || tool === "backlog") && Boolean(p.pmUrl) && Boolean(p.accessKey);
}

/** datetime-local ("2026-06-16T09:00") or ISO -> "2026-06-16". */
export function toDateOnly(value: string): string {
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) throw new Error(`Ngày không hợp lệ: "${value}"`);
  return match[0];
}

// Redmine/Backlog project identifiers never contain whitespace. A `code` that
// fails this check is almost certainly a copy-pasted display name rather than
// the real PM key (seen in practice: code = full project name with spaces),
// so it's ignored in favor of the /projects/<id> path instead of being sent
// to the PM API as a bogus identifier.
const PLAUSIBLE_PM_KEY = /^[A-Za-z0-9_-]+$/;

function pickPmIdentifier(code: string | null, fromPath: string | undefined): string | undefined {
  const trimmed = code?.trim();
  if (trimmed && PLAUSIBLE_PM_KEY.test(trimmed)) return trimmed;
  return fromPath || trimmed || undefined;
}

/**
 * Resolve the Redmine base origin + project identifier. The project `code` is
 * the source of truth when it looks like a real identifier; the
 * /projects/<id> path is the fallback.
 */
export function parseRedmineTarget(pmUrl: string, code: string | null): { base: string; identifier: string } {
  const url = new URL(pmUrl);
  const fromPath = url.pathname.match(/\/projects\/([^/?#]+)/)?.[1];
  const identifier = pickPmIdentifier(code, fromPath);
  if (!identifier) {
    throw new Error("Không xác định được Redmine project identifier (project chưa có mã code và pmUrl thiếu /projects/<id>).");
  }
  return { base: url.origin, identifier };
}

/**
 * Resolve the Backlog space host + project key/id. The project `code` is the
 * source of truth when it looks like a real key; the /projects/<KEY> path is
 * the fallback. The Backlog API accepts either the numeric project id or the
 * project key here.
 */
export function parseBacklogTarget(pmUrl: string, code: string | null): { host: string; projectKey: string } {
  const url = new URL(pmUrl);
  const fromPath = url.pathname.match(/\/projects\/([^/?#]+)/)?.[1];
  const projectKey = pickPmIdentifier(code, fromPath);
  if (!projectKey) {
    throw new Error("Không xác định được Backlog project key (project chưa có mã code và pmUrl thiếu /projects/<KEY>).");
  }
  return { host: url.host, projectKey };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error("Token không hợp lệ hoặc không đủ quyền đọc dự án.");
      if (res.status === 404) throw new Error("Không tìm thấy dự án trên hệ thống PM (kiểm tra URL/mã code).");
      throw new Error(`Yêu cầu PM thất bại (HTTP ${res.status}).`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Hết thời gian chờ khi gọi hệ thống PM.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type RedmineIssue = {
  id: number;
  subject?: string;
  status?: { name?: string };
  assigned_to?: { name?: string };
  priority?: { name?: string };
  category?: { name?: string };
  fixed_version?: { name?: string };
  due_date?: string | null;
  created_on?: string;
};
type RedmineTimeEntry = { issue?: { id?: number }; hours?: number };

async function fetchRedmine(project: PmProject, start: string, end: string): Promise<WeeklyTask[]> {
  const { base, identifier } = parseRedmineTarget(project.pmUrl!, project.code);
  const headers = { "X-Redmine-API-Key": project.accessKey! };
  const range = `><${start}|${end}`;

  const issuesUrl = `${base}/issues.json?${new URLSearchParams({
    project_id: identifier,
    status_id: "*",
    updated_on: range,
    limit: "100",
  })}`;
  const issuesData = (await fetchJson(issuesUrl, { headers })) as { issues?: RedmineIssue[] };

  // Sum logged hours per issue within the same week (Redmine has real time tracking).
  const hoursByIssue = new Map<number, number>();
  try {
    const timeUrl = `${base}/time_entries.json?${new URLSearchParams({
      project_id: identifier,
      spent_on: range,
      limit: "100",
    })}`;
    const timeData = (await fetchJson(timeUrl, { headers })) as { time_entries?: RedmineTimeEntry[] };
    for (const entry of timeData.time_entries ?? []) {
      const id = entry.issue?.id;
      if (id != null) hoursByIssue.set(id, (hoursByIssue.get(id) ?? 0) + (entry.hours ?? 0));
    }
  } catch {
    // Time-entry permission may differ from issue read; degrade to hours = 0.
  }

  return (issuesData.issues ?? []).map((i) => ({
    key: String(i.id),
    title: i.subject ?? "(no title)",
    status: i.status?.name ?? "",
    assignee: i.assigned_to?.name ?? "",
    hours: hoursByIssue.get(i.id) ?? 0,
    priority: i.priority?.name,
    category: i.category?.name,
    milestone: i.fixed_version?.name,
    dueDate: i.due_date ?? null,
    createdAt: i.created_on,
  }));
}

type BacklogProject = { id?: number };
type BacklogIssue = {
  issueKey?: string;
  summary?: string;
  status?: { name?: string };
  assignee?: { name?: string };
  actualHours?: number | null;
  priority?: { name?: string };
  milestone?: { name?: string }[];
  category?: { name?: string }[];
  dueDate?: string | null;
  created?: string;
};

async function fetchBacklog(project: PmProject, start: string, end: string): Promise<WeeklyTask[]> {
  const { host, projectKey } = parseBacklogTarget(project.pmUrl!, project.code);
  const apiKey = project.accessKey!;

  const projData = (await fetchJson(
    `https://${host}/api/v2/projects/${encodeURIComponent(projectKey)}?${new URLSearchParams({ apiKey })}`,
  )) as BacklogProject;
  if (projData.id == null) throw new Error("Không lấy được Backlog projectId.");

  const issuesUrl = `https://${host}/api/v2/issues?${new URLSearchParams({
    apiKey,
    "projectId[]": String(projData.id),
    updatedSince: start,
    updatedUntil: end,
    count: "100",
  })}`;
  const issues = (await fetchJson(issuesUrl)) as BacklogIssue[];

  return (Array.isArray(issues) ? issues : []).map((i) => ({
    key: i.issueKey ?? "",
    title: i.summary ?? "(no title)",
    status: i.status?.name ?? "",
    assignee: i.assignee?.name ?? "",
    hours: i.actualHours ?? 0,
    priority: i.priority?.name,
    category: i.category?.[0]?.name,
    milestone: i.milestone?.[0]?.name,
    dueDate: i.dueDate ?? null,
    createdAt: i.created,
  }));
}

/** Fetch the week's tasks for a project, switching on its configured pmTool. */
export async function fetchWeeklyTasks(
  project: PmProject,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyTask[]> {
  if (!isPmConfigured(project)) throw new Error("Dự án chưa cấu hình đầy đủ PM tool / URL / token.");
  const start = toDateOnly(weekStart);
  const end = toDateOnly(weekEnd);
  const tool = project.pmTool!.toLowerCase();
  if (tool === "redmine") return fetchRedmine(project, start, end);
  if (tool === "backlog") return fetchBacklog(project, start, end);
  throw new Error(`PM tool không hỗ trợ: ${project.pmTool}`);
}

