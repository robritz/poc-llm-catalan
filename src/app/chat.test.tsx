import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Chat from "./chat";

const GREETING = "say hello and include a random fact about catalonia.";
const START_BUTTON = "Iniciar la sessió";
const WAKE_MESSAGE = "La IA s'està despertant. Un moment, si us plau.";
const LISTEN_BUTTON = "Escolta";
const MUTE_BUTTON = "Silencia";
const TRANSLATE_TOGGLE = "Tradueix";
const SAVE_TOGGLE = "Desa";
const SAVED_BUTTON = "Desats";
const BACK_BUTTON = "Torna al xat";
const DELETE_BUTTON = "Suprimeix";
const NOTHING_SAVED =
  "Encara no has desat res. Toca una resposta i després el marcador per desar-la.";

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

// Taps a message or reply as a finger would: the press comes before the click.
function tap(element: Element | string) {
  const target = typeof element === "string" ? screen.getByText(element) : element;
  fireEvent.pointerDown(target);
  fireEvent.click(target);
}

async function clickListen() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: LISTEN_BUTTON }));
  });
  await settle();
}

// The mute button under the reply being spoken, if there is one.
function replyMute() {
  return within(screen.getByRole("main")).queryByRole("button", { name: MUTE_BUTTON });
}

// Whether the mute button in the conversation sits above the given reply.
function replyMuteIsAbove(text: string) {
  const position = replyMute()!.compareDocumentPosition(screen.getByText(text));
  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

// The mute button in the header, if there is one.
function headerMute() {
  return within(screen.getByRole("banner")).queryByRole("button", { name: MUTE_BUTTON });
}

// The bookmark under the reply that was tapped.
function saveToggle() {
  return screen.getByRole<HTMLButtonElement>("button", { name: SAVE_TOGGLE });
}

// Presses the bookmark as a finger would: the press comes before the click.
function pressSaveToggle() {
  fireEvent.pointerDown(saveToggle());
  fireEvent.click(saveToggle());
}

// Taps a reply and presses the bookmark under it.
function toggleSaved(replyText: string) {
  tap(replyText);
  pressSaveToggle();
}

function openSaved() {
  fireEvent.click(screen.getByRole("button", { name: SAVED_BUTTON }));
}

function backToChat() {
  fireEvent.click(screen.getByRole("button", { name: BACK_BUTTON }));
}

// The row of a saved exchange: the button that carries its message.
function savedRow(message: string) {
  return screen.getByRole("button", { name: message });
}

// The messages of the saved exchanges, in the order the list shows them.
// A row is the button that opens; the ones under its reply don't.
function savedMessages() {
  const rows = screen.getByRole("list").querySelectorAll("button[aria-expanded]");
  return Array.from(rows, (row) => row.textContent);
}

// A button under the reply of the saved exchange with the given message.
function savedRowButton(message: string, name: string) {
  const item = savedRow(message).closest("li")!;
  return within(item).getByRole<HTMLButtonElement>("button", { name });
}

// Saves an exchange for each message, so that the list shows them in this order.
async function renderSaved(...messages: string[]) {
  await renderStarted();
  for (const message of messages.toReversed()) {
    answer = reply(`Resposta a ${message}`);
    await send(message);
    toggleSaved(`Resposta a ${message}`);
  }
  openSaved();
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
  localStorage.clear();
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
  test("offers to speak a reply that is tapped", async () => {
    await renderStarted();
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();

    tap("Hola!");

    // The offer is a speaker icon, named for screen readers but with no word on it.
    const button = screen.getByRole("button", { name: LISTEN_BUTTON });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("withdraws the offer when the reply is tapped again", async () => {
    await renderStarted();
    tap("Hola!");

    tap("Hola!");

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("moves the offer to another reply that is tapped", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");

    tap("Bon dia!");

    expect(screen.getAllByRole("button", { name: LISTEN_BUTTON })).toHaveLength(1);
    expect(saveToggle()).toBeDefined();
  });

  test("doesn't offer it for the user's own message", async () => {
    await renderStarted();
    await send("Hello");

    tap("Hello");

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("doesn't offer it when a link in the reply is tapped", async () => {
    await renderStarted();
    answer = reply("Mira [Viquipèdia](https://ca.wikipedia.org)");
    await send("Hello");

    tap(screen.getByRole("link", { name: "Viquipèdia" }));

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("doesn't offer it while a reply is still being written", async () => {
    await renderStarted();
    coldStart();
    await send("Hello");

    tap("Hola!");

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("withdraws the offer when something else is pressed", async () => {
    await renderStarted();
    tap("Hola!");

    fireEvent.pointerDown(input());

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("speaks the reply when the offer is taken", async () => {
    await renderStarted();
    tap("Hola!");

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
    tap("Hola!");

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
    tap("Hola!");

    await clickListen();
    expect(replyMute()).toBeNull();
    expect(headerMute()).toBeNull();

    await act(async () => resolve(new Response("wav")));
    await settle();

    const button = replyMute()!;
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test.each([
    ["under the reply", replyMute],
    ["in the header", headerMute],
  ])("ends the sound when it is muted %s", async (_, muteButton) => {
    await renderStarted();
    tap("Hola!");
    await clickListen();
    expect(FakeAudio.current.paused).toBe(false);

    fireEvent.click(muteButton()!);

    expect(FakeAudio.current.paused).toBe(true);
    expect(replyMute()).toBeNull();
    expect(headerMute()).toBeNull();
    // The offer is still open, so the reply can be spoken again from there.
    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();
  });

  test("offers to speak the reply again when the speech ends", async () => {
    await renderStarted();
    tap("Hola!");
    await clickListen();

    act(() => FakeAudio.current.onended!());

    expect(replyMute()).toBeNull();
    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();
  });

  test("leaves nothing under the reply when the speech ends after the offer was dismissed", async () => {
    await renderStarted();
    tap("Hola!");
    await clickListen();
    fireEvent.pointerDown(input());

    act(() => FakeAudio.current.onended!());

    expect(replyMute()).toBeNull();
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("withdraws an unused offer when the mute button under another reply is pressed", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();
    tap("Bon dia!");

    fireEvent.pointerDown(replyMute()!);

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("keeps the mute buttons when something else is pressed", async () => {
    await renderStarted();
    tap("Hola!");
    await clickListen();

    fireEvent.pointerDown(input());

    expect(replyMute()).not.toBeNull();
    expect(headerMute()).not.toBeNull();
    expect(FakeAudio.current.paused).toBe(false);
  });

  test("keeps speaking a reply while another reply is tapped", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();

    tap("Bon dia!");

    expect(FakeAudio.current.paused).toBe(false);
    // The mute button stays under the reply being spoken, above the next reply.
    expect(replyMuteIsAbove("Bon dia!")).toBe(true);
    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();
  });

  test("speaks one reply at a time: a second reply takes over from the first", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();

    speech = new Response("wav");
    tap("Bon dia!");
    await clickListen();

    expect(played).toHaveLength(2);
    // The only mute button in the conversation is now under the second reply.
    expect(replyMuteIsAbove("Bon dia!")).toBe(false);
  });

  test("doesn't speak a reply that finishes loading after another was asked for", async () => {
    await renderStarted();
    await send("Hello");
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    tap("Hola!");
    await clickListen();

    speech = new Response("wav");
    tap("Bon dia!");
    await clickListen();
    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Carregant…" })).toBeNull();
    expect(replyMuteIsAbove("Bon dia!")).toBe(false);
  });

  test("keeps speaking a reply until the next one has loaded", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));

    tap("Bon dia!");
    await clickListen();

    expect(FakeAudio.current.paused).toBe(false);
    expect(played).toHaveLength(1);
    expect(replyMuteIsAbove("Bon dia!")).toBe(true);
    expect(screen.getByRole("button", { name: "Carregant…" })).toBeDefined();

    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toHaveLength(2);
    expect(replyMuteIsAbove("Bon dia!")).toBe(false);
  });

  test("withdraws the mute buttons when a reply ends while the next one is loading", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();
    speech = new Promise(() => {});
    tap("Bon dia!");
    await clickListen();

    act(() => FakeAudio.current.onended!());

    expect(replyMute()).toBeNull();
    expect(headerMute()).toBeNull();
  });

  test("speaks a muted reply again from the start without preparing the audio again", async () => {
    await renderStarted();
    tap("Hola!");
    await clickListen();
    fireEvent.click(replyMute()!);

    await clickListen();

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/speak")).toHaveLength(1);
    expect(played).toHaveLength(2);
    expect(FakeAudio.current.paused).toBe(false);
    expect(replyMute()).not.toBeNull();
  });

  test("shows a mute button in the header for as long as a reply is being spoken", async () => {
    await renderStarted();
    expect(headerMute()).toBeNull();
    tap("Hola!");
    await clickListen();

    expect(headerMute()).not.toBeNull();

    act(() => FakeAudio.current.onended!());

    expect(headerMute()).toBeNull();
  });

  test("ends the sound when the conversation is cleared", async () => {
    await renderStarted();
    await send("Hello");
    tap("Bon dia!");
    await clickListen();
    expect(FakeAudio.current.paused).toBe(false);

    fireEvent.click(screen.getByText("Nova conversa"));

    expect(FakeAudio.current.paused).toBe(true);
    expect(headerMute()).toBeNull();
  });

  test("withdraws an unused offer, but not the mute buttons, when something else is pressed", async () => {
    await renderStarted();
    await send("Hello");
    tap("Hola!");
    await clickListen();
    tap("Bon dia!");

    fireEvent.pointerDown(input());

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
    expect(replyMute()).not.toBeNull();
    expect(headerMute()).not.toBeNull();
  });

  test("doesn't offer to speak the reply that is being spoken, even once it ends", async () => {
    await renderStarted();
    tap("Hola!");
    await clickListen();

    tap("Hola!");
    act(() => FakeAudio.current.onended!());

    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test("says so when the reply can't be spoken", async () => {
    await renderStarted();
    speech = new Response("Upstream error", { status: 502 });
    tap("Hola!");

    await clickListen();

    expect(screen.getByText("No s'ha pogut reproduir l'àudio.")).toBeDefined();
    expect(played).toEqual([]);
  });
});

describe("saving an exchange", () => {
  test("saves the exchange of a tapped reply and lists it under its message", async () => {
    await renderStarted();
    await send("Hello");

    tap("Bon dia!");
    expect(saveToggle().getAttribute("aria-pressed")).toBe("false");
    const outline = saveToggle().innerHTML;
    pressSaveToggle();

    // The offer stays, and the bookmark shows the exchange is saved.
    expect(saveToggle().getAttribute("aria-pressed")).toBe("true");
    expect(saveToggle().innerHTML).not.toBe(outline);

    openSaved();

    expect(savedRow("Hello").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Bon dia!")).toBeNull();

    fireEvent.click(savedRow("Hello"));

    expect(savedRow("Hello").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Bon dia!")).toBeDefined();
  });

  test("unsaves the exchange when the bookmark is pressed again", async () => {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");

    pressSaveToggle();

    expect(saveToggle().getAttribute("aria-pressed")).toBe("false");
    openSaved();
    expect(screen.getByText(NOTHING_SAVED)).toBeDefined();
  });

  test("treats the same message with the same reply as one exchange", async () => {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");
    answer = reply("Bon dia!");
    await send("Hello");

    // The second reply says the same as the first, which is saved.
    tap(screen.getAllByText("Bon dia!")[1]);

    expect(saveToggle().getAttribute("aria-pressed")).toBe("true");
    openSaved();
    expect(savedMessages()).toEqual(["Hello"]);
  });

  test("keeps two replies to the same message apart, the newest first", async () => {
    await renderStarted();
    await send("Hello");
    answer = reply("Bona tarda!");
    await send("Hello");
    answer = reply("De res!");
    await send("Thanks");

    toggleSaved("Bon dia!");
    toggleSaved("Bona tarda!");
    toggleSaved("De res!");
    openSaved();

    expect(savedMessages()).toEqual(["Thanks", "Hello", "Hello"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Hello" })[0]);
    expect(screen.getByText("Bona tarda!")).toBeDefined();
    // The other reply to "Hello" stays closed.
    expect(screen.queryByText("Bon dia!")).toBeNull();
  });

  test("doesn't offer to save the greeting, which answers no message", async () => {
    await renderStarted();

    tap("Hola!");

    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();
    expect(screen.queryByRole("button", { name: SAVE_TOGGLE })).toBeNull();
  });

  test("still offers to save a reply once it is being spoken", async () => {
    await renderStarted();
    await send("Hello");
    tap("Bon dia!");
    await clickListen();

    pressSaveToggle();

    expect(saveToggle().getAttribute("aria-pressed")).toBe("true");
    expect(replyMute()).not.toBeNull();
  });

  test("offers to save a reply that is tapped while it is being spoken", async () => {
    await renderStarted();
    await send("Hello");
    tap("Bon dia!");
    await clickListen();
    fireEvent.pointerDown(input());

    tap("Bon dia!");
    pressSaveToggle();

    expect(saveToggle().getAttribute("aria-pressed")).toBe("true");
    expect(replyMute()).not.toBeNull();
    expect(FakeAudio.current.paused).toBe(false);
  });

  test("keeps saved exchanges when the conversation is cleared and in a later session", async () => {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");
    fireEvent.click(screen.getByText("Nova conversa"));

    openSaved();
    expect(savedMessages()).toEqual(["Hello"]);

    cleanup();
    await renderStarted();
    openSaved();
    expect(savedMessages()).toEqual(["Hello"]);

    // The same message and reply, met again, are already saved.
    backToChat();
    await send("Hello");
    tap("Bon dia!");
    expect(saveToggle().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the saved exchanges", () => {
  test("can be opened once unlocked, before the session starts and while the model wakes", async () => {
    render(<Chat initiallyUnlocked />);

    openSaved();
    expect(screen.getByText(NOTHING_SAVED)).toBeDefined();

    backToChat();
    coldStart();
    await clickStart();
    openSaved();
    expect(screen.getByText(NOTHING_SAVED)).toBeDefined();
  });

  test("can't be opened while locked", () => {
    render(<Chat initiallyUnlocked={false} />);

    expect(screen.queryByRole("button", { name: SAVED_BUTTON })).toBeNull();
  });

  test("take the place of the conversation, its input and Nova conversa", async () => {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");

    openSaved();

    expect(screen.queryByText("Bon dia!")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("Nova conversa")).toBeNull();
    expect(screen.queryByRole("button", { name: SAVED_BUTTON })).toBeNull();
  });

  test("show one reply at a time, and none when the list is opened again", async () => {
    await renderStarted();
    await send("Hello");
    answer = reply("De res!");
    await send("Thanks");
    toggleSaved("Bon dia!");
    toggleSaved("De res!");
    openSaved();

    fireEvent.click(savedRow("Hello"));
    fireEvent.click(savedRow("Thanks"));

    expect(screen.queryByText("Bon dia!")).toBeNull();
    expect(screen.getByText("De res!")).toBeDefined();

    fireEvent.click(savedRow("Thanks"));
    expect(screen.queryByText("De res!")).toBeNull();

    fireEvent.click(savedRow("Hello"));
    backToChat();
    openSaved();
    expect(savedRow("Hello").getAttribute("aria-expanded")).toBe("false");
  });

  test("format a saved reply as the conversation does", async () => {
    await renderStarted();
    answer = reply("**Molt** bé: [Viquipèdia](https://ca.wikipedia.org) ![foto](https://example.com/a.png)");
    await send("Hello");
    toggleSaved("Molt");
    openSaved();

    fireEvent.click(savedRow("Hello"));

    expect(screen.getByText("Molt").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Viquipèdia" }).getAttribute("target")).toBe("_blank");
    expect(document.querySelector("img")).toBeNull();
  });

  test("offer nothing more when a reply is tapped: its options are already shown", async () => {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");
    openSaved();
    fireEvent.click(savedRow("Hello"));
    const options = savedRow("Hello").closest("li")!.innerHTML;

    tap("Bon dia!");

    expect(savedRow("Hello").closest("li")!.innerHTML).toBe(options);
    expect(screen.queryByRole("button", { name: SAVE_TOGGLE })).toBeNull();
  });

  test("leave the conversation scrolled to where it was", async () => {
    await renderStarted();
    await send("Hello");
    screen.getByRole("main").scrollTop = 120;

    openSaved();
    backToChat();

    expect(screen.getByRole("main").scrollTop).toBe(120);
  });

  test("leave the conversation, the input and the translation toggle as they were", async () => {
    await renderStarted();
    await send("Hello");
    fireEvent.click(translateToggle());
    fireEvent.change(input(), { target: { value: "half a thought" } });

    openSaved();
    backToChat();

    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText("Bon dia!")).toBeDefined();
    expect(input().value).toBe("half a thought");
    expect(translateToggle().getAttribute("aria-pressed")).toBe("true");
  });

  test("don't interrupt a reply that is still on its way", async () => {
    await renderStarted();
    const arrive = coldStart();
    await send("Hello");

    openSaved();
    await arrive(reply("Bon dia!"));
    backToChat();

    expect(screen.getByText("Bon dia!")).toBeDefined();
    expect(screen.queryByText("Pensant…")).toBeNull();
  });
});

describe("deleting a saved exchange", () => {
  test("offers to delete only the saved exchange whose row is open", async () => {
    await renderSaved("One", "Two");
    expect(screen.queryByRole("button", { name: DELETE_BUTTON })).toBeNull();

    fireEvent.click(savedRow("Two"));

    expect(screen.getAllByRole("button", { name: DELETE_BUTTON })).toHaveLength(1);
    expect(savedRowButton("Two", DELETE_BUTTON)).toBeDefined();
  });

  test("removes the saved exchange at once and leaves no row open", async () => {
    await renderSaved("One", "Two", "Three");
    fireEvent.click(savedRow("Two"));

    fireEvent.click(savedRowButton("Two", DELETE_BUTTON));

    expect(savedMessages()).toEqual(["One", "Three"]);
    expect(screen.queryByRole("button", { expanded: true })).toBeNull();
  });

  test("moves the keyboard to the row that takes the deleted one's place", async () => {
    await renderSaved("One", "Two", "Three");
    fireEvent.click(savedRow("Two"));
    fireEvent.click(savedRowButton("Two", DELETE_BUTTON));
    expect(document.activeElement).toBe(savedRow("Three"));

    fireEvent.click(savedRow("Three"));
    fireEvent.click(savedRowButton("Three", DELETE_BUTTON));
    expect(document.activeElement).toBe(savedRow("One"));
  });

  test("shows that nothing is saved once the last one is deleted", async () => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));

    fireEvent.click(savedRowButton("One", DELETE_BUTTON));

    expect(screen.getByText(NOTHING_SAVED)).toBeDefined();
  });

  test("leaves the reply in the conversation unsaved, in this session and a later one", async () => {
    await renderSaved("One", "Two");
    fireEvent.click(savedRow("One"));
    fireEvent.click(savedRowButton("One", DELETE_BUTTON));

    // The offer under that reply is still open from when it was saved.
    backToChat();
    expect(saveToggle().getAttribute("aria-pressed")).toBe("false");

    cleanup();
    render(<Chat initiallyUnlocked />);
    openSaved();
    expect(savedMessages()).toEqual(["Two"]);
  });
});

describe("hearing a saved reply", () => {
  test("offers to speak the reply of the open row, and speaks it", async () => {
    await renderSaved("One", "Two");
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();

    fireEvent.click(savedRow("Two"));
    expect(savedRowButton("Two", LISTEN_BUTTON)).toBeDefined();
    await clickListen();

    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/speak")!;
    expect(JSON.parse(init!.body as string)).toEqual({ text: "Resposta a Two" });
    expect(played).toEqual(["blob:speech"]);
  });

  test("shows it is loading while the audio is prepared", async () => {
    await renderSaved("One");
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    fireEvent.click(savedRow("One"));

    await clickListen();

    expect(savedRowButton("One", "Carregant…").disabled).toBe(true);
    expect(played).toEqual([]);

    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toEqual(["blob:speech"]);
    expect(screen.queryByRole("button", { name: "Carregant…" })).toBeNull();
  });

  test("says so when the reply can't be spoken", async () => {
    await renderSaved("One");
    speech = new Response("Upstream error", { status: 502 });
    fireEvent.click(savedRow("One"));

    await clickListen();

    expect(screen.getByText("No s'ha pogut reproduir l'àudio.")).toBeDefined();
    expect(savedRowButton("One", LISTEN_BUTTON)).toBeDefined();
    expect(played).toEqual([]);
  });

  test("shows a mute button in the open row, in place of the speaker button, and one in the header", async () => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));

    await clickListen();

    expect(savedRowButton("One", MUTE_BUTTON)).toBe(replyMute());
    expect(headerMute()).not.toBeNull();
    expect(screen.queryByRole("button", { name: LISTEN_BUTTON })).toBeNull();
  });

  test.each([
    ["in the row", replyMute],
    ["in the header", headerMute],
  ])("ends the sound when it is muted %s", async (_, muteButton) => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));
    await clickListen();
    expect(FakeAudio.current.paused).toBe(false);

    fireEvent.click(muteButton()!);

    expect(FakeAudio.current.paused).toBe(true);
    expect(replyMute()).toBeNull();
    expect(headerMute()).toBeNull();
    expect(savedRowButton("One", LISTEN_BUTTON)).toBeDefined();
  });

  test("withdraws both mute buttons when the speech ends", async () => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));
    await clickListen();

    act(() => FakeAudio.current.onended!());

    expect(replyMute()).toBeNull();
    expect(headerMute()).toBeNull();
    expect(savedRowButton("One", LISTEN_BUTTON)).toBeDefined();
  });

  test("speaks a muted saved reply again without preparing the audio again", async () => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));
    await clickListen();
    fireEvent.click(replyMute()!);

    await clickListen();

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/speak")).toHaveLength(1);
    expect(played).toHaveLength(2);
    expect(FakeAudio.current.paused).toBe(false);
  });

  test("no longer says a saved reply couldn't be spoken once the list is opened again", async () => {
    await renderSaved("One");
    speech = new Response("Upstream error", { status: 502 });
    fireEvent.click(savedRow("One"));
    await clickListen();

    backToChat();
    openSaved();
    fireEvent.click(savedRow("One"));

    expect(screen.queryByText("No s'ha pogut reproduir l'àudio.")).toBeNull();
    expect(savedRowButton("One", LISTEN_BUTTON)).toBeDefined();
  });

  test("works before the session has started", async () => {
    await renderSaved("One");
    cleanup();
    render(<Chat initiallyUnlocked />);
    openSaved();
    fireEvent.click(savedRow("One"));

    await clickListen();

    expect(played).toEqual(["blob:speech"]);
    expect(replyMute()).not.toBeNull();
  });
});

describe("one sound across the conversation and the saved exchanges", () => {
  // A session with one exchange, "Hello" answered by "Bon dia!", which is saved.
  async function renderWithSavedHello() {
    await renderStarted();
    await send("Hello");
    toggleSaved("Bon dia!");
  }

  test("keeps speaking a saved reply when the user returns to the conversation", async () => {
    await renderWithSavedHello();
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();

    backToChat();

    expect(FakeAudio.current.paused).toBe(false);
    expect(headerMute()).not.toBeNull();
    // The reply in the conversation didn't start the sound: it can be asked to.
    expect(replyMute()).toBeNull();
    expect(screen.getByRole("button", { name: LISTEN_BUTTON })).toBeDefined();

    fireEvent.click(headerMute()!);
    expect(FakeAudio.current.paused).toBe(true);
    expect(headerMute()).toBeNull();
  });

  test("keeps speaking a reply in the conversation when the list is opened", async () => {
    await renderWithSavedHello();
    await clickListen();

    openSaved();
    fireEvent.click(savedRow("Hello"));

    expect(FakeAudio.current.paused).toBe(false);
    expect(headerMute()).not.toBeNull();
    // The saved exchange didn't start the sound: it can be asked to.
    expect(replyMute()).toBeNull();
    expect(savedRowButton("Hello", LISTEN_BUTTON)).toBeDefined();
  });

  test("starts a new sound for the same reply asked for in the other view", async () => {
    await renderWithSavedHello();
    await clickListen();
    openSaved();
    fireEvent.click(savedRow("Hello"));

    speech = new Response("wav");
    await clickListen();

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/speak")).toHaveLength(2);
    expect(played).toHaveLength(2);
    expect(savedRowButton("Hello", MUTE_BUTTON)).toBeDefined();

    // The mute button has left the reply in the conversation for the row.
    backToChat();
    expect(replyMute()).toBeNull();
  });

  test("keeps speaking a saved reply when its row is closed and another is opened", async () => {
    await renderSaved("One", "Two");
    fireEvent.click(savedRow("One"));
    await clickListen();

    fireEvent.click(savedRow("One"));
    expect(FakeAudio.current.paused).toBe(false);
    expect(replyMute()).toBeNull();
    expect(headerMute()).not.toBeNull();

    fireEvent.click(savedRow("Two"));
    expect(FakeAudio.current.paused).toBe(false);
    expect(savedRowButton("Two", LISTEN_BUTTON)).toBeDefined();

    // Its mute button is back whenever its row is open.
    fireEvent.click(savedRow("One"));
    expect(savedRowButton("One", MUTE_BUTTON)).toBeDefined();
  });

  test("lets a sound asked for in the list take over from one in the conversation only once it has loaded", async () => {
    await renderWithSavedHello();
    await clickListen();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    openSaved();
    fireEvent.click(savedRow("Hello"));

    await clickListen();

    expect(FakeAudio.current.paused).toBe(false);
    expect(played).toHaveLength(1);
    expect(savedRowButton("Hello", "Carregant…")).toBeDefined();
    backToChat();
    expect(replyMute()).not.toBeNull();

    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toHaveLength(2);
    expect(replyMute()).toBeNull();
    openSaved();
    fireEvent.click(savedRow("Hello"));
    expect(savedRowButton("Hello", MUTE_BUTTON)).toBeDefined();
  });

  test("starts a sound asked for in the list once it is ready, though the user has gone back to the conversation", async () => {
    await renderWithSavedHello();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();

    backToChat();
    expect(played).toEqual([]);
    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toEqual(["blob:speech"]);
    expect(headerMute()).not.toBeNull();
    expect(replyMute()).toBeNull();
  });

  test("offers a saved reply again when one asked for later in the conversation is spoken instead", async () => {
    await renderWithSavedHello();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();
    backToChat();
    speech = new Response("wav");
    await clickListen();

    await act(async () => resolve(new Response("wav")));
    await settle();
    openSaved();
    fireEvent.click(savedRow("Hello"));

    expect(played).toHaveLength(1);
    expect(savedRowButton("Hello", LISTEN_BUTTON)).toBeDefined();
  });

  test("ends the sound when the saved exchange it was started from is deleted", async () => {
    await renderSaved("One", "Two");
    fireEvent.click(savedRow("One"));
    await clickListen();

    fireEvent.click(savedRowButton("One", DELETE_BUTTON));

    expect(FakeAudio.current.paused).toBe(true);
    expect(headerMute()).toBeNull();
  });

  test("ends the sound when the saved exchange it was started from is removed in another tab", async () => {
    await renderSaved("One");
    fireEvent.click(savedRow("One"));
    await clickListen();

    act(() => {
      localStorage.removeItem("saved-exchanges");
      window.dispatchEvent(new StorageEvent("storage"));
    });

    expect(FakeAudio.current.paused).toBe(true);
    expect(headerMute()).toBeNull();
    expect(screen.getByText(NOTHING_SAVED)).toBeDefined();
  });

  test("doesn't speak a saved reply that is deleted while its audio is prepared", async () => {
    await renderSaved("One", "Two");
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    fireEvent.click(savedRow("One"));
    await clickListen();

    fireEvent.click(savedRowButton("One", DELETE_BUTTON));
    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toEqual([]);
    expect(headerMute()).toBeNull();
  });

  test("keeps speaking one saved reply when another saved exchange is deleted", async () => {
    await renderSaved("One", "Two");
    fireEvent.click(savedRow("One"));
    await clickListen();
    fireEvent.click(savedRow("Two"));

    fireEvent.click(savedRowButton("Two", DELETE_BUTTON));

    expect(FakeAudio.current.paused).toBe(false);
    expect(headerMute()).not.toBeNull();
  });

  test("ends a sound started in the list when its exchange is unsaved from the conversation", async () => {
    await renderWithSavedHello();
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();
    backToChat();

    pressSaveToggle();

    expect(FakeAudio.current.paused).toBe(true);
    expect(headerMute()).toBeNull();
  });

  test("keeps speaking a reply in the conversation when it is unsaved there", async () => {
    await renderWithSavedHello();
    await clickListen();

    pressSaveToggle();

    expect(saveToggle().getAttribute("aria-pressed")).toBe("false");
    expect(FakeAudio.current.paused).toBe(false);
    expect(replyMute()).not.toBeNull();
    expect(headerMute()).not.toBeNull();
  });

  test("keeps speaking a saved reply when the conversation is cleared", async () => {
    await renderWithSavedHello();
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();
    backToChat();

    fireEvent.click(screen.getByText("Nova conversa"));

    expect(FakeAudio.current.paused).toBe(false);
    expect(headerMute()).not.toBeNull();
  });

  test("still speaks a saved reply that is being prepared when the conversation is cleared", async () => {
    await renderWithSavedHello();
    let resolve!: (res: Response) => void;
    speech = new Promise((r) => (resolve = r));
    openSaved();
    fireEvent.click(savedRow("Hello"));
    await clickListen();
    backToChat();

    fireEvent.click(screen.getByText("Nova conversa"));
    await act(async () => resolve(new Response("wav")));
    await settle();

    expect(played).toEqual(["blob:speech"]);
    expect(headerMute()).not.toBeNull();
  });
});
