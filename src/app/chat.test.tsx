import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ChatResult } from "@/lib/chat";
import Chat from "./chat";

const WAKE_MESSAGE = /AI is waking up from a nap/;

// What the fake API answers for the job currently in flight.
let job: ChatResult;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
  if (url === "/api/unlock") return Response.json({ unlocked: true });
  return Response.json(job);
});

async function send(text: string) {
  const input = screen.getByPlaceholderText("Escriu un missatge…");
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function chatRequests() {
  return fetchMock.mock.calls.filter(([url]) => url === "/api/chat");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  job = { status: "completed", reply: "Bon dia!" };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("locked", () => {
  test("checks input as the secret phrase instead of sending it to the model", async () => {
    render(<Chat initiallyUnlocked={false} />);
    expect(screen.getByText(/enter the secret phrase/)).toBeDefined();

    await send("open sesame");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/unlock");
    expect(JSON.parse(init!.body as string)).toEqual({ phrase: "open sesame" });
    expect(screen.queryByText("open sesame")).toBeNull();
    expect(screen.queryByText(/enter the secret phrase/)).toBeNull();
  });

  test("stays locked when the phrase is wrong", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ unlocked: false }, { status: 401 }));
    render(<Chat initiallyUnlocked={false} />);

    await send("wrong");

    expect(screen.getByText(/enter the secret phrase/)).toBeDefined();
  });
});

describe("chatting", () => {
  test("shows the reply and sends the whole conversation on the next message", async () => {
    render(<Chat initiallyUnlocked />);

    await send("Hello");
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText("Bon dia!")).toBeDefined();

    await send("How are you?");
    const body = JSON.parse(chatRequests()[1][1]!.body as string);
    expect(body.messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Bon dia!" },
      { role: "user", content: "How are you?" },
    ]);
  });

  test("polls a pending job until it completes", async () => {
    job = { status: "pending", jobId: "job/1", queued: false };
    render(<Chat initiallyUnlocked />);

    await send("Hello");
    expect(screen.getByText("Pensant…")).toBeDefined();

    job = { status: "completed", reply: "Bon dia!" };
    await advance(3_000);

    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/chat/job%2F1");
    expect(screen.getByText("Bon dia!")).toBeDefined();
    expect(screen.queryByText("Pensant…")).toBeNull();
  });

  test("shows the error when the job fails", async () => {
    job = { status: "failed", error: "Upstream error" };
    render(<Chat initiallyUnlocked />);

    await send("Hello");

    expect(screen.getByText("Error: Upstream error")).toBeDefined();
  });

  test("ignores blank input", async () => {
    render(<Chat initiallyUnlocked />);
    await send("   ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Nova conversa clears the conversation", async () => {
    render(<Chat initiallyUnlocked />);
    await send("Hello");

    fireEvent.click(screen.getByText("Nova conversa"));

    expect(screen.queryByText("Hello")).toBeNull();
    expect(screen.getByText(/Escriu un missatge en qualsevol idioma/)).toBeDefined();
  });
});

describe("wake message", () => {
  test("appears once a queued job has waited 30 seconds", async () => {
    job = { status: "pending", jobId: "job-1", queued: true };
    render(<Chat initiallyUnlocked />);
    await send("Hello");

    await advance(29_000);
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();

    await advance(1_000);
    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
  });

  test("doesn't appear while the job is running rather than queued", async () => {
    job = { status: "pending", jobId: "job-1", queued: false };
    render(<Chat initiallyUnlocked />);
    await send("Hello");

    await advance(60_000);

    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.getByText("Pensant…")).toBeDefined();
  });

  test("is only shown for the first cold start", async () => {
    job = { status: "pending", jobId: "job-1", queued: true };
    render(<Chat initiallyUnlocked />);
    await send("Hello");
    await advance(30_000);
    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();

    job = { status: "completed", reply: "Bon dia!" };
    await advance(3_000);
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();

    job = { status: "pending", jobId: "job-2", queued: true };
    await send("Hello again");
    await advance(60_000);

    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.getByText("Pensant…")).toBeDefined();
  });

  test("still shows on a later cold start if an earlier slow reply never showed it", async () => {
    job = { status: "pending", jobId: "job-1", queued: false };
    render(<Chat initiallyUnlocked />);
    await send("Hello");
    await advance(60_000);
    job = { status: "completed", reply: "Bon dia!" };
    await advance(3_000);

    job = { status: "pending", jobId: "job-2", queued: true };
    await send("Hello again");
    await advance(30_000);

    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
  });
});
