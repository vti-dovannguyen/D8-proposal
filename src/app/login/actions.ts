"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function credentialsSignIn(_prevState: string, formData: FormData): Promise<string> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return "";
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email hoặc mật khẩu không đúng.";
    }
    throw error;
  }
}
