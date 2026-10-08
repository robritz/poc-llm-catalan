import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { toModelMessages } from "@/lib/chat";
import { chatModel, SYSTEM_PROMPT } from "@/lib/runpod";
import { isUnlocked } from "@/lib/unlock";

// The request stays open while a cold worker starts, which can take minutes.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return new Response("Locked", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const messages = toModelMessages(body?.messages);
  if (!messages) {
    return new Response("Invalid messages", { status: 400 });
  }

  try {
    const result = streamText({
      model: chatModel(),
      instructions: SYSTEM_PROMPT,
      messages,
      onError: ({ error }) => console.error(error),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        // Don't leak upstream details to the browser.
        onError: () => "Upstream error",
      }),
    });
  } catch (err) {
    console.error(err);
    return new Response("Upstream error", { status: 502 });
  }
}
