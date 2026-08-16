export const POINT_AWARD_TYPES = ["PERSON", "PROJECT"] as const;
export type PointAwardType = (typeof POINT_AWARD_TYPES)[number];
export const POINT_AWARD_TYPE_LABELS: Record<PointAwardType, string> = {
  PERSON: "Cá nhân",
  PROJECT: "Dự án",
};

export const POINT_MIN = 0;
export const POINT_MAX = 100;

export function validatePoints(value: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < POINT_MIN || n > POINT_MAX) {
    throw new Error(`Validation: point phải là số nguyên trong khoảng ${POINT_MIN}..${POINT_MAX}`);
  }
  return n;
}

type Rankable = { points: number; createdAt: Date | string };
export function rankAwards<T extends Rankable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function splitPodium<T>(rows: T[]): { podium: T[]; rest: T[] } {
  return { podium: rows.slice(0, 3), rest: rows.slice(3) };
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `Tháng ${Number(m)}/${year}`;
}
