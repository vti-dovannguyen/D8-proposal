"use client";
import { useTransition } from "react";
import { likeTopic, pinTopic, deleteTopic } from "../actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function TopicActionsBar({ id, pinned, canPin, canDelete }: { id: string; pinned: boolean; canPin: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={pending} aria-label="Thích chủ đề" onClick={() => start(() => likeTopic(id))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">♥ Thích</button>
      {canPin && (
        <button disabled={pending} aria-label={pinned ? "Bỏ ghim" : "Ghim chủ đề"} onClick={() => start(() => pinTopic(id, !pinned))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">{pinned ? "Bỏ ghim" : "Ghim"}</button>
      )}
      {canDelete && <ConfirmButton label="Xóa" onConfirm={() => deleteTopic(id)} />}
    </div>
  );
}
