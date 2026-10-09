// The saved exchanges, kept in the browser's localStorage so that they
// outlive the conversation and the session. Nothing else reads or writes it.

// A message together with the reply to it.
export type Exchange = { message: string; reply: string };

const KEY = "saved-exchanges";
const VERSION = 1;

const NONE: Exchange[] = [];

// Message ids don't survive a reload, so an exchange is known by its text.
export function isSameExchange(a: Exchange, b: Exchange): boolean {
  return a.message === b.message && a.reply === b.reply;
}

function isExchange(value: unknown): value is Exchange {
  const exchange = value as Partial<Exchange> | null;
  return typeof exchange?.message === "string" && typeof exchange.reply === "string";
}

// Anything that isn't a list this version wrote is read as nothing saved.
function parse(stored: string | null): Exchange[] {
  if (stored === null) return NONE;
  try {
    const { version, exchanges } = JSON.parse(stored);
    if (version === VERSION && Array.isArray(exchanges) && exchanges.every(isExchange)) {
      return exchanges;
    }
  } catch {}
  return NONE;
}

// The list as last read, kept so that reading it twice without a change in
// between gives the same array. React needs that of a store it subscribes to.
let lastRead: { stored: string | null; exchanges: Exchange[] } = { stored: null, exchanges: NONE };

// What is stored, or nothing if the browser won't let storage be read.
function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// The saved exchanges, in the order the user keeps them.
export function savedExchanges(): Exchange[] {
  const stored = read();
  if (stored !== lastRead.stored) lastRead = { stored, exchanges: parse(stored) };
  return lastRead.exchanges;
}

// What the server renders: it can't see the browser's storage.
export function noSavedExchanges(): Exchange[] {
  return NONE;
}

const listeners = new Set<() => void>();

// Calls the listener whenever the list changes, in this tab or another.
// Returns a function that stops it.
export function subscribeToSavedExchanges(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Every change starts from what is stored now, not from what a page last
// showed, so one tab can't undo what another has saved. Returns whether the
// change was stored: the browser refuses when storage is full or blocked,
// and what was stored is then left as it was.
function change(apply: (exchanges: Exchange[]) => Exchange[]): boolean {
  const exchanges = apply(savedExchanges());
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, exchanges }));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

// Puts the exchange at the top of the list, unless it is already saved.
// Returns whether that could be stored.
export function saveExchange(exchange: Exchange): boolean {
  return change((exchanges) =>
    exchanges.some((saved) => isSameExchange(saved, exchange)) ? exchanges : [exchange, ...exchanges],
  );
}

// Takes the exchange out of the list. Deleting a saved exchange is this too.
// Returns whether that could be stored.
export function unsaveExchange(exchange: Exchange): boolean {
  return change((exchanges) => exchanges.filter((saved) => !isSameExchange(saved, exchange)));
}
