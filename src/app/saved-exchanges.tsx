"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type Exchange,
  isSameExchange,
  noSavedExchanges,
  savedExchanges,
  subscribeToSavedExchanges,
  unsaveExchange,
} from "@/lib/saved-exchanges";
import ListenButton, { ListenFailure, OFFER_BUTTON_STYLE, type Sound } from "./listen-button";
import Icon from "./path-icon";
import Reply from "./reply";

const DELETE_ICON =
  "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z";

// The saved exchanges, kept up to date as they change.
export function useSavedExchanges(): Exchange[] {
  return useSyncExternalStore(subscribeToSavedExchanges, savedExchanges, noSavedExchanges);
}

// The list of saved exchanges. Each row shows a message, and opens to show
// the reply to it, which can be heard while speech is available. The sound is
// the chat's: it carries on when the row is closed and when the list is.
export default function SavedExchanges({
  exchanges,
  speechAvailable,
  soundOf,
  onListen,
  onMute,
}: {
  exchanges: Exchange[];
  speechAvailable: boolean;
  soundOf: (exchange: Exchange) => Sound;
  onListen: (exchange: Exchange) => void;
  onMute: () => void;
}) {
  // One row is open at a time, and none to begin with.
  const [open, setOpen] = useState<Exchange | null>(null);
  // A row whose exchange has left the list, deleted in another tab perhaps,
  // is no longer open: saved again, it comes back closed.
  if (open !== null && !exchanges.some((exchange) => isSameExchange(open, exchange))) setOpen(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Where the keyboard's focus is to go once the list has changed. Deleting
  // a row would otherwise leave it on a button that is gone.
  const focusAfterChange = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    focusAfterChange.current?.();
    focusAfterChange.current = null;
  }, [exchanges]);

  function remove(exchange: Exchange, place: number) {
    // To the row that takes its place, or the last row if it was the last.
    focusAfterChange.current = () => {
      const rows = listRef.current?.querySelectorAll<HTMLButtonElement>("[aria-expanded]");
      rows?.[Math.min(place, rows.length - 1)]?.focus();
    };
    // Refused by the browser: the row stays as it is.
    if (!unsaveExchange(exchange)) focusAfterChange.current = null;
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
      {exchanges.length === 0 ? (
        <p className="px-6 pt-20 text-center text-black/40 dark:text-white/40">
          Encara no has desat res. Toca una resposta i després el marcador per desar-la.
        </p>
      ) : (
        <ul ref={listRef} className="divide-y divide-black/10 dark:divide-white/10">
          {exchanges.map((exchange, place) => {
            const isOpen = open !== null && isSameExchange(open, exchange);
            const sound = soundOf(exchange);
            return (
              <li key={JSON.stringify([exchange.message, exchange.reply])}>
                {/* A long message is cut to one line until its row is opened. */}
                <button
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : exchange)}
                  className={`block w-full py-3 text-left ${isOpen ? "whitespace-pre-wrap font-medium" : "truncate"}`}
                >
                  {exchange.message}
                </button>
                {isOpen && (
                  <div className="mb-3 flex flex-col items-start gap-1">
                    <div className="markdown rounded-2xl bg-black/5 px-4 py-2 dark:bg-white/10">
                      <Reply text={exchange.reply} />
                    </div>
                    <div className="flex items-center gap-2">
                      <ListenButton
                        sound={sound}
                        available={speechAvailable}
                        onListen={() => onListen(exchange)}
                        onMute={onMute}
                      />
                      {/* Out of reach until the row is open, so that it isn't
                          pressed by mistake. */}
                      <button
                        onClick={() => remove(exchange, place)}
                        aria-label="Suprimeix"
                        className={OFFER_BUTTON_STYLE}
                      >
                        <Icon path={DELETE_ICON} />
                      </button>
                      {sound === "failed" && <ListenFailure />}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
