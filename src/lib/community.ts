import { isManager } from "@/lib/permissions";
import type { Role } from "@/types";

/** A topic may be deleted by its author or by any manager. */
export function canDeleteTopic(role: Role, authorId: string, userId: string): boolean {
  return userId === authorId || isManager(role);
}

/**
 * Deterministic, offline mock reply for the AI agent chat. No external API,
 * no randomness, no Date — same input always yields the same output so the
 * client chat is testable and free. Client-safe (pure).
 */
export function agentMockReply(
  agent: { name: string; prompt: string },
  message: string
): string {
  const trimmed = (message ?? "").trim();
  if (!trimmed) {
    return `Xin chào! Tôi là ${agent.name}. Hãy đặt câu hỏi để bắt đầu.`;
  }
  const hint = agent.prompt.length > 120 ? agent.prompt.slice(0, 120) + "…" : agent.prompt;
  return `[Mô phỏng] Tôi là ${agent.name}. Dựa trên hướng dẫn "${hint}", đây là phản hồi mẫu cho: "${trimmed}". (Phản hồi mô phỏng — chưa kết nối AI thật.)`;
}
