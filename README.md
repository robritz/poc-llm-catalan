# Xat en català

A proof-of-concept chatbot that always replies in [Catalan](https://en.wikipedia.org/wiki/Catalan_language), no matter which language you write in, to help aid in learning the language. It's a Next.js app that talks to a model hosted on a [RunPod serverless](https://docs.runpod.io/serverless/overview) vLLM endpoint running [Salamandra 7B Instruct](https://huggingface.co/BSC-LT/salamandra-7b-instruct-2606).

<img width="386" height="678" alt="image" src="https://github.com/user-attachments/assets/386b9a16-38ae-4f66-8f30-8f763b23c5d3" />


## Model and AINA Kit

[Salamandra](https://huggingface.co/BSC-LT/salamandra-7b-instruct-2606) (`BSC-LT/salamandra-7b-instruct-2606`) is an instruction-tuned language model from the Language Technologies Laboratory at the Barcelona Supercomputing Center (BSC). It supports Catalan, Spanish, Basque, Galician and English, and is released under the Apache 2.0 license.

[AINA Kit](https://langtech-bsc.gitbook.io/aina-kit) is BSC's collection of open models and datasets for building AI products and services in Catalan. It's a good place to look for other Catalan models and resources to use with or alongside this app.

## Getting started

Requires Node.js 20+.

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

All are read only on the server, so the API key never reaches the browser. `.env.local` is git-ignored.

## How it works

```
Browser ──POST /api/chat──────────▶ Next.js ──POST /run──────────▶ RunPod
        ◀── pending + jobId ──────          ◀── IN_QUEUE ─────────
        ──GET /api/chat/[jobId]──▶ (every 3s) ──GET /status/{id}─▶
        ◀── completed + reply ────          ◀── COMPLETED ────────
```

- The browser sends the whole conversation on every message. The server adds the system prompt and submits a RunPod job.
- RunPod jobs are asynchronous, so the browser polls until the job finishes. The reply is read from `output[0].choices[0].message.content`, which is the OpenAI chat-completion format.
- The endpoint scales to zero when idle. **The first request after idle time can take about 3–4 minutes** while a worker starts. To absorb that wait up front, each page load begins with an "Iniciar la sessió" button. It sends a hidden "say hello" message to wake the model, and the UI shows "La IA s'està despertant. Un moment, si us plau." until the greeting comes back; only then is the chat enabled. After that the message is never shown again; a slow reply later in the session just shows "Pensant…". To avoid cold starts, set the endpoint's minimum active workers to 1 in RunPod; that worker is billed while idle.

## Secret phrase

The chat is locked until the user types the secret phrase set in `CHAT_SECRET_PHRASE` (case and extra spaces are ignored). Until then, anything typed is checked as the phrase and never sent to the model, and the UI shows "Please enter the secret phrase to start chatting."

The check runs on the server. `POST /api/unlock` sets an httpOnly cookie holding a hash of the phrase, and both chat API routes return `401` without it, so the model can't be reached by calling the API directly. The cookie lasts a year. To change the phrase, change `CHAT_SECRET_PHRASE` and restart the server; existing cookies stop working when you do. If the variable is missing, the page fails to load with an error rather than leaving the chat open.

This is a light gate to keep casual visitors out, not real authentication. Anyone who knows the phrase gets in.

## Project layout

| Path                                | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `src/lib/chat.ts`                   | Message and result types shared by browser and server, message validation |
| `src/lib/runpod.ts`                 | RunPod client: system prompt, job submission, status mapping    |
| `src/lib/unlock.ts`                 | Secret phrase check and unlock cookie                           |
| `src/app/api/unlock/route.ts`       | `POST /api/unlock`: checks the phrase and sets the cookie       |
| `src/app/api/chat/route.ts`         | `POST /api/chat`: validates messages and starts a job           |
| `src/app/api/chat/[jobId]/route.ts` | `GET /api/chat/[jobId]`: job status for polling                 |
| `src/app/chat.tsx`                  | Chat UI (client component)                                      |
| `src/app/layout.tsx`                | Root layout and mobile viewport settings                        |
| `src/app/robots.txt`                | Asks search engines not to crawl the site                       |

To change the model's behavior, edit `SYSTEM_PROMPT` in `src/lib/runpod.ts`. To change the polling interval or the session-start message, edit `POLL_INTERVAL_MS` and `GREETING_PROMPT` in `src/app/chat.tsx`.

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

Tests use [Vitest](https://vitest.dev) and React Testing Library, and sit next to the code they cover as `*.test.ts(x)`. They never call RunPod: `fetch`, cookies and the environment variables are stubbed.
