import { randomUUID } from "crypto";
import { existsSync, statSync } from "fs";
import {
  createAgentSession,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { startRpcSession, getRpcSession } from "@/lib/rpc-manager";
import {
  buildSessionContext,
  getSessionCustomData,
  listAllSessions,
  resolveSessionIdByPath,
  resolveSessionPath,
  sessionEntryToUiMessage,
} from "@/lib/session-reader";
import { managedWorkspaceRoot } from "@/lib/managed-mode";
import { listTrashedSessionFiles } from "@/lib/session-lifecycle";
import type {
  AgentMessage,
  SessionEntry,
  SessionInfo,
  ToolResultMessage,
} from "@/lib/types";

export type RuntimeSessionMetadata = {
  extensionId?: string;
  sourceContext?: Record<string, unknown>;
  context?: Record<string, unknown>;
  deleted?: boolean;
};

export type RuntimeSession = {
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  parentSessionId?: string;
  metadata: RuntimeSessionMetadata;
  messages?: Array<Record<string, unknown>>;
  runtimeState: Record<string, unknown>;
};

export async function createRuntimeSession(
  metadata: RuntimeSessionMetadata,
  name?: string,
  model?: { provider: string; modelId: string },
  thinkingLevel?: string,
): Promise<RuntimeSession> {
  const tempKey = `__internal_new__${randomUUID()}`;
  const { session, realSessionId } = await startRpcSession(tempKey, "", managedWorkspaceRoot(), {
    ...(model ? { initialModel: model } : {}),
    ...(thinkingLevel ? { thinkingLevel: thinkingLevel as never } : {}),
  });
  if (name?.trim()) await session.send({ type: "set_session_name", name: name.trim() });
  session.inner.sessionManager.appendCustomEntry("command_os.runtime_metadata", metadata);
  session.inner.sessionManager.flush();
  return runtimeSession(realSessionId);
}

export async function listRuntimeSessions(): Promise<RuntimeSession[]> {
  const sessions = await listAllSessions();
  const deletedSessions = listTrashedSessionFiles().map((filePath) =>
    runtimeSessionFileSummary(filePath, true)
  );
  return [...sessions.map(runtimeSessionSummary), ...deletedSessions]
    .sort((left, right) => right.modified.localeCompare(left.modified));
}

export async function runtimeSession(id: string): Promise<RuntimeSession> {
  const rpc = getRpcSession(id);
  const filePath = rpc?.isAlive() ? rpc.sessionFile : await resolveSessionPath(id);
  if (!filePath || !existsSync(filePath)) throw new Error("PI_RUNTIME_SESSION_NOT_FOUND");
  return runtimeSessionFromFile(filePath, rpc?.isAlive() ? rpc.inner.sessionManager : undefined);
}

async function runtimeSessionFromFile(
  filePath: string,
  liveManager?: SessionManager,
): Promise<RuntimeSession> {
  const manager = liveManager ?? SessionManager.open(filePath);
  const header = manager.getHeader();
  if (!header) throw new Error("PI_RUNTIME_SESSION_HEADER_MISSING");
  const entries = manager.getEntries();
  const sessionContext = buildSessionContext(entries as never, manager.getLeafId());
  const mappedEntries = runtimeMessageEntries(entries as unknown as SessionEntry[]);
  const messageCount = mappedEntries.filter((entry) => entry.message.role === "user").length;
  const modified = statSync(filePath).mtime.toISOString();
  const messages = runtimeMessages(
    header.id,
    header.timestamp,
    mappedEntries,
  );
  return {
    id: header.id,
    cwd: "/mnt/project",
    name: manager.getSessionName(),
    created: header.timestamp,
    modified,
    messageCount,
    firstMessage: firstUserMessage(mappedEntries),
    parentSessionId: header.parentSession
      ? await resolveSessionIdByPath(header.parentSession)
      : undefined,
    metadata: sessionMetadata(entries),
    messages,
    runtimeState: {
      state: {
        thinkingLevel: sessionContext.thinkingLevel,
        model: sessionContext.model,
      },
    },
  };
}

function runtimeSessionSummary(session: SessionInfo): RuntimeSession {
  const metadata = metadataValue(
    getSessionCustomData(session, "command_os.runtime_metadata"),
  );
  return {
    id: session.id,
    cwd: "/mnt/project",
    name: session.name,
    created: session.created,
    modified: session.modified,
    messageCount: session.messageCount,
    firstMessage: session.firstMessage === "(no messages)" ? "" : session.firstMessage,
    parentSessionId: session.parentSessionId,
    metadata,
    runtimeState: {},
  };
}

function runtimeSessionFileSummary(filePath: string, deleted: boolean): RuntimeSession {
  const manager = SessionManager.open(filePath);
  const header = manager.getHeader();
  if (!header) throw new Error("PI_RUNTIME_SESSION_HEADER_MISSING");
  const entries = manager.getEntries();
  const messages = runtimeMessageEntries(entries as unknown as SessionEntry[]);
  return {
    id: header.id,
    cwd: "/mnt/project",
    name: manager.getSessionName(),
    created: header.timestamp,
    modified: statSync(filePath).mtime.toISOString(),
    messageCount: messages.filter((entry) => entry.message.role === "user").length,
    firstMessage: firstUserMessage(messages),
    metadata: sessionMetadata(entries, deleted),
    runtimeState: {},
  };
}

function firstUserMessage(entries: RuntimeMessageEntry[]): string {
  const entry = entries.find((item) => item.message.role === "user");
  return entry?.message.role === "user"
    ? textContent(entry.message.content)
    : "";
}

function sessionMetadata(
  entries: readonly unknown[],
  deleted = false,
): RuntimeSessionMetadata {
  const customEntries = entries
    .map((entry) => entry as unknown)
    .filter(isCustomEntry);
  const metadata = customEntries
    .filter((entry) => entry.customType === "command_os.runtime_metadata")
    .at(-1);
  return {
    ...metadataValue(metadata?.data),
    ...(deleted ? { deleted: true } : {}),
  };
}

function metadataValue(value: unknown): RuntimeSessionMetadata {
  return isMetadata(value) ? value : {};
}

function runtimeMessages(
  sessionId: string,
  sessionTimestamp: string,
  entries: RuntimeMessageEntry[],
): Array<Record<string, unknown>> {
  const toolResults = new Map<string, ToolResultMessage>();
  entries.forEach(({ message }) => {
    if (message.role === "toolResult") toolResults.set(message.toolCallId, message);
  });
  const result: Array<Record<string, unknown>> = [];
  entries.forEach(({ message, id: messageId, parentId }) => {
    if (message.role === "user") {
      const blocks = Array.isArray(message.content) ? message.content : undefined;
      result.push({
        message_id: messageId,
        conversation_id: sessionId,
        role: "user",
        content: textContent(message.content),
        context_items: [],
        tool_calls: [],
        metadata: {
          ...(blocks ? { contentBlocks: blocks } : {}),
          ...(parentId ? { parentMessageId: parentId } : {}),
        },
        created_at: isoTimestamp(message.timestamp, sessionTimestamp),
      });
      return;
    }
    if (message.role !== "assistant") return;
    const thinking = message.content
      .filter((block) => block.type === "thinking")
      .map((block) => block.thinking)
      .join("\n");
    const toolCalls = message.content
      .filter((block) => block.type === "toolCall")
      .map((block) => {
        const toolResult = toolResults.get(block.toolCallId);
        return {
          id: block.toolCallId,
          name: block.toolName,
          arguments: block.input,
          ...(toolResult
            ? {
                result: textContent(toolResult.content),
                status: toolResult.isError ? "failed" : "completed",
              }
            : {}),
        };
      });
    result.push({
      message_id: messageId,
      conversation_id: sessionId,
      role: "assistant",
      content: message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(""),
      context_items: [],
      tool_calls: toolCalls,
      metadata: {
        provider: message.provider,
        model: message.model,
        ...(message.stopReason ? { stopReason: message.stopReason } : {}),
        ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
        ...(message.usage ? { usage: message.usage } : {}),
        ...(thinking ? { thinking } : {}),
        ...(parentId ? { parentMessageId: parentId } : {}),
      },
      created_at: isoTimestamp(message.timestamp, sessionTimestamp),
    });
  });
  return result;
}

function runtimeMessageEntries(entries: SessionEntry[]): RuntimeMessageEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const mappedById = new Map<string, AgentMessage>();
  const visibleIds = new Set<string>();
  for (const entry of entries) {
    const message = sessionEntryToUiMessage(entry, {});
    if (!message) continue;
    mappedById.set(entry.id, message);
    if (message.role === "user" || message.role === "assistant") {
      visibleIds.add(entry.id);
    }
  }
  return entries.flatMap((entry) => {
    const message = mappedById.get(entry.id);
    if (!message) return [];
    return [{
      id: entry.id,
      parentId: visibleParentId(entry.parentId, byId, visibleIds),
      message,
    }];
  });
}

function visibleParentId(
  parentId: string | null,
  byId: Map<string, SessionEntry>,
  visibleIds: Set<string>,
): string | undefined {
  let current = parentId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (visibleIds.has(current)) return current;
    current = byId.get(current)?.parentId ?? null;
  }
  return undefined;
}

type RuntimeMessageEntry = {
  id: string;
  parentId?: string;
  message: AgentMessage;
};

function textContent(
  content: string | Array<{ type: string; text?: string }>,
): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

function isoTimestamp(value: number | undefined, fallback: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return new Date(value).toISOString();
}

export function sessionForCommand(id: string) {
  return getRpcSession(id);
}

export async function listRuntimeTools(): Promise<Array<{
  name: string;
  description: string;
}>> {
  const sessionManager = SessionManager.inMemory(managedWorkspaceRoot());
  const { session } = await createAgentSession({
    cwd: managedWorkspaceRoot(),
    agentDir: getAgentDir(),
    sessionManager,
  });
  try {
    return session.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  } finally {
    session.dispose();
  }
}

function isMetadata(value: unknown): value is RuntimeSessionMetadata {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCustomEntry(value: unknown): value is {
  type: "custom";
  customType: string;
  data: unknown;
} {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === "custom"
    && typeof (value as { customType?: unknown }).customType === "string";
}
