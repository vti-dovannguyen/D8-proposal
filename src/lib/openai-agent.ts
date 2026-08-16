import "server-only";
import { agentMockReply } from "@/lib/community";

export type AgentChatMessage = {
  role: "user" | "agent";
  text: string;
};

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  content?: OpenAIResponseContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: { message?: string };
};

function normalizeMessages(messages: AgentChatMessage[]) {
  return messages
    .filter((message) => message.text.trim())
    .slice(-20)
    .map((message) => ({
      role: message.role === "agent" ? "assistant" : "user",
      content: message.text.slice(0, 4000),
    }));
}

function extractResponseText(data: OpenAIResponse) {
  if (data.output_text?.trim()) return data.output_text.trim();
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text?.trim()) return content.text.trim();
    }
  }
  return null;
}

export async function generateAgentReply({
  agent,
  messages,
}: {
  agent: { name: string; prompt: string; description?: string | null; useCase?: string | null };
  messages: AgentChatMessage[];
}) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text ?? "";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return {
      text: agentMockReply(agent, latestUserMessage),
      mode: "mock" as const,
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: [
        `You are ${agent.name}, an internal assistant in the D8 Portal.`,
        agent.description ? `Description: ${agent.description}` : "",
        agent.useCase ? `Use case: ${agent.useCase}` : "",
        "Follow the agent instructions below. If a question is outside your scope, say so briefly and ask for the needed context.",
        "Answer in the same language as the user unless they ask otherwise.",
        agent.prompt,
      ]
        .filter(Boolean)
        .join("\n\n"),
      input: normalizeMessages(messages),
      max_output_tokens: 800,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  const text = extractResponseText(data);
  if (!text) throw new Error("OpenAI response did not include text output");

  return { text, mode: "openai" as const };
}

async function* parseOpenAITextStream(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new Error("OpenAI response did not include a stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      for (const line of dataLines) {
        if (!line || line === "[DONE]") continue;
        const data = JSON.parse(line) as { type?: string; delta?: string; error?: { message?: string } };
        if (data.error?.message) throw new Error(data.error.message);
        if (data.type === "response.output_text.delta" && typeof data.delta === "string") {
          yield data.delta;
        }
      }
    }
  }
}

export async function createAgentReplyStream({
  agent,
  messages,
}: {
  agent: { name: string; prompt: string; description?: string | null; useCase?: string | null };
  messages: AgentChatMessage[];
}) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text ?? "";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const encoder = new TextEncoder();

  if (!apiKey) {
    const text = agentMockReply(agent, latestUserMessage);
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let index = 0; index < text.length; index += 24) {
          const token = text.slice(index, index + 24);
          controller.enqueue(encoder.encode(token));
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        controller.close();
      },
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: [
        `You are ${agent.name}, an internal assistant in the D8 Portal.`,
        agent.description ? `Description: ${agent.description}` : "",
        agent.useCase ? `Use case: ${agent.useCase}` : "",
        "Follow the agent instructions below. If a question is outside your scope, say so briefly and ask for the needed context.",
        "Answer in the same language as the user unless they ask otherwise.",
        "Use Markdown formatting when it improves readability: short headings, bullet lists, tables, and fenced code blocks are allowed.",
        agent.prompt,
      ]
        .filter(Boolean)
        .join("\n\n"),
      input: normalizeMessages(messages),
      max_output_tokens: 800,
      stream: true,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
    throw new Error(data.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of parseOpenAITextStream(response)) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
