"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";

export type ChangePasswordState = { error: string; success: boolean };

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`, success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Xác nhận mật khẩu không khớp.", success: false };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.password || !(await verifyPassword(currentPassword, user.password))) {
    return { error: "Mật khẩu hiện tại không đúng.", success: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { password: await hashPassword(newPassword) },
  });
  return { error: "", success: true };
}
