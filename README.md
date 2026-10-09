# Xat en català

A proof-of-concept chatbot that replies in [Catalan](https://en.wikipedia.org/wiki/Catalan_language), no matter which language you write in, to help aid in learning the language. It switches to another language only when you ask it to, and translates any message you start with `/t` into Catalan. It's a Next.js app built on the [Vercel AI SDK](https://ai-sdk.dev) that talks to a model hosted on a [RunPod serverless](https://docs.runpod.io/serverless/overview) vLLM endpoint running [Salamandra 7B Instruct](https://huggingface.co/BSC-LT/salamandra-7b-instruct-2606).

<img width="386" height="678" alt="image" src="https://github.com/user-attachments/assets/386b9a16-38ae-4f66-8f30-8f763b23c5d3" />


## Model and AINA Kit

[Salamandra](https://huggingface.co/BSC-LT/salamandra-7b-instruct-2606) (`BSC-LT/salamandra-7b-instruct-2606`) is an instruction-tuned language model from the Language Technologies Laboratory at the Barcelona Supercomputing Center (BSC). It supports Catalan, Spanish, Basque, Galician and English, and is released under the Apache 2.0 license.

[AINA Kit](https://langtech-bsc.gitbook.io/aina-kit) is BSC's collection of open models and datasets for building AI products and services in Catalan. It's a good place to look for other Catalan models and resources to use with or alongside this app.

## Getting started

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000.

| Variable             | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `RUNPOD_API_KEY`     | RunPod API key with access to the endpoint                      |
| `RUNPOD_ENDPOINT_ID` | The endpoint ID, e.g. `xdtr2cvjsqwsuu` from `api.runpod.ai/v2/<id>` |
| `CHAT_SECRET_PHRASE` | Phrase users must type to unlock the chat (see below)           |
| `RUNPOD_MODEL`       | Optional. The name the endpoint serves the model under, if it isn't `BSC-LT/salamandra-7b-instruct-2606` |
| `TTS_API_URL`        | Optional. Base URL of the Matxa-TTS API that speaks replies (see below). Defaults to `http://localhost:8000` |

All are read only on the server, so the API key never reaches the browser. `.env.local` is git-ignored.

## How it works

```
Browser ──POST /api/chat──▶ Next.js ──POST /openai/v1/chat/completions──▶ RunPod
        ◀── UI message stream ──    ◀── OpenAI-format token stream ──────
```

- The browser uses the AI SDK's `useChat` hook, which sends the whole conversation on every message. The server keeps only the user and assistant text, adds the system prompt, and calls the model with `streamText` through the endpoint's OpenAI-compatible API (`/openai/v1`).
- A message that begins with `/t` is translated into Catalan instead of answered, e.g. `/t Where do you live?` gets "On vius?". The server spots the command, removes it, and sends only that text to the model, without the rest of the conversation, with a translation prompt in place of the usual system prompt. The model is too small to follow a `/t` rule reliably from the system prompt alone.
- The reply is streamed back and shown as it is written. Until the first words arrive, the UI shows "Pensant…".
- The endpoint scales to zero when idle. **The first request after idle time can take about 3–4 minutes** while a worker starts, and the request stays open for all of that time. To absorb that wait up front, each page load begins with an "Iniciar la sessió" button. It sends a hidden message to wake the model, asking it to say hello and share a random fact about Catalonia, and the UI shows "La IA s'està despertant. Un moment, si us plau." until the greeting comes back; only then is the chat enabled. After that the message is never shown again; a slow reply later in the session just shows "Pensant…". To avoid cold starts, set the endpoint's minimum active workers to 1 in RunPod; that worker is billed while idle.
- Because the request stays open during a cold start, `/api/chat` sets `maxDuration` to 300 seconds. If your host caps function time below the cold start, the session start fails with an error and can be retried once the worker is up.

## Hearing a reply

Press and hold a reply for half a second and a play button appears under it. Tapping it plays the reply as speech; pressing anywhere else dismisses it.

```
Browser ──POST /api/speak──▶ Next.js ──POST /v1/tts──▶ Matxa-TTS API
        ◀── audio/wav ──────         ◀── audio/wav ───
```

The speech comes from a Matxa-TTS API, expected at `http://localhost:8000`. Once it is hosted, set `TTS_API_URL` to its base URL; nothing else needs to change, because the browser only ever calls `/api/speak`. That route is behind the secret phrase like the chat, and rejects text that is longer than the 2,000 characters the API accepts once normalized. The voice, format, steps and speaking rate are in `VOICE_SETTINGS` in `src/lib/tts.ts`.

The model behind the API, [Matxa-TTS v2](https://huggingface.co/BSC-LT/matxa-tts-v2-ca-multiaccent-graphemes), reads graphemes: only Catalan letters and a little punctuation, with numbers written out in words. The API rejects anything else, so `/api/speak` first normalizes the reply in `src/lib/speech-text.ts`: numbers and a few symbols (`%`, `€`, `$`, `&`, `+`, `=`) become Catalan words, Markdown, links and emoji are removed, and each line ends as a sentence. Numbers are always read in the masculine ("dos", not "dues"), and abbreviations and ordinals are not expanded.

## Secret phrase

The chat is locked until the user types the secret phrase set in `CHAT_SECRET_PHRASE` (case and extra spaces are ignored). Until then, anything typed is checked as the phrase and never sent to the model, and the UI shows "Please enter the secret phrase to start chatting."

The check runs on the server. `POST /api/unlock` sets an httpOnly cookie holding a hash of the phrase, and the chat API route returns `401` without it, so the model can't be reached by calling the API directly. The cookie lasts a year. To change the phrase, change `CHAT_SECRET_PHRASE` and restart the server; existing cookies stop working when you do. If the variable is missing, the page fails to load with an error rather than leaving the chat open.

This is a light gate to keep casual visitors out, not real authentication. Anyone who knows the phrase gets in.

## Project layout

| Path                                | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `src/lib/chat.ts`                   | Validates the browser's messages, reduces them to plain text, and handles the `/t` command |
| `src/lib/runpod.ts`                 | System and translation prompts, and the AI SDK model for the RunPod endpoint |
| `src/lib/unlock.ts`                 | Secret phrase check and unlock cookie                           |
| `src/lib/speech-text.ts`            | Normalizes a reply into text the TTS model can read             |
| `src/lib/tts.ts`                    | Voice settings and the request to the Matxa-TTS API             |
| `src/app/api/unlock/route.ts`       | `POST /api/unlock`: checks the phrase and sets the cookie       |
| `src/app/api/chat/route.ts`         | `POST /api/chat`: validates messages and streams the reply      |
| `src/app/api/speak/route.ts`        | `POST /api/speak`: returns a reply as spoken audio              |
| `src/app/chat.tsx`                  | Chat UI (client component)                                      |
| `src/app/layout.tsx`                | Root layout and mobile viewport settings                        |
| `src/app/robots.txt`                | Asks search engines not to crawl the site                       |

To change the model's behavior, edit `SYSTEM_PROMPT` in `src/lib/runpod.ts`; `TRANSLATION_PROMPT` in the same file is used for `/t` messages. To change the session-start message, edit `GREETING_PROMPT` in `src/app/chat.tsx`.

## Mobile

The input bar stays above the on-screen keyboard. Android Chrome does this through the viewport setting `interactive-widget=resizes-content` in `layout.tsx`. iOS Safari ignores that setting, so `chat.tsx` sizes the chat container to `window.visualViewport` instead.

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
npm test        # Vitest in watch mode; `npm test -- run` for a single run
```

## Tests

Tests use [Vitest](https://vitest.dev) and React Testing Library, and sit next to the code they cover as `*.test.ts(x)`. They never call RunPod: `fetch`, the model, cookies and the environment variables are stubbed.
