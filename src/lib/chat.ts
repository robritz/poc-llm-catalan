// Types and validation shared by the browser and the API routes.

export type ChatMessage = { role: "user" | "assistant"; content: string };

// What our API returns to the browser.
export type ChatResult =
  | { status: "completed"; reply: string }
  | { status: "pending"; jobId: string; queued: boolean }
  | { status: "failed"; error: string };

export function isChatMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string",
    )
  );
}
