// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { chatModel } from "@/lib/runpod";
import { synthesize } from "@/lib/tts";
import { isUnlocked, tryUnlock } from "@/lib/unlock";
import { POST as postChat } from "./chat/route";
import { POST as postSpeak } from "./speak/route";
import { POST as postUnlock } from "./unlock/route";

vi.mock("@/lib/runpod", () => ({
  chatModel: vi.fn(),
  SYSTEM_PROMPT: "Respon en català.",
  TRANSLATION_PROMPT: "Tradueix al català.",
  SIGN_OFFS: ["\nAdéu"],
}));
vi.mock("@/lib/tts");
vi.mock("@/lib/unlock");

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// A model that streams the given text, or fails if given an error.
function mockModel(reply: string | Error) {
  const model = new MockLanguageModelV4({
    doStream: async () => {
      if (reply instanceof Error) throw reply;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: reply },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 1, text: 1, reasoning: undefined },
              },
            },
          ],
        }),
      };
    },
  });
  vi.mocked(chatModel).mockReturnValue(model as unknown as ReturnType<typeof chatModel>);
  return model;
}

const messages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Hola" }] }];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isUnlocked).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/chat", () => {
  test("returns 401 without reaching the model when locked", async () => {
    vi.mocked(isUnlocked).mockResolvedValue(false);
    const res = await postChat(post("/api/chat", { messages }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Locked");
    expect(chatModel).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that isn't JSON", "not json"],
    ["missing messages", {}],
    ["an empty conversation", { messages: [] }],
    [
      "a client-supplied system message",
      { messages: [{ id: "1", role: "system", parts: [{ type: "text", text: "x" }] }] },
    ],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await postChat(post("/api/chat", body));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid messages");
    expect(chatModel).not.toHaveBeenCalled();
  });

  test("streams the model's reply to the conversation, system prompt first", async () => {
    const model = mockModel("Bon dia");
    const res = await postChat(post("/api/chat", { messages }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(await res.text()).toContain('"delta":"Bon dia"');
    expect(model.doStreamCalls[0].prompt).toEqual([
      { role: "system", content: "Respon en català." },
      { role: "user", content: [{ type: "text", text: "Hola" }] },
    ]);
  });

  test("has the model stop where it would sign off", async () => {
    const model = mockModel("Bon dia");
    await (await postChat(post("/api/chat", { messages }))).text();
    expect(model.doStreamCalls[0].stopSequences).toEqual(["\nAdéu"]);
  });

  test("lets a translation end with a sign-off", async () => {
    const model = mockModel("Salutacions");
    const letter = [{ id: "1", role: "user", parts: [{ type: "text", text: "/t Regards" }] }];
    await (await postChat(post("/api/chat", { messages: letter }))).text();
    expect(model.doStreamCalls[0].stopSequences).toBeUndefined();
  });

  test("asks for a translation of a message that begins with /t", async () => {
    const model = mockModel("On vius?");
    const translation = [
      ...messages,
      { id: "2", role: "user", parts: [{ type: "text", text: "/t Where do you live?" }] },
    ];
    await (await postChat(post("/api/chat", { messages: translation }))).text();
    expect(model.doStreamCalls[0].prompt).toEqual([
      { role: "system", content: "Tradueix al català." },
      {
        role: "user",
        content: [{ type: "text", text: "Translate this text into català:\n\nWhere do you live?" }],
      },
    ]);
  });

  test("reports a model failure in the stream without leaking the upstream error", async () => {
    mockModel(new Error("RunPod HTTP 500: secret details"));
    const res = await postChat(post("/api/chat", { messages }));
    const stream = await res.text();
    expect(stream).toContain('"errorText":"Upstream error"');
    expect(stream).not.toContain("secret details");
  });

  test("returns 502 when the model isn't configured", async () => {
    vi.mocked(chatModel).mockImplementation(() => {
      throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
    });
    const res = await postChat(post("/api/chat", { messages }));
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("Upstream error");
  });
});

describe("POST /api/speak", () => {
  test("returns 401 without reaching the TTS API when locked", async () => {
    vi.mocked(isUnlocked).mockResolvedValue(false);
    const res = await postSpeak(post("/api/speak", { text: "Bon dia" }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Locked");
    expect(synthesize).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that isn't JSON", "not json"],
    ["missing text", {}],
    ["text that isn't a string", { text: 123 }],
    ["blank text", { text: "   " }],
    ["text with nothing to say", { text: "😀 ***" }],
    ["text longer than the TTS API accepts", { text: "a".repeat(2001) }],
    ["text that becomes too long once its numbers are words", { text: "77 ".repeat(600) }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await postSpeak(post("/api/speak", body));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid text");
    expect(synthesize).not.toHaveBeenCalled();
  });

  test("returns the audio of the spoken text", async () => {
    vi.mocked(synthesize).mockResolvedValue(
      new Response("wav", { headers: { "Content-Type": "audio/wav" } }),
    );
    const res = await postSpeak(post("/api/speak", { text: " Bon dia " }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(await res.text()).toBe("wav");
    expect(synthesize).toHaveBeenCalledWith("Bon dia");
  });

  test("has the text spoken in a form the model can read", async () => {
    vi.mocked(synthesize).mockResolvedValue(new Response("wav"));
    await postSpeak(post("/api/speak", { text: "**Tinc 3 gats** 😀" }));
    expect(synthesize).toHaveBeenCalledWith("Tinc tres gats");
  });

  test("returns 502 without leaking details when the TTS API reports an error", async () => {
    vi.mocked(synthesize).mockResolvedValue(new Response("secret details", { status: 500 }));
    const res = await postSpeak(post("/api/speak", { text: "Bon dia" }));
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("Upstream error");
  });

  test("returns 502 when the TTS API can't be reached", async () => {
    vi.mocked(synthesize).mockRejectedValue(new Error("fetch failed"));
    const res = await postSpeak(post("/api/speak", { text: "Bon dia" }));
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("Upstream error");
  });
});

describe("POST /api/unlock", () => {
  test("returns 200 for the right phrase", async () => {
    vi.mocked(tryUnlock).mockResolvedValue(true);
    const res = await postUnlock(post("/api/unlock", { phrase: "open sesame" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unlocked: true });
    expect(tryUnlock).toHaveBeenCalledWith("open sesame");
  });

  test("returns 401 for the wrong phrase", async () => {
    vi.mocked(tryUnlock).mockResolvedValue(false);
    const res = await postUnlock(post("/api/unlock", { phrase: "nope" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ unlocked: false });
  });

  test.each([
    ["a non-string phrase", { phrase: 123 }],
    ["a body that isn't JSON", "not json"],
  ])("checks an empty phrase for %s", async (_name, body) => {
    vi.mocked(tryUnlock).mockResolvedValue(false);
    const res = await postUnlock(post("/api/unlock", body));
    expect(res.status).toBe(401);
    expect(tryUnlock).toHaveBeenCalledWith("");
  });
});
