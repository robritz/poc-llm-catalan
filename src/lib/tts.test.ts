// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { isSpeechAvailable, synthesize } from "./tts";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("wav", { headers: { "Content-Type": "audio/wav" } }));
  vi.stubGlobal("fetch", fetchMock);
});

function sentRequest() {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, method: init.method, headers: new Headers(init.headers), body: JSON.parse(init.body) };
}

describe("synthesize", () => {
  test("posts the text to the local TTS API with the voice settings", async () => {
    const res = await synthesize("Bon dia Manel, avui anem a la muntanya.");

    expect(await res.text()).toBe("wav");
    const { url, method, headers, body } = sentRequest();
    expect(url).toBe("http://localhost:8000/v1/tts");
    expect(method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(body).toEqual({
      text: "Bon dia Manel, avui anem a la muntanya.",
      voice: "grau",
      format: "wav",
      steps: 20,
      speaking_rate: 0.9,
    });
  });

  test.each(["https://tts.example.com", "https://tts.example.com/"])(
    "uses TTS_API_URL (%s) when the API is hosted elsewhere",
    async (base) => {
      vi.stubEnv("TTS_API_URL", base);
      await synthesize("Hola");
      expect(sentRequest().url).toBe("https://tts.example.com/v1/tts");
    },
  );
});

describe("isSpeechAvailable", () => {
  test("asks the TTS API for its health", async () => {
    fetchMock.mockResolvedValue(new Response("ok"));

    expect(await isSpeechAvailable()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/health");
    expect(init?.method ?? "GET").toBe("GET");
    // The request is given up on if the API takes too long to answer.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("is unavailable when the TTS API reports that it is unhealthy", async () => {
    fetchMock.mockResolvedValue(new Response("loading model", { status: 503 }));
    expect(await isSpeechAvailable()).toBe(false);
  });

  test("is unavailable when the TTS API can't be reached", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    expect(await isSpeechAvailable()).toBe(false);
  });

  test("uses TTS_API_URL when the API is hosted elsewhere", async () => {
    vi.stubEnv("TTS_API_URL", "https://tts.example.com/");
    fetchMock.mockResolvedValue(new Response("ok"));
    await isSpeechAvailable();
    expect(fetchMock.mock.calls[0][0]).toBe("https://tts.example.com/health");
  });
});
