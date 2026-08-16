import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAgentReplyStream, type AgentChatMessage } from "@/lib/openai-agent";

export const runtime = "nodejs";

function threadTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { agentId?: unknown; threadId?: unknown; message?: unknown } | null;
  if (!body || typeof body.agentId !== "string" || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
  }

  const userId = session.user.id;
  const agent = await db.aIAgent.findUnique({
    where: { id: body.agentId },
    select: { id: true, name: true, description: true, useCase: true, prompt: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const existingThread =
    typeof body.threadId === "string" && body.threadId
      ? await db.agentChatThread.findFirst({
          where: { id: body.threadId, userId, agentId: agent.id },
          select: { id: true, title: true },
        })
      : null;

  const thread =
    existingThread ??
    (await db.agentChatThread.create({
      data: {
        title: threadTitle(body.message),
        userId,
        agentId: agent.id,
      },
      select: { id: true, title: true },
    }));

  await db.agentChatMessage.create({
    data: {
      threadId: thread.id,
      role: "USER",
      content: body.message.trim(),
    },
  });

  const recentHistory = await db.agentChatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { role: true, content: true },
  });

  const messages: AgentChatMessage[] = recentHistory.reverse().map((message) => ({
    role: message.role === "ASSISTANT" ? "agent" : "user",
    text: message.content,
  }));

  try {
    const openAIStream = await createAgentReplyStream({ agent, messages });
    const reader = openAIStream.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantText = "";

    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            assistantText += decoder.decode(value, { stream: true });
            controller.enqueue(value);
          }
          assistantText += decoder.decode();
          if (assistantText.trim()) {
            await db.agentChatMessage.create({
              data: {
                threadId: thread.id,
                role: "ASSISTANT",
                content: assistantText,
              },
            });
            await db.agentChatThread.update({
              where: { id: thread.id },
              data: { title: thread.title },
            });
          }
          controller.close();
        } catch (error) {
          // Log the real error server-side; never leak internals to the client.
          console.error("Agent chat stream error:", error);
          controller.enqueue(encoder.encode("\n\n> Không thể hoàn tất phản hồi. Vui lòng thử lại."));
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Thread-Id": thread.id,
        "X-Thread-Title": encodeURIComponent(thread.title),
      },
    });
  } catch (error) {
    // Log the real error server-side; return a generic message to the client.
    console.error("Agent chat error:", error);
    return NextResponse.json(
      { error: "Không thể tạo phản hồi từ agent. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
