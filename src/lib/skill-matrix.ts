export type LevelMeta = { label: string; cellClass: string; swatchClass: string };

const META: Record<number, LevelMeta> = {
  0: { label: "None", cellClass: "bg-slate-100 text-slate-400", swatchClass: "bg-slate-200" },
  1: { label: "Basic", cellClass: "bg-red-400 text-white", swatchClass: "bg-red-400" },
  2: { label: "Working", cellClass: "bg-orange-400 text-white", swatchClass: "bg-orange-400" },
  3: { label: "Proficient", cellClass: "bg-amber-400 text-slate-900", swatchClass: "bg-amber-400" },
  4: { label: "Expert", cellClass: "bg-emerald-200 text-emerald-900", swatchClass: "bg-emerald-200" },
  5: { label: "Can Train Others", cellClass: "bg-emerald-500 text-white", swatchClass: "bg-emerald-500" },
};

export const LEVELS = [0, 1, 2, 3, 4, 5] as const;

export const LEVEL_HEX: Record<number, string> = {
  0: "#e2e8f0", 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#a7f3d0", 5: "#10b981",
};

export function levelMeta(level: number): LevelMeta {
  return META[level] ?? META[0];
}

export type LevelLookup = Record<string, Record<string, number>>;

export function levelDistribution(
  rows: { id: string }[],
  skills: { id: string }[],
  levels: LevelLookup,
): { level: number; label: string; count: number }[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const bySkill = levels[r.id] ?? {};
    for (const s of skills) {
      const lvl = bySkill[s.id] ?? 0;
      if (lvl >= 1 && lvl <= 5) counts[lvl]++;
    }
  }
  return [1, 2, 3, 4, 5].map((level) => ({ level, label: levelMeta(level).label, count: counts[level] }));
}

export function avgPerSkill(
  rows: { id: string }[],
  skills: { id: string; name: string }[],
  levels: LevelLookup,
): { skillId: string; name: string; avg: number }[] {
  return skills.map((s) => {
    if (rows.length === 0) return { skillId: s.id, name: s.name, avg: 0 };
    let sum = 0;
    for (const r of rows) sum += levels[r.id]?.[s.id] ?? 0;
    return { skillId: s.id, name: s.name, avg: Math.round((sum / rows.length) * 10) / 10 };
  });
}
