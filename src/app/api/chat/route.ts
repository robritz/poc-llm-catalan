import { startChat, type ChatMessage } from "@/lib/runpod";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: unknown = body?.messages;

  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string",
    );
  if (!valid) {
    return Response.json({ status: "failed", error: "Invalid messages" }, { status: 400 });
  }

  try {
    return Response.json(await startChat(messages as ChatMessage[]));
  } catch (err) {
    console.error(err);
    return Response.json({ status: "failed", error: "Upstream error" }, { status: 502 });
  }
}
