"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { POINT_AWARD_TYPE_LABELS, type PointAwardType } from "@/lib/point-award";
import { createPointAward } from "../actions";

type Opt = { id: string; name: string };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PointAwardForm({ users, projects }: { users: Opt[]; projects: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<PointAwardType>("PERSON");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState("");
  const [sendNotification, setSendNotification] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const labelCls = "text-sm font-medium text-slate-700";
  const inputCls = "mt-1 block w-full rounded-lg border border-[#dbe3ef] px-3 py-2 text-sm";

  const submit = () => {
    setError("");
    if (!reason.trim()) { setError("Lý do là bắt buộc"); return; }
    if (type === "PERSON" && !userId) { setError("Vui lòng chọn cá nhân"); return; }
    if (type === "PROJECT" && !projectId) { setError("Vui lòng chọn dự án"); return; }
    if (!Number.isInteger(points) || points < 0 || points > 100) { setError("Point phải là số nguyên 0..100"); return; }
    start(async () => {
      try {
        await createPointAward({ month, type, userId, projectId, points, reason, sendNotification, imageFile });
        router.push("/point-award");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="max-w-xl space-y-4 rounded-xl border border-[#dbe3ef] bg-white p-5 shadow-sm"
    >
      <div>
        <label className={labelCls}>Tháng</label>
        <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div>
        <span className={labelCls}>Loại</span>
        <div className="mt-1 flex gap-4">
          {(["PERSON", "PROJECT"] as PointAwardType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
              {POINT_AWARD_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      {type === "PERSON" ? (
        <div>
          <label className={labelCls}>Cá nhân</label>
          <select className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Chọn cá nhân —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className={labelCls}>Dự án</label>
          <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Chọn dự án —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>Point (0–100)</label>
        <input type="number" min={0} max={100} step={1} className={inputCls} value={points}
          onChange={(e) => setPoints(Number(e.target.value))} />
      </div>

      <div>
        <label className={labelCls}>Lý do thưởng</label>
        <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendNotification}
          onChange={(e) => {
            setSendNotification(e.target.checked);
            if (!e.target.checked) setImageFile(null);
          }}
        />
        Gửi thông báo đến Group chat Google
      </label>

      {sendNotification && (
        <div>
          <label className={labelCls}>Ảnh đính kèm (tùy chọn)</label>
          <input
            type="file"
            accept="image/*"
            className={inputCls}
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-slate-400">PNG/JPG/GIF/WEBP. GIF sẽ hiển thị động trong thông báo.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Đang tạo…" : "Tạo"}
      </button>
    </form>
  );
}
