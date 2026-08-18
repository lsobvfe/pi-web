import { NextResponse } from "next/server";
import { resolveSessionPath } from "@/lib/session-reader";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { consumeRuntimeTurn } from "@/lib/pending-runtime-turns";
import { logRuntimeError, runtimeErrorCode } from "@/lib/runtime-error";
import { createRuntimeTurnStream } from "@/lib/runtime-turn-stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; streamId: string }> },
) {
  try {
    const { id, streamId } = await params;
    const value = consumeRuntimeTurn(id, streamId);
    let session = getRpcSession(id);
    if (!session?.isAlive()) {
      const filePath = await resolveSessionPath(id);
      if (!filePath) return NextResponse.json({ error: "PI_RUNTIME_SESSION_NOT_FOUND" }, { status: 404 });
      session = (await startRpcSession(id, filePath, undefined)).session;
    }
    if (typeof value.parentMessageId === "string") {
      await session.send({ type: "navigate_tree", targetId: value.parentMessageId });
    }
    if (typeof value.provider === "string" && typeof value.modelId === "string") {
      await session.send({ type: "set_model", provider: value.provider, modelId: value.modelId });
    }
    if (typeof value.thinkingLevel === "string") {
      await session.send({ type: "set_thinking_level", level: value.thinkingLevel });
    }
    const eventStream = createRuntimeTurnStream(req, session, () => session.send({
      type: "prompt",
      message: value.message,
      images: value.images,
      contextMessages: value.contextItems
        .filter(isContextItem)
        .map((item) => ({
          role: "custom",
          customType: "command_os.context",
          content: [{ type: "text", text: item.content }],
          display: false,
          details: item.metadata ?? {},
          timestamp: Date.now(),
        })),
      ...(typeof value.systemPrompt === "string"
        ? { systemPrompt: value.systemPrompt }
        : {}),
    }));
    return new Response(eventStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logRuntimeError("failed to stream managed runtime message", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_STREAM_FAILED"),
    }, {
      status: error instanceof Error
        && error.message === "PI_RUNTIME_STREAM_NOT_FOUND"
        ? 404
        : 500,
    });
  }
}

function isContextItem(value: unknown): value is { content: string; metadata?: Record<string, unknown> } {
  return isRecord(value) && typeof value.content === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
