import { NextResponse } from "next/server";
import { sessionForCommand } from "@/lib/internal-runtime";
import { resolveSessionPath } from "@/lib/session-reader";
import { prepareRuntimeTurn } from "@/lib/pending-runtime-turns";
import { logRuntimeError, runtimeErrorCode } from "@/lib/runtime-error";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      message?: unknown;
      contextItems?: unknown;
      images?: unknown;
      provider?: unknown;
      modelId?: unknown;
      thinkingLevel?: unknown;
      parentMessageId?: unknown;
      systemPrompt?: unknown;
    };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "PI_RUNTIME_MESSAGE_REQUIRED" }, { status: 400 });
    }
    const session = sessionForCommand(id);
    if (!session?.isAlive() && !(await resolveSessionPath(id))) {
      return NextResponse.json(
        { error: "PI_RUNTIME_SESSION_NOT_FOUND" },
        { status: 404 },
      );
    }
    const streamId = prepareRuntimeTurn(id, {
      message: body.message,
      contextItems: Array.isArray(body.contextItems) ? body.contextItems : [],
      images: Array.isArray(body.images) ? body.images : [],
      provider: typeof body.provider === "string" ? body.provider : undefined,
      modelId: typeof body.modelId === "string" ? body.modelId : undefined,
      thinkingLevel: typeof body.thinkingLevel === "string" ? body.thinkingLevel : undefined,
      parentMessageId: typeof body.parentMessageId === "string" ? body.parentMessageId : undefined,
      systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
    });
    return NextResponse.json({ streamId });
  } catch (error) {
    logRuntimeError("failed to prepare managed runtime message", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_MESSAGE_PREPARE_FAILED"),
    }, { status: 500 });
  }
}
