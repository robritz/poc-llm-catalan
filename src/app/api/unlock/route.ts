import { tryUnlock } from "@/lib/unlock";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phrase = typeof body?.phrase === "string" ? body.phrase : "";
  const unlocked = await tryUnlock(phrase);
  return Response.json({ unlocked }, { status: unlocked ? 200 : 401 });
}
