import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { toModelMessages, withoutTranslateCommand } from "@/lib/chat";
import { chatModel, SIGN_OFFS, SYSTEM_PROMPT, TRANSLATION_PROMPT } from "@/lib/runpod";
import { isUnlocked } from "@/lib/unlock";

// The request stays open while a cold worker starts, which can take minutes.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return new Response("Locked", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const conversation = toModelMessages(body?.messages);
  if (!conversation) {
    return new Response("Invalid messages", { status: 400 });
  }
  const { messages, translate } = withoutTranslateCommand(conversation);

  try {
    const result = streamText({
      model: chatModel(),
      instructions: translate ? TRANSLATION_PROMPT : SYSTEM_PROMPT,
      messages,
      // A translation may be of a text that ends with a sign-off.
      stopSequences: translate ? undefined : SIGN_OFFS,
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
