"use client";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteAgent } from "../actions";

export function DeleteAgentButton({ id }: { id: string }) {
  return <ConfirmButton label="Xóa" onConfirm={() => deleteAgent(id)} />;
}
