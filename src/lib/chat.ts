// Validation of the conversation the browser sends to the chat API route.

import type { ModelMessage } from "ai";

function text(parts: unknown[]): string {
  return parts
    .map((p) => {
      const part = p as { type?: unknown; text?: unknown } | null;
      return part?.type === "text" && typeof part.text === "string" ? part.text : "";
    })
    .join("");
}

// Reduces the UI messages sent by useChat to plain user and assistant text.
// Returns null for anything else, so a client can't supply its own system
// prompt or attach files.
export function toModelMessages(value: unknown): ModelMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages: ModelMessage[] = [];
  for (const m of value) {
    if ((m?.role !== "user" && m?.role !== "assistant") || !Array.isArray(m.parts)) {
      return null;
    }
    if (m.parts.some((p: { type?: unknown } | null) => p?.type === "file")) return null;
    const content = text(m.parts);
    // A reply that failed before any text arrived leaves an empty message behind.
    if (content) messages.push({ role: m.role, content });
  }
  return messages.length > 0 ? messages : null;
}

// Typed before a message to have it translated instead of answered.
const TRANSLATE_COMMAND = /^\s*\/t(\s+|$)/i;

// Splits off the /t command. A request for a translation is reduced to the
// text to translate; otherwise the command is removed from earlier messages
// so the model never sees it.
export function withoutTranslateCommand(messages: ModelMessage[]): {
  messages: ModelMessage[];
  translate: boolean;
} {
  const strip = (m: ModelMessage): ModelMessage =>
    m.role === "user" && typeof m.content === "string"
      ? { ...m, content: m.content.replace(TRANSLATE_COMMAND, "") }
      : m;
  const last = messages[messages.length - 1];
  const stripped = strip(last);
  if (last.role === "user" && stripped.content !== last.content && stripped.content) {
    const content = `Translate this text into català:\n\n${stripped.content}`;
    return { messages: [{ role: "user", content }], translate: true };
  }
  return {
    messages: messages.map(strip).filter((m) => m.content),
    translate: false,
  };
}
