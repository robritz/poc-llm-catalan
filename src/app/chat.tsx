"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type Exchange,
  isSameExchange,
  saveExchange,
  unsaveExchange,
} from "@/lib/saved-exchanges";
import Reply from "./reply";
import SavedExchanges, { useSavedExchanges } from "./saved-exchanges";

// `hidden` marks messages that are sent to the model but never rendered.
// `translate` marks messages that are to be translated instead of answered.
type ChatMessage = UIMessage<{ hidden?: boolean; translate?: boolean }>;

// Sent when the session starts, to wake the model before the user chats.
// Kept in the history so the model sees its own greeting, but never rendered.
const GREETING_PROMPT = "say hello and include a random fact about catalonia.";

// What a reply that was tapped offers under it: to be spoken, and to be saved.
// The status is how far it has got with being spoken.
type ListenStatus = "offered" | "loading" | "failed";
type Offer = { id: string; status: ListenStatus };

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

const OFFER_BUTTON_STYLE =
  "rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/20";

const SPEAKER_ICON =
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
const BOOKMARK_ICON =
  "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z";
const BOOKMARKED_ICON = "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z";
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
  const [offer, setOffer] = useState<Offer | null>(null);
  // The reply being spoken. It keeps its mute button wherever the offer goes.
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  // The number of the newest request to speak. An older one is never played.
  const newestListen = useRef(0);
  const offerRef = useRef<HTMLDivElement>(null);
  // One player for every reply, and the speech it holds: the reply last
  // loaded, and the object URL of its audio.
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedSpeech = useRef<{ id: string; url: string }>(null);
  const saved = useSavedExchanges();
  // While on, the saved exchanges are shown in place of the conversation.
  const [showingSaved, setShowingSaved] = useState(false);
  // How far the conversation was scrolled when the saved exchanges took its
  // place, for as long as nothing more has arrived in it.
  const mainRef = useRef<HTMLElement>(null);
  const scrollOnLeaving = useRef<number>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
    // The conversation is out of sight: on return, show what has arrived.
    else scrollOnLeaving.current = null;
  }, [messages, loading]);

  // Returning from the saved exchanges finds the conversation where it was.
  useLayoutEffect(() => {
    if (showingSaved) return;
    if (scrollOnLeaving.current === null) bottomRef.current?.scrollIntoView();
    else if (mainRef.current) mainRef.current.scrollTop = scrollOnLeaving.current;
    scrollOnLeaving.current = null;
  }, [showingSaved]);

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
      audioRef.current?.pause();
      if (loadedSpeech.current) URL.revokeObjectURL(loadedSpeech.current.url);
    },
    [],
  );

  // The offer appears under the reply, which may be below the visible area.
  const offerId = offer?.id;
  useEffect(() => {
    offerRef.current?.scrollIntoView({ block: "nearest" });
  }, [offerId]);

  // Any press outside the offer dismisses it. A press on a reply is left to
  // the tap it begins, which opens that reply's offer or closes its own.
  useEffect(() => {
    if (!offer) return;
    const dismiss = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-offer], [data-reply]")) setOffer(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [offer]);

  // The exchange a reply belongs to: the reply and the message it answers.
  // The greeting answers a message that is never shown, so it has none.
  function exchangeOf(replyId: string): Exchange | null {
    const at = messages.findIndex((m) => m.id === replyId);
    const message = messages[at - 1];
    if (message?.role !== "user" || message.metadata?.hidden) return null;
    return { message: messageText(message), reply: messageText(messages[at]) };
  }

  // Tapping a reply opens the offer under it, and tapping it again closes it.
  function toggleOffer(id: string) {
    if (offer?.id === id) return setOffer(null);
    // The reply being spoken already has its mute button. Unless it can be
    // saved, there is nothing more to offer.
    if (id === speakingId && !exchangeOf(id)) return;
    setOffer({ id, status: "offered" });
  }

  async function listen(id: string, text: string) {
    // Leaves the offer alone if it has moved to another reply in the meantime.
    const update = (status: ListenStatus | null) =>
      setOffer((offer) => (offer?.id === id ? status && { id, status } : offer));
    const request = ++newestListen.current;
    const isNewest = () => request === newestListen.current;
    const audio = (audioRef.current ??= new Audio());
    try {
      // A reply that was muted or has ended is spoken again as it was loaded.
      if (loadedSpeech.current?.id !== id) {
        update("loading");
        // Whatever is being spoken carries on until this has loaded. If
        // there is nothing, the tap is spent on the silence instead.
        if (!speakingId) {
          audio.src = SILENCE;
          audio.play().catch(() => {});
        }
        const url = await speechURL(text);
        // Another reply was asked for, or the conversation cleared, meanwhile.
        if (!isNewest()) {
          URL.revokeObjectURL(url);
          return;
        }
        if (loadedSpeech.current) URL.revokeObjectURL(loadedSpeech.current.url);
        loadedSpeech.current = { id, url };
      }
      // Setting the source starts the speech from the beginning.
      audio.src = loadedSpeech.current.url;
      audio.onended = () => setSpeakingId((speaking) => (speaking === id ? null : speaking));
      await audio.play();
      // The offer stays, so the reply can still be saved while it is spoken.
      update("offered");
      setSpeakingId(id);
    } catch {
      if (isNewest()) update("failed");
    }
  }

  function mute() {
    audioRef.current?.pause();
    setSpeakingId(null);
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

  // What is offered under a reply: to mute it while it is being spoken, and
  // to hear or save it once it has been tapped.
  function optionsUnder(m: ChatMessage) {
    const speaking = speakingId === m.id;
    const held = offer?.id === m.id ? offer : null;
    if (!speaking && !held) return null;
    const exchange = held && exchangeOf(m.id);
    const isSaved = exchange !== null && saved.some((one) => isSameExchange(one, exchange));
    return (
      <div
        ref={held ? offerRef : undefined}
        // A mute button left behind by an offer that was dismissed isn't one.
        data-offer={held ? "" : undefined}
        className="flex items-center gap-2"
      >
        {speaking ? (
          <button onClick={mute} aria-label="Silencia" className={OFFER_BUTTON_STYLE}>
            <Icon path={MUTE_ICON} />
          </button>
        ) : held?.status === "loading" ? (
          <button disabled className={OFFER_BUTTON_STYLE}>
            Carregant…
          </button>
        ) : (
          <button
            onClick={() => listen(m.id, messageText(m))}
            aria-label="Escolta"
            className={OFFER_BUTTON_STYLE}
          >
            <Icon path={SPEAKER_ICON} />
          </button>
        )}
        {exchange && (
          <button
            onClick={() => (isSaved ? unsaveExchange(exchange) : saveExchange(exchange))}
            aria-label="Desa"
            aria-pressed={isSaved}
            className={OFFER_BUTTON_STYLE}
          >
            <Icon path={isSaved ? BOOKMARKED_ICON : BOOKMARK_ICON} />
          </button>
        )}
        {held?.status === "failed" && (
          <p className="text-sm text-red-600">No s&apos;ha pogut reproduir l&apos;àudio.</p>
        )}
      </div>
    );
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
        <div className="flex items-center gap-3">
          {/* The mute button under the reply being spoken may be out of sight. */}
          {speakingId && (
            <button
              onClick={mute}
              aria-label="Silencia"
              className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              <Icon path={MUTE_ICON} />
            </button>
          )}
          {visibleMessages.length > 0 && !showingSaved && (
            <button
              onClick={() => {
                setMessages([]);
                clearError();
                setOffer(null);
                // Drops a reply that is still loading.
                newestListen.current++;
                mute();
              }}
              disabled={loading}
              className="text-sm text-black/50 hover:text-black disabled:opacity-40 dark:text-white/50 dark:hover:text-white"
            >
              Nova conversa
            </button>
          )}
          {unlocked && (
            <button
              onClick={() => {
                if (!showingSaved) scrollOnLeaving.current = mainRef.current?.scrollTop ?? null;
                setShowingSaved(!showingSaved);
              }}
              className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              {showingSaved ? "Torna al xat" : "Desats"}
            </button>
          )}
        </div>
      </header>

      {showingSaved ? (
        <SavedExchanges exchanges={saved} />
      ) : (
        <main ref={mainRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-6">
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
                {/* Tapping a reply offers to speak it and to save it. */}
                <div
                  data-reply
                  onClick={(e) => {
                    // Not for a link, which the tap follows, nor for a drag
                    // that selected some of the text.
                    if ((e.target as Element).closest("a")) return;
                    if (!window.getSelection()?.isCollapsed) return;
                    // Not while a reply is still being written.
                    if (!loading) toggleOffer(m.id);
                  }}
                  className="markdown max-w-[85%] rounded-2xl bg-black/5 px-4 py-2 dark:bg-white/10"
                >
                  <Reply text={messageText(m)} />
                </div>
                {optionsUnder(m)}
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
      )}

      {/* Hidden, not removed, behind the saved exchanges: the input keeps what
          was typed and isn't focused afresh on return. */}
      <form
        onSubmit={handleSubmit}
        hidden={showingSaved}
        className={`${showingSaved ? "hidden" : "flex"} shrink-0 gap-2 border-t border-black/10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10`}
      >
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
