import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ChatResult } from "@/lib/chat";
import Chat from "./chat";

const START_BUTTON = "Iniciar la sessió";
const WAKE_MESSAGE = "La IA s'està despertant. Un moment, si us plau.";

// What the fake API answers for the job currently in flight.
let job: ChatResult;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
  if (url === "/api/unlock") return Response.json({ unlocked: true });
  return Response.json(job);
});

function input() {
  return screen.getByPlaceholderText<HTMLInputElement>("Escriu un missatge…");
}

async function send(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input().closest("form")!);
  });
}

async function clickStart() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: START_BUTTON }));
  });
}

// Renders an unlocked chat whose session has been started and greeted with "Hola!".
async function renderStarted() {
  job = { status: "completed", reply: "Hola!" };
  render(<Chat initiallyUnlocked />);
  await clickStart();
  job = { status: "completed", reply: "Bon dia!" };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function sentConversations() {
  return fetchMock.mock.calls
    .filter(([url]) => url === "/api/chat")
    .map(([, init]) => JSON.parse(init!.body as string).messages);
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
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();

    await send("open sesame");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/unlock");
    expect(JSON.parse(init!.body as string)).toEqual({ phrase: "open sesame" });
    expect(screen.queryByText("open sesame")).toBeNull();
    expect(screen.queryByText(/enter the secret phrase/)).toBeNull();
    expect(screen.getByRole("button", { name: START_BUTTON })).toBeDefined();
  });

  test("stays locked when the phrase is wrong", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ unlocked: false }, { status: 401 }));
    render(<Chat initiallyUnlocked={false} />);

    await send("wrong");

    expect(screen.getByText(/enter the secret phrase/)).toBeDefined();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
  });
});

describe("starting a session", () => {
  test("offers the start button and keeps chatting disabled until it's used", async () => {
    render(<Chat initiallyUnlocked />);

    expect(screen.getByRole("button", { name: START_BUTTON })).toBeDefined();
    expect(input().disabled).toBe(true);

    await send("Hello");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("asks the model to say hello and shows only the wake message while waiting", async () => {
    job = { status: "pending", jobId: "job-1", queued: true };
    render(<Chat initiallyUnlocked />);

    await clickStart();

    expect(sentConversations()).toEqual([[{ role: "user", content: "say hello" }]]);
    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
    expect(screen.queryByText("say hello")).toBeNull();
    expect(screen.queryByText("Pensant…")).toBeNull();
    expect(input().disabled).toBe(true);
  });

  test("keeps waiting through a cold start, then shows the greeting and enables chatting", async () => {
    job = { status: "pending", jobId: "job-1", queued: true };
    render(<Chat initiallyUnlocked />);
    await clickStart();

    await advance(180_000);
    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
    expect(input().disabled).toBe(true);

    job = { status: "completed", reply: "Hola!" };
    await advance(3_000);

    expect(screen.getByText("Hola!")).toBeDefined();
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.queryByText("say hello")).toBeNull();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
    expect(input().disabled).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  test("shows the error and offers the start button again when it fails", async () => {
    job = { status: "failed", error: "Upstream error" };
    render(<Chat initiallyUnlocked />);

    await clickStart();

    expect(screen.getByText("Error: Upstream error")).toBeDefined();
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(input().disabled).toBe(true);

    job = { status: "completed", reply: "Hola!" };
    await clickStart();

    expect(screen.getByText("Hola!")).toBeDefined();
    expect(screen.queryByText("Error: Upstream error")).toBeNull();
  });
});

describe("chatting", () => {
  test("shows the reply and sends the whole conversation, greeting included", async () => {
    await renderStarted();

    await send("Hello");
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText("Bon dia!")).toBeDefined();

    expect(sentConversations().at(-1)).toEqual([
      { role: "user", content: "say hello" },
      { role: "assistant", content: "Hola!" },
      { role: "user", content: "Hello" },
    ]);
  });

  test("polls a pending job until it completes", async () => {
    await renderStarted();
    job = { status: "pending", jobId: "job/1", queued: false };

    await send("Hello");
    expect(screen.getByText("Pensant…")).toBeDefined();

    job = { status: "completed", reply: "Bon dia!" };
    await advance(3_000);

    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/chat/job%2F1");
    expect(screen.getByText("Bon dia!")).toBeDefined();
    expect(screen.queryByText("Pensant…")).toBeNull();
  });

  test("shows the error when the job fails", async () => {
    await renderStarted();
    job = { status: "failed", error: "Upstream error" };

    await send("Hello");

    expect(screen.getByText("Error: Upstream error")).toBeDefined();
  });

  test("ignores blank input", async () => {
    await renderStarted();
    fetchMock.mockClear();

    await send("   ");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Nova conversa clears the conversation without restarting the session", async () => {
    await renderStarted();
    await send("Hello");

    fireEvent.click(screen.getByText("Nova conversa"));

    expect(screen.queryByText("Hola!")).toBeNull();
    expect(screen.queryByText("Hello")).toBeNull();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
    expect(screen.getByText(/Escriu un missatge en qualsevol idioma/)).toBeDefined();

    await send("Hello again");
    expect(sentConversations().at(-1)).toEqual([{ role: "user", content: "Hello again" }]);
  });
});

describe("cold start after the session has started", () => {
  test("never shows the wake message again, only Pensant…", async () => {
    await renderStarted();
    job = { status: "pending", jobId: "job-1", queued: true };
    await send("Hello");

    await advance(180_000);

    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.getByText("Pensant…")).toBeDefined();
  });
});
