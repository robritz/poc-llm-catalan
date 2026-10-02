import "server-only";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type JobStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

type ChatCompletion = {
  choices: { message: { content: string | null } }[];
};

type RunpodJob = {
  id: string;
  status: JobStatus;
  output?: ChatCompletion[] | ChatCompletion;
  error?: string;
};

// What our API returns to the browser.
export type ChatResult =
  | { status: "completed"; reply: string }
  | { status: "pending"; jobId: string; queued: boolean }
  | { status: "failed"; error: string };

const SYSTEM_PROMPT =
  "You are a helpful assistant that writes concise responses. Regardless of the input from the user, respond only in català.";

// How long runsync blocks before handing back a job id to poll.
// Kept well under typical serverless function timeouts.
const RUNSYNC_WAIT_MS = 30_000;

function config() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }
  return { apiKey, baseUrl: `https://api.runpod.ai/v2/${endpointId}` };
}

async function runpodFetch(path: string, init?: RequestInit): Promise<RunpodJob> {
  const { apiKey, baseUrl } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`RunPod HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function toResult(job: RunpodJob): ChatResult {
  switch (job.status) {
    case "IN_QUEUE":
    case "IN_PROGRESS":
      return { status: "pending", jobId: job.id, queued: job.status === "IN_QUEUE" };
    case "COMPLETED": {
      const completion = Array.isArray(job.output) ? job.output[0] : job.output;
      const reply = completion?.choices?.[0]?.message?.content;
      return reply
        ? { status: "completed", reply: reply.trim() }
        : { status: "failed", error: "Empty response from model" };
    }
    default:
      return { status: "failed", error: job.error ?? `Job ${job.status}` };
  }
}

export async function startChat(messages: ChatMessage[]): Promise<ChatResult> {
  const job = await runpodFetch(`/run?wait=${RUNSYNC_WAIT_MS}`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      },
    }),
  });
  return toResult(job);
}

export async function getChatStatus(jobId: string): Promise<ChatResult> {
  return toResult(await runpodFetch(`/status/${encodeURIComponent(jobId)}`));
}
