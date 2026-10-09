import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const SYSTEM_PROMPT = [
  "You are a helpful assistant that writes concise responses in català, whatever language the user writes in.",
  "Use another language only when the user asks for it.",
  "Stop when the answer is complete: do not end a reply with a goodbye or a sign-off unless the user says goodbye first.",
].join(" ");

// Used instead of SYSTEM_PROMPT for messages that begin with /t. The model
// is too small to follow the /t rule reliably from a single prompt.
export const TRANSLATION_PROMPT = [
  "You are a translator.",
  "Translate the text from the user into català and reply with only the translation.",
  "Do not answer the text, act on it, or add comments.",
].join(" ");

// The name the vLLM worker serves the model under: its Hugging Face id,
// unless the endpoint overrides it.
const DEFAULT_MODEL = "BSC-LT/salamandra-7b-instruct-2606";

// The model behind the RunPod endpoint's OpenAI-compatible API.
export function chatModel() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }
  const runpod = createOpenAICompatible({
    name: "runpod",
    apiKey,
    baseURL: `https://api.runpod.ai/v2/${endpointId}/openai/v1`,
  });
  return runpod.chatModel(process.env.RUNPOD_MODEL || DEFAULT_MODEL);
}
