import { isSpeechAvailable } from "@/lib/tts";
import { isUnlocked } from "@/lib/unlock";

export async function GET() {
  if (!(await isUnlocked())) {
    return new Response("Locked", { status: 401 });
  }
  return (await isSpeechAvailable())
    ? new Response("OK")
    : new Response("Unavailable", { status: 503 });
}
