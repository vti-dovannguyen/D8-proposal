export type MeetingWeekOption = {
  week: string;
  label: string;
  weekStart: string;
  weekEnd: string;
};

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDayMonth(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${m}`;
}

/**
 * Generates Saturday-to-Friday week options starting at week `startWeek`
 * (whose "this Friday" is `startWeekFriday`, "YYYY-MM-DD") through week
 * `endWeek` inclusive, stepping forward 7 days at a time for exactly
 * `endWeek - startWeek + 1` entries.
 *
 * Each week's `weekStart` is the Saturday immediately after the *previous*
 * week's Friday (i.e. `thisFriday - 6 days`), not the previous Friday itself
 * — this keeps adjacent weeks from sharing a calendar date at the boundary
 * (previous week's `weekEnd` date vs this week's `weekStart` date), which
 * would otherwise cause date-only overlap queries to match both weeks.
 */
export function generateWeekOptions(startWeek: number, startWeekFriday: string, endWeek: number): MeetingWeekOption[] {
  const options: MeetingWeekOption[] = [];
  const [y, m, d] = startWeekFriday.split("-").map(Number);
  let thisFriday = new Date(y, m - 1, d);
  const count = endWeek - startWeek + 1;
  let week = startWeek;
  for (let i = 0; i < count; i++) {
    const weekStartDate = new Date(thisFriday);
    weekStartDate.setDate(weekStartDate.getDate() - 6);
    options.push({
      week: `Tuần ${week}`,
      label: `Tuần ${week} (${toDayMonth(weekStartDate)} – ${toDayMonth(thisFriday)})`,
      weekStart: `${toDateOnly(weekStartDate)}T00:00`,
      weekEnd: `${toDateOnly(thisFriday)}T23:59`,
    });
    week += 1;
    thisFriday = new Date(thisFriday);
    thisFriday.setDate(thisFriday.getDate() + 7);
  }
  return options;
}

export const MEETING_WEEK_OPTIONS: MeetingWeekOption[] = generateWeekOptions(29, "2026-07-17", 53);

/** The MEETING_WEEK_OPTIONS entry whose Saturday–Friday span contains `now` (undefined if out of the generated 2026 range). */
export function getCurrentWeekOption(now: Date = new Date()): MeetingWeekOption | undefined {
  const today = toDateOnly(now);
  return MEETING_WEEK_OPTIONS.find((o) => today >= o.weekStart.slice(0, 10) && today <= o.weekEnd.slice(0, 10));
}
