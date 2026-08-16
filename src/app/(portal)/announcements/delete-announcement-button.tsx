"use client";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteAnnouncement } from "./actions";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  return <ConfirmButton label="Xóa" confirmLabel="Xác nhận?" className="px-2 py-1 text-xs" onConfirm={() => deleteAnnouncement(id)} />;
}
