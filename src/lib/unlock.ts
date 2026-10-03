import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "chat_unlocked";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

// Case-insensitive, and ignores extra whitespace.
function normalize(phrase: string) {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

function secretPhrase() {
  const phrase = process.env.CHAT_SECRET_PHRASE;
  if (!phrase?.trim()) {
    throw new Error("CHAT_SECRET_PHRASE must be set");
  }
  return normalize(phrase);
}

// The cookie holds a hash of the phrase, so it can't be forged without
// knowing the phrase.
function token() {
  return createHash("sha256").update(secretPhrase()).digest("hex");
}

export async function isUnlocked(): Promise<boolean> {
  return (await cookies()).get(COOKIE_NAME)?.value === token();
}

export async function tryUnlock(phrase: string): Promise<boolean> {
  if (normalize(phrase) !== secretPhrase()) return false;
  (await cookies()).set(COOKIE_NAME, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
  return true;
}
