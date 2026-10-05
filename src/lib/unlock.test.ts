// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { isUnlocked, tryUnlock } from "./unlock";

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) =>
      jar.set(name, { value, options }),
  }),
}));

beforeEach(() => {
  jar.clear();
  vi.stubEnv("CHAT_SECRET_PHRASE", "Open Sesame");
});

describe("tryUnlock", () => {
  test("rejects a wrong phrase and sets no cookie", async () => {
    expect(await tryUnlock("open says me")).toBe(false);
    expect(jar.size).toBe(0);
    expect(await isUnlocked()).toBe(false);
  });

  test("accepts the phrase and unlocks", async () => {
    expect(await tryUnlock("Open Sesame")).toBe(true);
    expect(await isUnlocked()).toBe(true);
  });

  test("ignores case and extra whitespace", async () => {
    expect(await tryUnlock("  open   SESAME ")).toBe(true);
  });

  test("sets an httpOnly cookie that doesn't contain the phrase", async () => {
    await tryUnlock("Open Sesame");
    const cookie = jar.get("chat_unlocked");
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.value).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie?.value.toLowerCase()).not.toContain("sesame");
  });
});

describe("isUnlocked", () => {
  test("is false without a cookie", async () => {
    expect(await isUnlocked()).toBe(false);
  });

  test("is false for a forged cookie value", async () => {
    jar.set("chat_unlocked", { value: "true" });
    expect(await isUnlocked()).toBe(false);
  });

  test("stops accepting old cookies when the phrase changes", async () => {
    await tryUnlock("Open Sesame");
    vi.stubEnv("CHAT_SECRET_PHRASE", "new phrase");
    expect(await isUnlocked()).toBe(false);
  });
});

describe("when CHAT_SECRET_PHRASE is missing", () => {
  test.each(["", "   "])("throws instead of leaving the chat open (%j)", async (value) => {
    vi.stubEnv("CHAT_SECRET_PHRASE", value);
    await expect(isUnlocked()).rejects.toThrow("CHAT_SECRET_PHRASE must be set");
    await expect(tryUnlock("")).rejects.toThrow("CHAT_SECRET_PHRASE must be set");
  });
});
