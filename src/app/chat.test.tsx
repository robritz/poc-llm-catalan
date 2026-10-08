import { act, fireEvent, render, screen } from "@testing-library/react";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Chat from "./chat";

const START_BUTTON = "Iniciar la sessió";
const WAKE_MESSAGE = "La IA s'està despertant. Un moment, si us plau.";

// What the fake API does with the next chat request: stream a reply, fail,
// or (for a pending promise) keep the request open like a cold start.
let answer: Response | Promise<Response>;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
  if (url === "/api/unlock") return Response.json({ unlocked: true });
  return answer;
});

function reply(text: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id: "t" });
        writer.write({ type: "text-delta", id: "t", delta: text });
        writer.write({ type: "text-end", id: "t" });
        writer.write({ type: "finish" });
      },
    }),
  });
}

function failure(message: string) {
  return new Response(message, { status: 502 });
}

// A request that stays open until `resolve` is called.
function coldStart() {
  let resolve!: (res: Response) => void;
  answer = new Promise((r) => (resolve = r));
  return async (res: Response) => {
    await act(async () => resolve(res));
    await settle();
  };
}

// Lets a streamed reply be read to the end.
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function input() {
  return screen.getByPlaceholderText<HTMLInputElement>("Escriu un missatge…");
}

async function send(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input().closest("form")!);
  });
  await settle();
}

async function clickStart() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: START_BUTTON }));
  });
  await settle();
}

// Renders an unlocked chat whose session has been started and greeted with "Hola!".
async function renderStarted() {
  answer = reply("Hola!");
  render(<Chat initiallyUnlocked />);
  await clickStart();
  answer = reply("Bon dia!");
}

// The text of each conversation sent to the model.
function sentConversations() {
  return fetchMock.mock.calls
    .filter(([url]) => url === "/api/chat")
    .map(([, init]) =>
      JSON.parse(init!.body as string).messages.map(
        (m: { role: string; parts: { type: string; text?: string }[] }) => ({
          role: m.role,
          content: m.parts.map((p) => p.text ?? "").join(""),
        }),
      ),
    );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  answer = reply("Bon dia!");
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
    coldStart();
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
    const finish = coldStart();
    render(<Chat initiallyUnlocked />);
    await clickStart();

    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
    expect(input().disabled).toBe(true);

    await finish(reply("Hola!"));

    expect(screen.getByText("Hola!")).toBeDefined();
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.queryByText("say hello")).toBeNull();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
    expect(input().disabled).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  test("shows the error and offers the start button again when it fails", async () => {
    answer = failure("Upstream error");
    render(<Chat initiallyUnlocked />);

    await clickStart();

    expect(screen.getByText("Error: Upstream error")).toBeDefined();
    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(input().disabled).toBe(true);

    answer = reply("Hola!");
    await clickStart();

    expect(screen.getByText("Hola!")).toBeDefined();
    expect(screen.queryByText("Error: Upstream error")).toBeNull();
    expect(sentConversations().at(-1)).toEqual([{ role: "user", content: "say hello" }]);
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

  test("shows Pensant… until the reply starts arriving", async () => {
    await renderStarted();
    const finish = coldStart();

    await send("Hello");
    expect(screen.getByText("Pensant…")).toBeDefined();

    await finish(reply("Bon dia!"));

    expect(screen.getByText("Bon dia!")).toBeDefined();
    expect(screen.queryByText("Pensant…")).toBeNull();
  });

  test("shows the error when the request fails", async () => {
    await renderStarted();
    answer = failure("Upstream error");

    await send("Hello");

    expect(screen.getByText("Error: Upstream error")).toBeDefined();
  });

  test("shows an error reported in the middle of the stream", async () => {
    await renderStarted();
    answer = createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => writer.write({ type: "error", errorText: "Upstream error" }),
      }),
    });

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
    coldStart();
    await send("Hello");

    expect(screen.queryByText(WAKE_MESSAGE)).toBeNull();
    expect(screen.getByText("Pensant…")).toBeDefined();
  });
});
