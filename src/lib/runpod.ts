import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Written in català, the language the model was tuned on, and phrased as
// what to do rather than what to avoid.
export const SYSTEM_PROMPT = [
  "Ets un assistent útil que escriu respostes concises en català, sigui quina sigui la llengua en què escrigui l'usuari.",
  "Fes servir una altra llengua només quan l'usuari t'ho demani.",
  "Acaba la resposta quan hagis respost la pregunta.",
  "Dona només la resposta, res més.",
].join(" ");

// The model signs its replies off whatever the prompt says, so generation is
// stopped where a sign-off would begin. A stop is cut from the reply, so each
// one starts after the full stop of the sentence before it; the capital
// keeps "Salutacions" from matching in the middle of a sentence.
// The endpoint accepts four at most: with a fifth it returns an empty stream.
export const SIGN_OFFS = ["\nSalutacions", " Salutacions", "(fi)"];

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
