import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentReplyStream, generateAgentReply } from "@/lib/openai-agent";

const originalFetch = global.fetch;

const agent = {
  name: "BrSE Helper",
  description: "Translate and summarize project documents",
  useCase: "BrSE daily work",
  prompt: "Be concise and preserve technical terms.",
};

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  global.fetch = originalFetch;
});

describe("generateAgentReply", () => {
  it("uses the deterministic mock when OPENAI_API_KEY is not configured", async () => {
    const reply = await generateAgentReply({
      agent,
      messages: [{ role: "user", text: "Dịch giúp tôi" }],
    });

    expect(reply.mode).toBe("mock");
    expect(reply.text).toContain("[Mô phỏng]");
    expect(reply.text).toContain("Dịch giúp tôi");
  });

  it("calls OpenAI Responses API with agent instructions and chat history", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "Xin chào từ OpenAI" }),
    });
    global.fetch = fetchMock;

    const reply = await generateAgentReply({
      agent,
      messages: [
        { role: "user", text: "Hello" },
        { role: "agent", text: "Hi" },
        { role: "user", text: "Summarize this" },
      ],
    });

    expect(reply).toEqual({ mode: "openai", text: "Xin chào từ OpenAI" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      instructions: string;
      input: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-model");
    expect(body.instructions).toContain(agent.prompt);
    expect(body.input).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Summarize this" },
    ]);
  });

  it("throws OpenAI error messages", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limited" } }),
    });

    await expect(generateAgentReply({ agent, messages: [{ role: "user", text: "Hi" }] })).rejects.toThrow("Rate limited");
  });

  it("streams OpenAI output text deltas", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":" **world**"}\n\n'));
          controller.close();
        },
      }),
    });

    const stream = await createAgentReplyStream({ agent, messages: [{ role: "user", text: "Hi" }] });
    const text = await new Response(stream).text();

    expect(text).toBe("Hello **world**");
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as { stream: boolean };
    expect(body.stream).toBe(true);
  });
});
