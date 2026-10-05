// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getChatStatus, startChat } from "@/lib/runpod";
import { isUnlocked, tryUnlock } from "@/lib/unlock";
import { GET as getStatus } from "./chat/[jobId]/route";
import { POST as postChat } from "./chat/route";
import { POST as postUnlock } from "./unlock/route";

vi.mock("@/lib/runpod");
vi.mock("@/lib/unlock");

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function statusRequest(jobId: string) {
  return getStatus(new Request(`http://localhost/api/chat/${jobId}`), {
    params: Promise.resolve({ jobId }),
  });
}

const messages = [{ role: "user", content: "Hola" }];

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
    expect(await res.json()).toEqual({ status: "failed", error: "Locked" });
    expect(startChat).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that isn't JSON", "not json"],
    ["missing messages", {}],
    ["an empty conversation", { messages: [] }],
    ["a client-supplied system message", { messages: [{ role: "system", content: "x" }] }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await postChat(post("/api/chat", body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "failed", error: "Invalid messages" });
    expect(startChat).not.toHaveBeenCalled();
  });

  test("starts a job and returns its result", async () => {
    vi.mocked(startChat).mockResolvedValue({ status: "pending", jobId: "job-1", queued: true });
    const res = await postChat(post("/api/chat", { messages }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "pending", jobId: "job-1", queued: true });
    expect(startChat).toHaveBeenCalledWith(messages);
  });

  test("returns 502 without leaking the upstream error", async () => {
    vi.mocked(startChat).mockRejectedValue(new Error("RunPod HTTP 500: secret details"));
    const res = await postChat(post("/api/chat", { messages }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: "failed", error: "Upstream error" });
  });
});

describe("GET /api/chat/[jobId]", () => {
  test("returns 401 when locked", async () => {
    vi.mocked(isUnlocked).mockResolvedValue(false);
    const res = await statusRequest("job-1");
    expect(res.status).toBe(401);
    expect(getChatStatus).not.toHaveBeenCalled();
  });

  test("returns the job's status", async () => {
    vi.mocked(getChatStatus).mockResolvedValue({ status: "completed", reply: "Bon dia" });
    const res = await statusRequest("job-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "completed", reply: "Bon dia" });
    expect(getChatStatus).toHaveBeenCalledWith("job-1");
  });

  test("returns 502 when the upstream call fails", async () => {
    vi.mocked(getChatStatus).mockRejectedValue(new Error("boom"));
    const res = await statusRequest("job-1");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: "failed", error: "Upstream error" });
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
