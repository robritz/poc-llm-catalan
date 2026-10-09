import "server-only";

// Where the Matxa-TTS API lives, unless TTS_API_URL points somewhere else.
const DEFAULT_API_URL = "http://localhost:8000";

// The API rejects longer text.
export const MAX_SPEECH_LENGTH = 2000;

const VOICE_SETTINGS = {
  voice: "grau",
  format: "wav",
  steps: 20,
  speaking_rate: 0.9,
};

// Asks the TTS API to speak the text. Resolves to its response, whose body
// is the audio when the response is ok.
export function synthesize(text: string): Promise<Response> {
  const baseURL = (process.env.TTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  return fetch(`${baseURL}/v1/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...VOICE_SETTINGS }),
  });
}
