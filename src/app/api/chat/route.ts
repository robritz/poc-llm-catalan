import { startChat, type ChatMessage } from "@/lib/runpod";
import { isUnlocked } from "@/lib/unlock";

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return Response.json({ status: "failed", error: "Locked" }, { status: 401 });
  }

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
