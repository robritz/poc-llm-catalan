import { speechText } from "@/lib/speech-text";
import { MAX_SPEECH_LENGTH, synthesize } from "@/lib/tts";
import { isUnlocked } from "@/lib/unlock";

// Long replies take a while to synthesise.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return new Response("Locked", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  // The limit applies to what is sent, which grows as numbers become words.
  const text = typeof body?.text === "string" ? speechText(body.text) : "";
  if (!text || text.length > MAX_SPEECH_LENGTH) {
    return new Response("Invalid text", { status: 400 });
  }

  try {
    const speech = await synthesize(text);
    if (!speech.ok) {
      throw new Error(`TTS HTTP ${speech.status}: ${await speech.text()}`);
    }
    return new Response(speech.body, {
      headers: { "Content-Type": speech.headers.get("Content-Type") ?? "audio/wav" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Upstream error", { status: 502 });
  }
}
