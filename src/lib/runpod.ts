import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const SYSTEM_PROMPT =
  'You are a helpful assistant that writes concise responses.' +
  'Regardless of the input from the user, respond only in català.' +
  'When the user types /t at the beginning the input, treat it like a translation request and return their message translated into català. Omit /t in the response.' +
  'Return the response in another language when requested.';

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
