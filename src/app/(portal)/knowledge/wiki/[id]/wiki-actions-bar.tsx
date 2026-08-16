"use client";
import { deleteWiki } from "../actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function WikiActionsBar({ id }: { id: string }) {
  return <ConfirmButton label="Xóa trang" onConfirm={() => deleteWiki(id)} />;
}
