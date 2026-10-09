// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { synthesize } from "./tts";

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
