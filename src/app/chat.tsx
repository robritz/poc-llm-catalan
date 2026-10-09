"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// `hidden` marks messages that are sent to the model but never rendered.
// `translate` marks messages that are to be translated instead of answered.
type ChatMessage = UIMessage<{ hidden?: boolean; translate?: boolean }>;

// Sent when the session starts, to wake the model before the user chats.
// Kept in the history so the model sees its own greeting, but never rendered.
const GREETING_PROMPT = "say hello and include a random fact about catalonia.";

// How long a reply must be held before the option to hear it appears.
const HOLD_MS = 500;

// A reply that offers to be spoken, after being held, or to be muted while
// it is being spoken.
type ListenStatus = "offered" | "loading" | "playing" | "failed";
type ListenOffer = { id: string; status: ListenStatus };

// An empty WAV file. Playing it during the tap lets iOS Safari play the
// speech later, once it has loaded; by then the tap no longer counts.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function messageText(message: ChatMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

// Fetches the reply as speech. Resolves to a URL the audio can be played from.
async function speechURL(text: string): Promise<string> {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return URL.createObjectURL(await res.blob());
}

// A model often breaks lines without leaving a blank line between them.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Links in a reply open in a new tab so the conversation isn't lost.
function ReplyLink({ node, ...props }: React.ComponentProps<"a"> & ExtraProps) {
  void node; // react-markdown's syntax node, not an attribute
  const external = !props.href?.startsWith("#");
  return <a {...props} {...(external && { target: "_blank", rel: "noopener noreferrer" })} />;
}

const LISTEN_BUTTON_STYLE =
  "rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/20";

const SPEAKER_ICON =
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
const MUTE_ICON =
  "M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z";

// As tall as a line of the button's text, so the button keeps its height
// when the icon gives way to "Carregant…".
function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d={path} />
    </svg>
  );
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
  // While on, what the user enters is translated as-is instead of answered.
  const [translating, setTranslating] = useState(false);
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
  const [listenOffer, setListenOffer] = useState<ListenOffer | null>(null);
  const listenOfferRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // One player for every reply, and the object URL of the speech it holds.
  const audioRef = useRef<HTMLAudioElement>(null);
  const speechURLRef = useRef<string>(null);

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

  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      audioRef.current?.pause();
      if (speechURLRef.current) URL.revokeObjectURL(speechURLRef.current);
    },
    [],
  );

  // The offer appears under the reply, which may be below the visible area.
  const listenOfferId = listenOffer?.id;
  useEffect(() => {
    listenOfferRef.current?.scrollIntoView({ block: "nearest" });
  }, [listenOfferId]);

  // Any press outside the offer dismisses it, except while the reply is
  // being spoken: the mute button stays for as long as there is sound.
  useEffect(() => {
    if (!listenOffer || listenOffer.status === "playing") return;
    const dismiss = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-listen-offer]")) setListenOffer(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [listenOffer]);

  function startHold(id: string) {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      // One reply at a time: the new offer replaces the mute button.
      audioRef.current?.pause();
      setListenOffer({ id, status: "offered" });
    }, HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
  }

  async function listen(id: string, text: string) {
    // Leaves the offer alone if it has moved to another reply in the meantime.
    const update = (status: ListenStatus | null) =>
      setListenOffer((offer) => (offer?.id === id ? status && { id, status } : offer));
    update("loading");
    const audio = (audioRef.current ??= new Audio());
    audio.src = SILENCE;
    audio.play().catch(() => {});
    try {
      const url = await speechURL(text);
      if (speechURLRef.current) URL.revokeObjectURL(speechURLRef.current);
      speechURLRef.current = url;
      audio.src = url;
      audio.onended = () => update(null);
      await audio.play();
      update("playing");
    } catch {
      update("failed");
    }
  }

  function mute() {
    audioRef.current?.pause();
    setListenOffer(null);
  }

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
    sendMessage(translating ? { text, metadata: { translate: true } } : { text });
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
              mute();
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
        {visibleMessages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-white">
                {messageText(m)}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-start gap-1">
              {/* Holding a reply offers to speak it. On touch screens the
                  hold would otherwise select the text. */}
              <div
                onPointerDown={() => {
                  // Not while a reply is still being written.
                  if (!loading) startHold(m.id);
                }}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                className="markdown max-w-[85%] rounded-2xl bg-black/5 px-4 py-2 dark:bg-white/10 [@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none]"
              >
                {/* Images are dropped: a reply must not make the browser fetch a URL. */}
                <Markdown
                  remarkPlugins={REMARK_PLUGINS}
                  components={{ a: ReplyLink }}
                  disallowedElements={["img"]}
                >
                  {messageText(m)}
                </Markdown>
              </div>
              {listenOffer?.id === m.id && (
                <div ref={listenOfferRef} data-listen-offer className="flex items-center gap-2">
                  {listenOffer.status === "playing" ? (
                    <button onClick={mute} aria-label="Silencia" className={LISTEN_BUTTON_STYLE}>
                      <Icon path={MUTE_ICON} />
                    </button>
                  ) : listenOffer.status === "loading" ? (
                    <button disabled className={LISTEN_BUTTON_STYLE}>
                      Carregant…
                    </button>
                  ) : (
                    <button
                      onClick={() => listen(m.id, messageText(m))}
                      aria-label="Escolta"
                      className={LISTEN_BUTTON_STYLE}
                    >
                      <Icon path={SPEAKER_ICON} />
                    </button>
                  )}
                  {listenOffer.status === "failed" && (
                    <p className="text-sm text-red-600">No s&apos;ha pogut reproduir l&apos;àudio.</p>
                  )}
                </div>
              )}
            </div>
          ),
        )}
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
        <button
          type="button"
          aria-label="Tradueix"
          title="Tradueix"
          aria-pressed={translating}
          onClick={() => {
            setTranslating((on) => !on);
            inputRef.current?.focus();
          }}
          disabled={!started}
          className={`shrink-0 rounded-full border p-2 disabled:opacity-40 ${
            translating
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-black/15 text-black/50 hover:text-black dark:border-white/20 dark:text-white/50 dark:hover:text-white"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            <path d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={translating ? "Escriu un text per traduir…" : "Escriu un missatge…"}
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
