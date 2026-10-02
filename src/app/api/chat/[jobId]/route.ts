import { getChatStatus } from "@/lib/runpod";

export async function GET(_request: Request, ctx: RouteContext<"/api/chat/[jobId]">) {
  const { jobId } = await ctx.params;
  try {
    return Response.json(await getChatStatus(jobId));
  } catch (err) {
    console.error(err);
    return Response.json({ status: "failed", error: "Upstream error" }, { status: 502 });
  }
}
