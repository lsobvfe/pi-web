import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveSessionPath } from "@/lib/session-reader";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { runtimeSession } from "@/lib/internal-runtime";
import { logRuntimeError, runtimeErrorCode } from "@/lib/runtime-error";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      action?: unknown;
      entryId?: unknown;
      instructions?: unknown;
      message?: unknown;
      kind?: unknown;
    };
    let session = getRpcSession(id);
    if (!session?.isAlive()) {
      const filePath = await resolveSessionPath(id);
      if (!filePath) return NextResponse.json({ error: "PI_RUNTIME_SESSION_NOT_FOUND" }, { status: 404 });
      session = (await startRpcSession(id, filePath, undefined)).session;
    }
    if (body.action === "fork") {
      if (typeof body.entryId !== "string" || !body.entryId) {
        return NextResponse.json({ error: "PI_RUNTIME_ENTRY_ID_REQUIRED" }, { status: 400 });
      }
      const result = await session.send({ type: "fork", entryId: body.entryId });
      const newSessionId = isRecord(result) && typeof result.newSessionId === "string"
        ? result.newSessionId
        : "";
      if (!newSessionId) throw new Error("PI_RUNTIME_FORK_FAILED");
      return NextResponse.json({ session: await runtimeSession(newSessionId) });
    }
    if (body.action === "compact") {
      const result = await session.send({
        type: "compact",
        ...(typeof body.instructions === "string"
          ? { customInstructions: body.instructions }
          : {}),
      });
      return NextResponse.json({ result });
    }
    if (body.action === "inject") {
      if (typeof body.message !== "string" || !body.message.trim()) {
        return NextResponse.json({ error: "PI_RUNTIME_MESSAGE_REQUIRED" }, { status: 400 });
      }
      if (body.kind !== "steer" && body.kind !== "follow_up") {
        return NextResponse.json({ error: "PI_RUNTIME_INJECTION_KIND_INVALID" }, { status: 400 });
      }
      await session.send({
        type: body.kind,
        message: body.message,
      });
      return NextResponse.json({
        accepted: true,
        messageId: `injection:${randomUUID()}`,
      });
    }
    return NextResponse.json({ error: "PI_RUNTIME_ACTION_INVALID" }, { status: 400 });
  } catch (error) {
    logRuntimeError("failed to execute managed runtime action", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_ACTION_FAILED"),
    }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
