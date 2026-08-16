"use client";

import { Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useState } from "react";

type Msg = { role: "user" | "agent"; text: string };
type ThreadItem = { id: string; title: string; preview: string; updatedAt: string };

function InlineMarkdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const value = match[0];
    if (value.startsWith("**") || value.startsWith("__")) {
      nodes.push(<strong key={match.index}>{value.slice(2, -2)}</strong>);
    } else if (value.startsWith("*") || value.startsWith("_")) {
      nodes.push(<em key={match.index}>{value.slice(1, -1)}</em>);
    } else if (value.startsWith("`")) {
      nodes.push(
        <code key={match.index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-900">
          {value.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
      const href = link?.[2] ?? "";
      const isSafe = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");
      nodes.push(
        isSafe ? (
          <a key={match.index} href={href} target="_blank" rel="noreferrer" className="font-semibold text-[var(--vti-deep,#0A3CA8)] underline">
            {link?.[1]}
          </a>
        ) : (
          value
        ),
      );
    }
    lastIndex = match.index + value.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)}</>;
}

function isTableStart(lines: string[], index: number) {
  return Boolean(lines[index]?.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? ""));
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const [header, , ...rows] = lines;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {splitTableRow(header).map((cell, index) => (
              <th key={index} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left font-semibold">
                <InlineMarkdown text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {splitTableRow(row).map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-slate-200 px-2 py-1 align-top">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownMessage({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        if (block.startsWith("```")) {
          const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "");
          return (
            <pre key={blockIndex} className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              <code>{code}</code>
            </pre>
          );
        }

        const lines = block.split("\n");
        const elements: ReactNode[] = [];
        let listItems: string[] = [];

        function flushList(key: string) {
          if (listItems.length === 0) return;
          elements.push(
            <ul key={key} className="list-disc space-y-1 pl-5">
              {listItems.map((item, index) => (
                <li key={index}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>,
          );
          listItems = [];
        }

        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const trimmed = line.trim();
          if (!trimmed) {
            flushList(`list-${blockIndex}-${index}`);
            continue;
          }

          if (isTableStart(lines, index)) {
            flushList(`list-${blockIndex}-${index}`);
            const tableLines = [lines[index], lines[index + 1]];
            index += 2;
            while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
              tableLines.push(lines[index]);
              index += 1;
            }
            index -= 1;
            elements.push(<MarkdownTable key={`table-${blockIndex}-${index}`} lines={tableLines} />);
            continue;
          }

          const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
          if (bullet) {
            listItems.push(bullet[1]);
            continue;
          }

          flushList(`list-${blockIndex}-${index}`);
          const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
          if (heading) {
            const className = heading[1].length === 1 ? "text-lg font-bold" : heading[1].length === 2 ? "text-base font-bold" : "text-sm font-bold";
            elements.push(
              <p key={index} className={className}>
                <InlineMarkdown text={heading[2]} />
              </p>,
            );
            continue;
          }
          elements.push(
            <p key={index}>
              <InlineMarkdown text={trimmed} />
            </p>,
          );
        }
        flushList(`list-${blockIndex}-end`);
        return <Fragment key={blockIndex}>{elements}</Fragment>;
      })}
    </div>
  );
}

export function AgentChat({
  agent,
  initialThreads,
  activeThreadId,
  initialMessages,
}: {
  agent: { id: string; name: string };
  initialThreads: ThreadItem[];
  activeThreadId: string | null;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [currentThreadId, setCurrentThreadId] = useState(activeThreadId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setThreads(initialThreads);
    setCurrentThreadId(activeThreadId);
    setMessages(initialMessages);
  }, [activeThreadId, initialMessages, initialThreads]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const previousMessages = messages;
    const nextMessages: Msg[] = [...messages, { role: "user", text }];
    const agentMessageIndex = nextMessages.length;
    setMessages([...nextMessages, { role: "agent", text: "" }]);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, threadId: currentThreadId, message: text }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Không thể nhận phản hồi từ agent.");
      }

      const responseThreadId = response.headers.get("X-Thread-Id");
      const responseThreadTitle = decodeURIComponent(response.headers.get("X-Thread-Title") ?? "New chat");
      if (responseThreadId && responseThreadId !== currentThreadId) {
        setCurrentThreadId(responseThreadId);
        setThreads((current) => [
          { id: responseThreadId, title: responseThreadTitle, preview: text, updatedAt: new Date().toISOString() },
          ...current.filter((thread) => thread.id !== responseThreadId),
        ]);
        router.replace(`/agents/${agent.id}?thread=${responseThreadId}`, { scroll: false });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let replyText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        replyText += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message, index) => (index === agentMessageIndex ? { ...message, text: replyText } : message)),
        );
      }

      replyText += decoder.decode();
      setMessages((current) =>
        current.map((message, index) => (index === agentMessageIndex ? { ...message, text: replyText } : message)),
      );
      setThreads((current) =>
        current.map((thread) => (thread.id === (responseThreadId ?? currentThreadId) ? { ...thread, preview: replyText, updatedAt: new Date().toISOString() } : thread)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nhận phản hồi từ agent.");
      setMessages(previousMessages);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid min-h-[520px] overflow-hidden rounded-xl border bg-white lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-slate-50 p-3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Chat threads</h2>
          <button
            type="button"
            onClick={() => {
              setCurrentThreadId(null);
              setMessages([]);
              router.replace(`/agents/${agent.id}`, { scroll: false });
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100"
            title="New chat"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => {
                setCurrentThreadId(thread.id);
                router.push(`/agents/${agent.id}?thread=${thread.id}`, { scroll: false });
              }}
              className={
                "block w-full rounded-lg border px-3 py-2 text-left transition " +
                (thread.id === currentThreadId ? "border-[var(--vti-deep,#0A3CA8)] bg-white shadow-sm" : "border-transparent hover:bg-white")
              }
            >
              <span className="block truncate text-sm font-semibold text-slate-900">{thread.title}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">{thread.preview || "No messages yet"}</span>
            </button>
          ))}
          {threads.length === 0 && <p className="rounded-lg border border-dashed bg-white px-3 py-4 text-sm text-slate-400">Chưa có lịch sử chat.</p>}
        </div>
      </aside>

      <div className="flex min-h-[520px] flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Trò chuyện với {agent.name}</h2>
          <span className="portal-pill bg-emerald-50 text-emerald-700">Streaming Markdown</span>
        </div>
        <div className="mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "text-right" : ""}>
              <div
                className={
                  "inline-block max-w-[92%] rounded-lg px-3 py-2 text-left text-sm leading-6 " +
                  (message.role === "user" ? "bg-[var(--vti-deep,#0A3CA8)] text-white" : "bg-white text-slate-700 shadow-sm")
                }
              >
                {message.text ? <MarkdownMessage text={message.text} /> : <span className="text-slate-400">Đang trả lời...</span>}
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-slate-400">Gửi tin nhắn để bắt đầu.</p>}
        </div>
        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={send} className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Nhập tin nhắn..."
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={15} />
            Gửi
          </button>
        </form>
      </div>
    </section>
  );
}
