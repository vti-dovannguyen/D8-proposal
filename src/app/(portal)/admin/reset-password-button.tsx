"use client";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { resetUserPassword } from "./actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  return (
    <ConfirmButton
      label="Reset mật khẩu"
      confirmLabel="Xác nhận reset?"
      onConfirm={() => resetUserPassword(userId)}
    />
  );
}
