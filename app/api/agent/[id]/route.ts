import { NextResponse } from "next/server";
import { resolveSessionPath } from "@/lib/session-reader";
import { startRpcSession, getRpcSession } from "@/lib/rpc-manager";
import { validateAgentImages } from "@/lib/image-attachments";
import type { CommandOsContextItem, CommandOsTurnContext } from "@/lib/command-os-turn-context";

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function commandOsContext(body: Record<string, unknown>): CommandOsTurnContext {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
  if (!message) throw new Error("PI_COMMAND_OS_MESSAGE_REQUIRED");
  if (!systemPrompt) throw new Error("PI_COMMAND_OS_SYSTEM_PROMPT_REQUIRED");

  const rawItems = body.contextItems;
  if (!Array.isArray(rawItems)) throw new Error("PI_COMMAND_OS_CONTEXT_ITEMS_INVALID");
  const contextItems: CommandOsContextItem[] = rawItems.map((value, index) => {
    const item = record(value, `PI_COMMAND_OS_CONTEXT_ITEM_${index}_INVALID`);
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const content = typeof item.content === "string" ? item.content : "";
    if (!id || !content) throw new Error(`PI_COMMAND_OS_CONTEXT_ITEM_${index}_INVALID`);
    return {
      id,
      content,
      ...(typeof item.label === "string" ? { label: item.label } : {}),
      ...(item.resource !== undefined ? { resource: record(item.resource, `PI_COMMAND_OS_CONTEXT_ITEM_${index}_RESOURCE_INVALID`) } : {}),
      ...(item.metadata !== undefined ? { metadata: record(item.metadata, `PI_COMMAND_OS_CONTEXT_ITEM_${index}_METADATA_INVALID`) } : {}),
    };
  });

  const rawReferences = body.resourceReferences;
  if (!Array.isArray(rawReferences)) throw new Error("PI_COMMAND_OS_RESOURCE_REFERENCES_INVALID");
  const resourceReferences = rawReferences.map((value, index) => (
    record(value, `PI_COMMAND_OS_RESOURCE_REFERENCE_${index}_INVALID`)
  ));
  const imageError = validateAgentImages(body.images);
  if (imageError) throw new Error(imageError);

  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  if ((provider && !modelId) || (!provider && modelId)) {
    throw new Error("PI_RUNTIME_MODEL_REFERENCE_INVALID");
  }
  const parentMessageId = typeof body.parentMessageId === "string"
    ? body.parentMessageId.trim()
    : "";
  return {
    message,
    systemPrompt,
    contextItems,
    resourceReferences,
    ...(parentMessageId ? { parentMessageId } : {}),
    ...(Array.isArray(body.images) && body.images.length > 0 ? { images: body.images as CommandOsTurnContext["images"] } : {}),
    ...(provider && modelId ? { provider, modelId } : {}),
    ...(typeof body.thinkingLevel === "string" && body.thinkingLevel.trim()
      ? { thinkingLevel: body.thinkingLevel.trim() }
      : {}),
  };
}

// POST /api/agent/[id] - Send a command to an existing session
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let commandType: string | undefined;
  let promptAccepted = false;

  try {
    const body = await req.json() as { type: string; [key: string]: unknown };
    commandType = typeof body.type === "string" ? body.type : undefined;

    if (body.type === "command_os_prepare_prompt") {
      const existing = getRpcSession(id);
      const session = existing?.isAlive()
        ? existing
        : (await (async () => {
            const filePath = await resolveSessionPath(id);
            if (!filePath) throw new Error("PI_SESSION_NOT_FOUND");
            return (await startRpcSession(id, filePath, undefined)).session;
          })());
      const turnId = session.prepareCommandOsTurn(commandOsContext(body));
      return NextResponse.json({ success: true, turnId });
    }

    if (body.type === "set_command_os_metadata") {
      const metadata = record(body.metadata, "PI_COMMAND_OS_SESSION_METADATA_INVALID");
      const existing = getRpcSession(id);
      const session = existing?.isAlive()
        ? existing
        : (await (async () => {
            const filePath = await resolveSessionPath(id);
            if (!filePath) throw new Error("PI_SESSION_NOT_FOUND");
            return (await startRpcSession(id, filePath, undefined)).session;
          })());
      session.setCommandOsMetadata(metadata);
      return NextResponse.json({ success: true });
    }

    // Fast path: already-running session
    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      const result = await existing.send(body);
      promptAccepted = body.type === "prompt";
      return NextResponse.json({ success: true, data: result });
    }

    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({
        error: "Session not found",
        ...(body.type === "prompt"
          ? { code: "prompt_rejected", accepted: false }
          : {}),
      }, { status: 404 });
    }

    const { session } = await startRpcSession(id, filePath, undefined);
    const result = await session.send(body);
    promptAccepted = body.type === "prompt";

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      ...(commandType === "prompt" && !promptAccepted
        ? { code: "prompt_rejected", accepted: false }
        : {}),
    }, { status: 500 });
  }
}

// GET /api/agent/[id] - Get current agent state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = getRpcSession(id);
    if (!session || !session.isAlive()) {
      return NextResponse.json({ running: false });
    }

    const state = await session.send({ type: "get_state" });
    return NextResponse.json({ running: true, state });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
