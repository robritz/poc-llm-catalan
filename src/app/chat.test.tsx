import { act, fireEvent, render, screen } from "@testing-library/react";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Chat from "./chat";

const GREETING = "say hello and include a random fact about catalonia.";
const START_BUTTON = "Iniciar la sessió";
const WAKE_MESSAGE = "La IA s'està despertant. Un moment, si us plau.";
const LISTEN_BUTTON = "Escolta";
const MUTE_BUTTON = "Silencia";
const TRANSLATE_TOGGLE = "Tradueix";

// What the fake API does with the next chat request: stream a reply, fail,
// or (for a pending promise) keep the request open like a cold start.
let answer: Response | Promise<Response>;
// What the fake API answers when asked to speak a reply.
let speech: Response | Promise<Response>;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
  if (url === "/api/unlock") return Response.json({ unlocked: true });
  if (url === "/api/speak") return speech;
  return answer;
});

// The sources of the speech that has been played. jsdom can't play audio.
let played: string[];
class FakeAudio {
  // The player the chat speaks through, once it has made one.
  static current: FakeAudio;
  src = "";
  paused = true;
  onended: (() => void) | null = null;
  constructor() {
    FakeAudio.current = this;
  }
  async play() {
    this.paused = false;
    // Leaves out the silent clip played to unlock audio on iOS.
    if (!this.src.startsWith("data:")) played.push(this.src);
  }
  pause() {
    this.paused = true;
  }
}

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
  return screen.getByRole<HTMLInputElement>("textbox");
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

// Presses a message without letting go, for the given time.
function hold(text: string, ms: number) {
  vi.useFakeTimers();
  fireEvent.pointerDown(screen.getByText(text));
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  vi.useRealTimers();
}

async function clickListen() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: LISTEN_BUTTON }));
  });
  await settle();
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

// Whether each message of the last conversation sent asked to be translated.
function sentTranslateFlags() {
  const [, init] = fetchMock.mock.calls.findLast(([url]) => url === "/api/chat")!;
  return JSON.parse(init!.body as string).messages.map(
    (m: { metadata?: { translate?: boolean } }) => m.metadata?.translate === true,
  );
}

function translateToggle() {
  return screen.getByRole<HTMLButtonElement>("button", { name: TRANSLATE_TOGGLE });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  answer = reply("Bon dia!");
  speech = new Response("wav", { headers: { "Content-Type": "audio/wav" } });
  played = [];
  vi.stubGlobal("Audio", FakeAudio);
  // jsdom doesn't implement object URLs.
  URL.createObjectURL = vi.fn(() => "blob:speech");
  URL.revokeObjectURL = vi.fn();
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
    coldStart();
    render(<Chat initiallyUnlocked />);

    await clickStart();

    expect(sentConversations()).toEqual([[{ role: "user", content: GREETING }]]);
    expect(screen.getByText(WAKE_MESSAGE)).toBeDefined();
    expect(screen.queryByRole("button", { name: START_BUTTON })).toBeNull();
    expect(screen.queryByText(GREETING)).toBeNull();
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
    expect(screen.queryByText(GREETING)).toBeNull();
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
    expect(sentConversations().at(-1)).toEqual([{ role: "user", content: GREETING }]);
  });
});

describe("chatting", () => {
  test("shows the reply and sends the whole conversation, greeting included", async () => {
    await renderStarted();

    await send("Hello");
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText("Bon dia!")).toBeDefined();

    expect(sentConversations().at(-1)).toEqual([
      { role: "user", content: GREETING },
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

describe("translating", () => {
  test("is off to begin with, so a message is sent as a normal chat message", async () => {
    await renderStarted();
    expect(translateToggle().getAttribute("aria-pressed")).toBe("false");

    await send("Where do you live?");

    expect(sentTranslateFlags()).toEqual([false, false, false]);
  });

  test("sends the text to be translated, exactly as entered, while it's on", async () => {
    await renderStarted();

    fireEvent.click(translateToggle());
    expect(translateToggle().getAttribute("aria-pressed")).toBe("true");
    await send("Where do you live?");

    expect(sentConversations().at(-1).at(-1)).toEqual({
      role: "user",
      content: "Where do you live?",
    });
    expect(sentTranslateFlags()).toEqual([false, false, true]);
    expect(screen.getByText("Where do you live?")).toBeDefined();
  });

  test("stays on until it's switched off", async () => {
    await renderStarted();

    fireEvent.click(translateToggle());
    await send("Good morning");
    expect(translateToggle().getAttribute("aria-pressed")).toBe("true");
    await send("Good night");
    expect(sentTranslateFlags().slice(-3)).toEqual([true, false, true]);

    fireEvent.click(translateToggle());
    await send("Thanks");
    expect(sentTranslateFlags().at(-1)).toBe(false);
  });

  test("sits before the input and returns the cursor to it", async () => {
    await renderStarted();

    expect(input().previousElementSibling).toBe(translateToggle());
    fireEvent.click(translateToggle());
    expect(document.activeElement).toBe(input());
  });

  test("can't be switched on before the session has started", () => {
    render(<Chat initiallyUnlocked />);
    expect(translateToggle().disabled).toBe(true);
  });
});

describe("markdown", () => {
  test("formats markdown in a reply", async () => {
    await renderStarted();
    answer = reply("Barcelona és **molt** gran.");

    await send("Hello");

    expect(screen.getByText("molt").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  test("formats a table in a reply", async () => {
    await renderStarted();
    answer = reply("| Ciutat | Habitants |\n| --- | --- |\n| Girona | 100.000 |");

    await send("Hello");

    expect(screen.getByRole("columnheader", { name: "Ciutat" })).toBeDefined();
    expect(screen.getByRole("cell", { name: "Girona" })).toBeDefined();
  });

  test("opens a link in a reply in a new tab", async () => {
    await renderStarted();
    answer = reply("Mira [la Viquipèdia](https://ca.wikipedia.org).");

    await send("Hello");

    const link = screen.getByRole<HTMLAnchorElement>("link", { name: "la Viquipèdia" });
    expect(link.href).toBe("https://ca.wikipedia.org/");
    expect(link.target).toBe("_blank");
  });

  test("keeps the line breaks of a reply", async () => {
    await renderStarted();
    answer = reply("Primera línia\nSegona línia");

    await send("Hello");

    const bubble = screen.getByText(/Primera línia/);
    expect(bubble.querySelectorAll("br")).toHaveLength(1);
  });

  test("doesn't load an image a reply points to", async () => {
    await renderStarted();
    answer = reply("Mira ![un gat](https://example.com/gat.png) aquí.");

    await send("Hello");

    expect(screen.getByText(/Mira/)).toBeDefined();
    expect(document.querySelector("img")).toBeNull();
  });

  test("shows the user's own message exactly as typed", async () => {
    await renderStarted();

    await send("what does **molt** mean?");

    expect(screen.getByText("what does **molt** mean?")).toBeDefined();
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

describe("hearing a reply", () => {
  test("offers to speak a reply that is held for half a second", async () => {
    await renderStarted();

    hold("Hola!", 499);
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();

    hold("Hola!", 500);
    // The offer is a speaker icon, named for screen readers but with no word on it.
    const button = screen.getByRole("button", { name: LISTEN_BUTTON });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("doesn't offer it when the reply is let go early, or for the user's own message", async () => {
    await renderStarted();
    await send("Hello");

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("Hola!"));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    fireEvent.pointerUp(screen.getByText("Hola!"));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    hold("Hello", 5000);

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("doesn't offer it while a reply is still being written", async () => {
    await renderStarted();
    coldStart();
    await send("Hello");

    hold("Hola!", 500);

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("withdraws the offer when something else is pressed", async () => {
    await renderStarted();
    hold("Hola!", 500);

    fireEvent.pointerDown(input());

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("speaks the reply when the offer is taken", async () => {
    await renderStarted();
    hold("Hola!", 500);

    await clickListen();

    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/speak")!;
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ text: "Hola!" });
    expect(played).toEqual(["blob:speech"]);
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("shows it is loading while the audio is prepared", async () => {
    await renderStarted();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    hold("Hola!", 500);

    await clickListen();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Carregant…" }).disabled).toBe(true);
    expect(played).toEqual([]);

    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toEqual(["blob:speech"]);
    expect(screen.queryByRole("button", { name: "Carregant…" })).toBeNull();
  });

  test("offers to mute the reply once it is being spoken", async () => {
    await renderStarted();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    hold("Hola!", 500);

    await clickListen();
    expect(screen.queryByRole("button", { name: MUTE_BUTTON })).toBeNull();

    await act(async () => resolve(new Response("wav")));
    await settle();

    const button = screen.getByRole("button", { name: MUTE_BUTTON });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("ends the sound when it is muted", async () => {
    await renderStarted();
    hold("Hola!", 500);
    await clickListen();
    expect(FakeAudio.current.paused).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: MUTE_BUTTON }));

    expect(FakeAudio.current.paused).toBe(true);
    expect(screen.queryByRole("button", { name: MUTE_BUTTON })).toBeNull();
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("withdraws the mute button when the speech ends", async () => {
    await renderStarted();
    hold("Hola!", 500);
    await clickListen();

    act(() => FakeAudio.current.onended!());

    expect(screen.queryByRole("button", { name: MUTE_BUTTON })).toBeNull();
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("keeps the mute button when something else is pressed", async () => {
    await renderStarted();
    hold("Hola!", 500);
    await clickListen();

    fireEvent.pointerDown(input());

    expect(screen.getByRole("button", { name: MUTE_BUTTON })).toBeDefined();
    expect(FakeAudio.current.paused).toBe(false);
  });

  test("ends the sound when another reply is held or the conversation is cleared", async () => {
    await renderStarted();
    await send("Hello");
    hold("Hola!", 500);
    await clickListen();

    hold("Bon dia!", 500);

    expect(FakeAudio.current.paused).toBe(true);
    expect(screen.queryByRole("button", { name: MUTE_BUTTON })).toBeNull();
    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();

    await clickListen();
    expect(FakeAudio.current.paused).toBe(false);

    fireEvent.click(screen.getByText("Nova conversa"));

    expect(FakeAudio.current.paused).toBe(true);
  });

  test("says so when the reply can't be spoken", async () => {
    await renderStarted();
    speech = new Response("Upstream error", { status: 502 });
    hold("Hola!", 500);

    await clickListen();

    expect(screen.getByText("No s'ha pogut reproduir l'àudio.")).toBeDefined();
    expect(played).toEqual([]);
  });
});
