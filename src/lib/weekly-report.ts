export type DeadlineCfg = { weekday: number; hour: number; minute: number };

const WEEKDAYS: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };
const DEFAULT_CFG: DeadlineCfg = { weekday: 5, hour: 10, minute: 0 };

/** Parse "DD/MM – DD/MM/YYYY" (en-dash or hyphen) into start/end Dates. Null if unparseable. */
export function parseWeekRange(raw: string): { start: Date; end: Date } | null {
  if (!raw) return null;
  const parts = raw.split(/\s*[–-]\s*/);
  if (parts.length !== 2) return null;
  const left = parts[0].trim().split("/");
  const right = parts[1].trim().split("/");
  if (left.length < 2 || right.length !== 3) return null;
  const year = Number(right[2]);
  const sd = Number(left[0]), sm = Number(left[1]);
  const ed = Number(right[0]), em = Number(right[1]);
  if ([year, sd, sm, ed, em].some((n) => Number.isNaN(n))) return null;
  const start = new Date(year, sm - 1, sd, 0, 0, 0, 0);
  const end = new Date(year, em - 1, ed, 23, 59, 59, 999);
  return { start, end };
}

export function isWithinWeek(range: { start: Date; end: Date }, today: Date): boolean {
  const t = today.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/** Parse "FRI 10:00" → cfg. Falls back to Friday 10:00 on missing/invalid input. */
export function parseDeadlineEnv(raw: string | undefined): DeadlineCfg {
  if (!raw) return { ...DEFAULT_CFG };
  const tokens = raw.trim().toUpperCase().split(/\s+/);
  if (tokens.length !== 2) return { ...DEFAULT_CFG };
  const weekday = WEEKDAYS[tokens[0]];
  const time = tokens[1].split(":");
  const hour = Number(time[0]), minute = Number(time[1]);
  if (!weekday || time.length !== 2 || Number.isNaN(hour) || Number.isNaN(minute)) return { ...DEFAULT_CFG };
  return { weekday, hour, minute };
}

/** The configured weekday/time within today's Monday-started week, in server-local time. */
export function weeklyDeadline(today: Date, cfg: DeadlineCfg): Date {
  const dow = today.getDay(); // 0=Sun..6=Sat
  const isoToday = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (isoToday - 1));
  const deadline = new Date(monday);
  deadline.setDate(monday.getDate() + (cfg.weekday - 1));
  deadline.setHours(cfg.hour, cfg.minute, 0, 0);
  return deadline;
}

export function isPastDeadline(today: Date, deadline: Date): boolean {
  return today.getTime() >= deadline.getTime();
}

/** Active project names whose normalized form is absent from `reportedNames` (already normalized). */
export function missingReportProjectNames(activeProjectNames: string[], reportedNames: Set<string>): string[] {
  return activeProjectNames.filter((n) => !reportedNames.has(n.trim().toLowerCase()));
}
