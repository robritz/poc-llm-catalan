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
