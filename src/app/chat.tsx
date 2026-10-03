"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

type ChatResult =
  | { status: "completed"; reply: string }
  | { status: "pending"; jobId: string; queued: boolean }
  | { status: "failed"; error: string };

const POLL_INTERVAL_MS = 3_000;
const WAKE_MESSAGE_DELAY_MS = 30_000;

async function sendMessages(
  messages: Message[],
  onQueued: (queued: boolean) => void,
): Promise<string> {
  let res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  let result: ChatResult = await res.json();

  // Cold starts can take minutes; keep polling until the job settles.
  while (result.status === "pending") {
    onQueued(result.queued);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    res = await fetch(`/api/chat/${encodeURIComponent(result.jobId)}`);
    result = await res.json();
  }

  if (result.status === "failed") throw new Error(result.error);
  return result.reply;
}

async function unlock(phrase: string): Promise<boolean> {
  const res = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
  });
  return res.ok;
}

export default function Chat({ initiallyUnlocked }: { initiallyUnlocked: boolean }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [slowWait, setSlowWait] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // iOS Safari doesn't resize the layout when the keyboard opens; it scrolls
  // the page instead. Pin the chat to the visible area so the header stays
  // put and the input sits right above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = containerRef.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
      bottomRef.current?.scrollIntoView();
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowWait(true), WAKE_MESSAGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    // Until unlocked, input is checked as the secret phrase, never sent to the model.
    if (!unlocked) {
      setInput("");
      setUnlocked(await unlock(text));
      return;
    }

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setQueued(false);
    setSlowWait(false);
    setLoading(true);
    try {
      const reply = await sendMessages(next, setQueued);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 mx-auto flex h-dvh w-full max-w-2xl flex-col px-4"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-black/10 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold">Xat en català</h1>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={loading}
            className="text-sm text-black/50 hover:text-black disabled:opacity-40 dark:text-white/50 dark:hover:text-white"
          >
            Nova conversa
          </button>
        )}
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-6">
        {!unlocked && (
          <p className="pt-20 text-center text-xs text-black/50 dark:text-white/50">
            Please enter the secret phrase to start chatting.
          </p>
        )}
        {unlocked && messages.length === 0 && (
          <p className="pt-20 text-center text-black/40 dark:text-white/40">
            Escriu un missatge en qualsevol idioma. Et respondré en català.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex">
            <div className="rounded-2xl bg-black/5 px-4 py-2 text-black/50 dark:bg-white/10 dark:text-white/50">
              Pensant…
            </div>
          </div>
        )}
        {loading && queued && slowWait && (
          <p className="text-center text-xs text-black/50 dark:text-white/50">
            AI is waking up from a nap. One moment, please.
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-red-600">Error: {error}</p>
        )}
        <div ref={bottomRef} />
      </main>

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-black/10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escriu un missatge…"
          autoFocus
          className="min-w-0 flex-1 rounded-full border border-black/15 bg-transparent px-4 py-2 text-base outline-none focus:border-blue-600 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-40"
        >
          Envia
        </button>
      </form>
    </div>
  );
}
