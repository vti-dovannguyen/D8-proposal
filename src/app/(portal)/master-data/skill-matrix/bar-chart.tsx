import { LEVEL_HEX } from "@/lib/skill-matrix";

export function BarChart({ data }: { data: { level: number; label: string; count: number }[] }) {
  const W = 360, H = 170, padX = 20, padTop = 16, padBottom = 28;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const gap = 14;
  const barW = (W - padX * 2 - gap * (n - 1)) / n;
  const plotH = H - padTop - padBottom;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Số lượng đánh giá theo level">
      {data.map((d, i) => {
        const h = (plotH * d.count) / max;
        const x = padX + i * (barW + gap);
        const y = H - padBottom - h;
        return (
          <g key={d.level}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={LEVEL_HEX[d.level]} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="11" fill="#334155">{d.count}</text>
            <text x={x + barW / 2} y={H - padBottom + 13} textAnchor="middle" fontSize="9" fill="#64748b">{d.level}</text>
          </g>
        );
      })}
    </svg>
  );
}
