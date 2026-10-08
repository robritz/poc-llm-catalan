"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

// `hidden` marks messages that are sent to the model but never rendered.
type ChatMessage = UIMessage<{ hidden?: boolean }>;

// Sent when the session starts, to wake the model before the user chats.
// Kept in the history so the model sees its own greeting, but never rendered.
const GREETING_PROMPT = "say hello and include a random fact about catalonia.";

function messageText(message: ChatMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
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
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat<ChatMessage>({
      // The session has started once the model has answered the greeting.
      onFinish: ({ isAbort, isDisconnect, isError }) => {
        if (!isAbort && !isDisconnect && !isError) setStarted(true);
      },
    });
  const loading = status === "submitted" || status === "streaming";
  const inputRef = useRef<HTMLInputElement>(null);
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

  // The input is disabled until the session starts, so it can't autofocus.
  useEffect(() => {
    if (started) inputRef.current?.focus();
  }, [started]);

  function startSession() {
    // Drop the greeting left behind by a failed attempt.
    setMessages([]);
    sendMessage({ text: GREETING_PROMPT, metadata: { hidden: true } });
  }

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
    if (!started) return;

    setInput("");
    sendMessage({ text });
  }

  const inputDisabled = unlocked && !started;
  // The greeting stays out of sight until it has arrived in full.
  const visibleMessages = started
    ? messages.filter((m) => !m.metadata?.hidden && messageText(m))
    : [];
  const lastMessage = messages.at(-1);
  const replying = lastMessage?.role === "assistant" && messageText(lastMessage) !== "";

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 mx-auto flex h-dvh w-full max-w-2xl flex-col px-4"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-black/10 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold">Xat en català</h1>
        {visibleMessages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              clearError();
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
        {unlocked && !started && (
          <div className="flex h-3/4 items-center justify-center">
            {loading ? (
              <p className="text-center text-xs text-black/50 dark:text-white/50">
                La IA s&apos;està despertant. Un moment, si us plau.
              </p>
            ) : (
              <button
                onClick={startSession}
                className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white"
              >
                Iniciar la sessió
              </button>
            )}
          </div>
        )}
        {started && visibleMessages.length === 0 && (
          <p className="pt-20 text-center text-black/40 dark:text-white/40">
            Escriu un missatge en qualsevol idioma. Et respondré en català.
          </p>
        )}
        {visibleMessages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {messageText(m)}
            </div>
          </div>
        ))}
        {started && loading && !replying && (
          <div className="flex">
            <div className="rounded-2xl bg-black/5 px-4 py-2 text-black/50 dark:bg-white/10 dark:text-white/50">
              Pensant…
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-red-600">Error: {error.message}</p>
        )}
        <div ref={bottomRef} />
      </main>

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-black/10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escriu un missatge…"
          ref={inputRef}
          autoFocus
          disabled={inputDisabled}
          className="min-w-0 flex-1 rounded-full border border-black/15 bg-transparent px-4 py-2 text-base outline-none focus:border-blue-600 disabled:opacity-40 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={loading || inputDisabled || !input.trim()}
          className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-40"
        >
          Envia
        </button>
      </form>
    </div>
  );
}
