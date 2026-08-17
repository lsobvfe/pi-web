import { NextResponse } from "next/server";
import { runtimeSession } from "@/lib/internal-runtime";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { resolveSessionPath, invalidateSessionListCache } from "@/lib/session-reader";
import { logRuntimeError, runtimeErrorCode } from "@/lib/runtime-error";
import { restoreSession, trashSession } from "@/lib/session-lifecycle";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ session: await runtimeSession(id) });
  } catch (error) {
    logRuntimeError("failed to read managed runtime session", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_NOT_FOUND"),
    }, { status: 404 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as { name?: unknown };
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "PI_RUNTIME_SESSION_NAME_REQUIRED" }, { status: 400 });
    }
    const filePath = await resolveSessionPath(id);
    if (!filePath) return NextResponse.json({ error: "PI_RUNTIME_SESSION_NOT_FOUND" }, { status: 404 });
    SessionManager.open(filePath).appendSessionInfo(body.name);
    invalidateSessionListCache();
    return NextResponse.json({ session: await runtimeSession(id) });
  } catch (error) {
    logRuntimeError("failed to rename managed runtime session", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_RENAME_FAILED"),
    }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await runtimeSession(id);
    await trashSession(id);
    return NextResponse.json({
      session: {
        ...session,
        metadata: { ...session.metadata, deleted: true },
      },
    });
  } catch (error) {
    logRuntimeError("failed to delete managed runtime session", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_DELETE_FAILED"),
    }, { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    restoreSession(id);
    return NextResponse.json({ session: await runtimeSession(id) });
  } catch (error) {
    logRuntimeError("failed to restore managed runtime session", error);
    return NextResponse.json({
      error: runtimeErrorCode(error, "PI_RUNTIME_SESSION_RESTORE_FAILED"),
    }, { status: 500 });
  }
}
