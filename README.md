# Xat en català

A proof-of-concept chatbot that always replies in Catalan, whatever language you write in. It's a Next.js app that talks to a model hosted on a [RunPod serverless](https://docs.runpod.io/serverless/overview) vLLM endpoint (currently `BSC-LT/salamandra-7b-instruct-2606`).

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

Both are read only on the server, so the API key never reaches the browser. `.env.local` is git-ignored.

## How it works

```
Browser ──POST /api/chat──────────▶ Next.js ──POST /run──────────▶ RunPod
        ◀── pending + jobId ──────          ◀── IN_QUEUE ─────────
        ──GET /api/chat/[jobId]──▶ (every 3s) ──GET /status/{id}─▶
        ◀── completed + reply ────          ◀── COMPLETED ────────
```

- The browser sends the whole conversation on every message. The server adds the system prompt and submits a RunPod job.
- RunPod jobs are asynchronous, so the browser polls until the job finishes. The reply is read from `output[0].choices[0].message.content`, which is the OpenAI chat-completion format.
- The endpoint scales to zero when idle. **The first request after idle time can take about 3–4 minutes** while a worker starts. If a job is still `IN_QUEUE` after 10 seconds, the UI shows "AI is waking up from a nap. One moment, please." To avoid cold starts, set the endpoint's minimum active workers to 1 in RunPod; that worker is billed while idle.

## Project layout

| Path                                | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `src/lib/runpod.ts`                 | RunPod client: system prompt, job submission, status mapping    |
| `src/app/api/chat/route.ts`         | `POST /api/chat`: validates messages and starts a job           |
| `src/app/api/chat/[jobId]/route.ts` | `GET /api/chat/[jobId]`: job status for polling                 |
| `src/app/chat.tsx`                  | Chat UI (client component)                                      |
| `src/app/layout.tsx`                | Root layout and mobile viewport settings                        |

To change the model's behavior, edit `SYSTEM_PROMPT` in `src/lib/runpod.ts`. To change the timings, edit `POLL_INTERVAL_MS` and `WAKE_MESSAGE_DELAY_MS` in `src/app/chat.tsx`.

## Mobile

The input bar stays above the on-screen keyboard. Android Chrome does this through the viewport setting `interactive-widget=resizes-content` in `layout.tsx`. iOS Safari ignores that setting, so `chat.tsx` sizes the chat container to `window.visualViewport` instead.

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```
