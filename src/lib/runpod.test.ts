// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getChatStatus, startChat } from "./runpod";

const fetchMock = vi.fn();

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RUNPOD_API_KEY", "test-key");
  vi.stubEnv("RUNPOD_ENDPOINT_ID", "endpoint123");
});

describe("startChat", () => {
  test("submits the conversation with the system prompt first", async () => {
    respondWith({ id: "job-1", status: "IN_QUEUE" });

    await startChat([{ role: "user", content: "Hello" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/api\.runpod\.ai\/v2\/endpoint123\/run/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const { messages } = JSON.parse(init.body).input;
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("català");
    expect(messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  test.each([
    ["IN_QUEUE", true],
    ["IN_PROGRESS", false],
  ])("maps %s to pending with queued=%s", async (status, queued) => {
    respondWith({ id: "job-1", status });
    expect(await startChat([{ role: "user", content: "Hello" }])).toEqual({
      status: "pending",
      jobId: "job-1",
      queued,
    });
  });

  test("throws when the RunPod env vars are missing", async () => {
    vi.stubEnv("RUNPOD_API_KEY", "");
    await expect(startChat([{ role: "user", content: "Hello" }])).rejects.toThrow(
      "RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("throws on a non-2xx response", async () => {
    respondWith({ error: "unauthorized" }, 401);
    await expect(startChat([{ role: "user", content: "Hello" }])).rejects.toThrow(
      "RunPod HTTP 401",
    );
  });
});

describe("getChatStatus", () => {
  test("requests the status of the URL-encoded job id", async () => {
    respondWith({ id: "a/b", status: "IN_PROGRESS" });
    await getChatStatus("a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.runpod.ai/v2/endpoint123/status/a%2Fb",
    );
  });

  test("returns the trimmed reply when output is an array", async () => {
    respondWith({ id: "job-1", status: "COMPLETED", output: [completion("  Bon dia\n")] });
    expect(await getChatStatus("job-1")).toEqual({ status: "completed", reply: "Bon dia" });
  });

  test("returns the reply when output is a single completion", async () => {
    respondWith({ id: "job-1", status: "COMPLETED", output: completion("Bon dia") });
    expect(await getChatStatus("job-1")).toEqual({ status: "completed", reply: "Bon dia" });
  });

  test.each([
    ["null content", [completion(null)]],
    ["empty content", [completion("")]],
    ["no output", undefined],
  ])("fails a completed job with %s", async (_name, output) => {
    respondWith({ id: "job-1", status: "COMPLETED", output });
    expect(await getChatStatus("job-1")).toEqual({
      status: "failed",
      error: "Empty response from model",
    });
  });

  test("reports the job's error when it fails", async () => {
    respondWith({ id: "job-1", status: "FAILED", error: "out of memory" });
    expect(await getChatStatus("job-1")).toEqual({ status: "failed", error: "out of memory" });
  });

  test.each(["CANCELLED", "TIMED_OUT"])(
    "falls back to the status name for %s without an error",
    async (status) => {
      respondWith({ id: "job-1", status });
      expect(await getChatStatus("job-1")).toEqual({
        status: "failed",
        error: `Job ${status}`,
      });
    },
  );
});
