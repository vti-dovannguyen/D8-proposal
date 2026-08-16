"use client";
import { useState, useTransition } from "react";
import { splitPodium, POINT_AWARD_TYPE_LABELS, type PointAwardType } from "@/lib/point-award";
import { deletePointAward } from "./actions";

export type BoardRow = {
  id: string;
  name: string;
  image: string | null;
  points: number;
  reason: string;
  awarder: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];

function Avatar({ row }: { row: BoardRow }) {
  if (row.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.image} alt={row.name} className="h-12 w-12 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-500">
      {row.name.charAt(0).toUpperCase()}
    </div>
  );
}

function Podium({ rows, canManage, onDelete }: { rows: BoardRow[]; canManage: boolean; onDelete: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {rows.map((r, i) => (
        <div key={r.id} className="relative rounded-xl border border-[#dbe3ef] bg-white p-4 text-center shadow-sm">
          <div className="text-3xl">{MEDAL[i]}</div>
          <div className="mt-2 flex justify-center"><Avatar row={r} /></div>
          <div className="mt-2 font-semibold text-slate-900">{r.name}</div>
          <div className="text-2xl font-black text-[var(--vti-deep,#0A3CA8)]">{r.points} điểm</div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500" title={r.reason}>{r.reason}</p>
          {canManage && (
            <button type="button" onClick={() => onDelete(r.id)} className="absolute right-2 top-2 text-xs text-red-500">Xóa</button>
          )}
        </div>
      ))}
    </div>
  );
}

function RestTable({ rows, startRank, canManage, onDelete }: {
  rows: BoardRow[]; startRank: number; canManage: boolean; onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="portal-table-card">
      <table className="portal-table">
        <thead><tr><th>#</th><th>Tên</th><th>Point</th><th>Lý do</th><th>Người thưởng</th>{canManage && <th></th>}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="font-semibold text-slate-500">{startRank + i}</td>
              <td className="font-semibold text-slate-900">{r.name}</td>
              <td>{r.points}</td>
              <td className="portal-table-muted">{r.reason}</td>
              <td className="portal-table-muted">{r.awarder}</td>
              {canManage && <td className="text-right"><button type="button" className="text-red-600" onClick={() => onDelete(r.id)}>Xóa</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PointAwardBoard({ person, project, canManage }: { person: BoardRow[]; project: BoardRow[]; canManage: boolean }) {
  const [tab, setTab] = useState<PointAwardType>("PERSON");
  const [pending, start] = useTransition();
  const rows = tab === "PERSON" ? person : project;
  const { podium, rest } = splitPodium(rows);
  const onDelete = (id: string) => { if (confirm("Xóa bản ghi thưởng này?")) start(() => deletePointAward(id)); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["PERSON", "PROJECT"] as PointAwardType[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={"rounded-lg px-4 py-1.5 text-sm font-semibold " + (tab === t ? "bg-[var(--vti-deep,#0A3CA8)] text-white" : "bg-slate-100 text-slate-600")}>
            {POINT_AWARD_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dbe3ef] bg-white px-4 py-12 text-center text-slate-400">
          Chưa có point thưởng trong tháng này.
        </div>
      ) : (
        <div className={"space-y-4 " + (pending ? "opacity-60" : "")}>
          <Podium rows={podium} canManage={canManage} onDelete={onDelete} />
          <RestTable rows={rest} startRank={podium.length + 1} canManage={canManage} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
