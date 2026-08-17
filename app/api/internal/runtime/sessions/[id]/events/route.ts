import { resolveSessionPath } from "@/lib/session-reader";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { createAgentEventStream } from "@/lib/agent-event-stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const live = getRpcSession(id);
  const sessionPromise = live?.isAlive()
    ? Promise.resolve(live)
    : resolveSessionPath(id).then((filePath) => {
        if (!filePath) throw new Error("PI_RUNTIME_SESSION_NOT_FOUND");
        return startRpcSession(id, filePath, undefined).then((result) => result.session);
      });
  return new Response(createAgentEventStream(req, id, sessionPromise), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
