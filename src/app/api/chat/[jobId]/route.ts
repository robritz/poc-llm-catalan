import { getChatStatus } from "@/lib/runpod";
import { isUnlocked } from "@/lib/unlock";

export async function GET(_request: Request, ctx: RouteContext<"/api/chat/[jobId]">) {
  if (!(await isUnlocked())) {
    return Response.json({ status: "failed", error: "Locked" }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  try {
    return Response.json(await getChatStatus(jobId));
  } catch (err) {
    console.error(err);
    return Response.json({ status: "failed", error: "Upstream error" }, { status: 502 });
  }
}
