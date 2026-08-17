import { NextResponse } from "next/server";
import {
  createRuntimeSession,
  listRuntimeSessions,
} from "@/lib/internal-runtime";
import { logRuntimeError, runtimeErrorCode } from "@/lib/runtime-error";

export async function GET() {
  try {
    return NextResponse.json({ sessions: await listRuntimeSessions() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logRuntimeError("failed to list managed runtime sessions", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_LIST_FAILED"),
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      name?: unknown;
      extensionId?: unknown;
      sourceContext?: unknown;
      context?: unknown;
      model?: unknown;
      thinkingLevel?: unknown;
    };
    const model = isModel(body.model) ? body.model : undefined;
    const metadata = {
      ...(typeof body.extensionId === "string" ? { extensionId: body.extensionId } : {}),
      ...(isRecord(body.sourceContext) ? { sourceContext: body.sourceContext } : {}),
      ...(isRecord(body.context) ? { context: body.context } : {}),
    };
    const session = await createRuntimeSession(
      metadata,
      typeof body.name === "string" ? body.name : undefined,
      model,
      typeof body.thinkingLevel === "string" ? body.thinkingLevel : undefined,
    );
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    logRuntimeError("failed to create managed runtime session", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_CREATE_FAILED"),
    }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isModel(value: unknown): value is { provider: string; modelId: string } {
  return isRecord(value)
    && typeof value.provider === "string"
    && typeof value.modelId === "string"
    && Boolean(value.provider.trim())
    && Boolean(value.modelId.trim());
}
