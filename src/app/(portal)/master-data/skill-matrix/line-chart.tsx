export function LineChart({ data }: { data: { skillId: string; name: string; avg: number }[] }) {
  const W = 520, H = 180, padX = 30, padY = 18, maxLevel = 5;
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : padX + ((W - padX * 2) * i) / (n - 1));
  const y = (v: number) => H - padY - ((H - padY * 2) * v) / maxLevel;
  const points = data.map((d, i) => `${x(i)},${y(d.avg)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Độ thành thạo trung bình theo skill">
      {[0, 1, 2, 3, 4, 5].map((g) => (
        <g key={g}>
          <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#eef2f7" strokeWidth="1" />
          <text x={padX - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{g}</text>
        </g>
      ))}
      {n > 1 && <polyline points={points} fill="none" stroke="#0A3CA8" strokeWidth="2" />}
      {data.map((d, i) => (
        <circle key={d.skillId} cx={x(i)} cy={y(d.avg)} r="3" fill="#0A3CA8">
          <title>{d.name}: {d.avg}</title>
        </circle>
      ))}
      {n === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="#94a3b8">Không có dữ liệu</text>}
    </svg>
  );
}
