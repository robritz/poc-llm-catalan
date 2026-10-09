"use client";

import { useState, useSyncExternalStore } from "react";
import {
  type Exchange,
  isSameExchange,
  noSavedExchanges,
  savedExchanges,
  subscribeToSavedExchanges,
} from "@/lib/saved-exchanges";
import Reply from "./reply";

// The saved exchanges, kept up to date as they change.
export function useSavedExchanges(): Exchange[] {
  return useSyncExternalStore(subscribeToSavedExchanges, savedExchanges, noSavedExchanges);
}

// The list of saved exchanges. Each row shows a message, and opens to show
// the reply to it.
export default function SavedExchanges({ exchanges }: { exchanges: Exchange[] }) {
  // One row is open at a time, and none to begin with.
  const [open, setOpen] = useState<Exchange | null>(null);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
      {exchanges.length === 0 ? (
        <p className="px-6 pt-20 text-center text-black/40 dark:text-white/40">
          Encara no has desat res. Toca una resposta i després el marcador per desar-la.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {exchanges.map((exchange) => {
            const isOpen = open !== null && isSameExchange(open, exchange);
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
                  <div className="markdown mb-3 rounded-2xl bg-black/5 px-4 py-2 dark:bg-white/10">
                    <Reply text={exchange.reply} />
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
