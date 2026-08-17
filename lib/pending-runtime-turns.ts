import { randomUUID } from "node:crypto";

export type PendingRuntimeTurn = {
  message: string;
  contextItems: unknown[];
  images: unknown[];
  provider?: string;
  modelId?: string;
  thinkingLevel?: string;
  parentMessageId?: string;
  systemPrompt?: string;
};

type PendingEntry = {
  sessionId: string;
  expiresAt: number;
  turn: PendingRuntimeTurn;
};

declare global {
  var __piPendingRuntimeTurns: Map<string, PendingEntry> | undefined;
}

const PENDING_TURN_TTL_MS = 5 * 60_000;
const MAX_PENDING_TURNS = 128;

export function prepareRuntimeTurn(
  sessionId: string,
  turn: PendingRuntimeTurn,
): string {
  const pending = pendingTurns();
  pruneExpired(pending);
  if (pending.size >= MAX_PENDING_TURNS) {
    throw new Error("PI_RUNTIME_PENDING_TURN_LIMIT");
  }
  const streamId = randomUUID();
  pending.set(streamId, {
    sessionId,
    expiresAt: Date.now() + PENDING_TURN_TTL_MS,
    turn,
  });
  return streamId;
}

export function consumeRuntimeTurn(
  sessionId: string,
  streamId: string,
): PendingRuntimeTurn {
  const pending = pendingTurns();
  pruneExpired(pending);
  const entry = pending.get(streamId);
  pending.delete(streamId);
  if (!entry || entry.sessionId !== sessionId) {
    throw new Error("PI_RUNTIME_STREAM_NOT_FOUND");
  }
  return entry.turn;
}

function pendingTurns(): Map<string, PendingEntry> {
  globalThis.__piPendingRuntimeTurns ??= new Map();
  return globalThis.__piPendingRuntimeTurns;
}

function pruneExpired(pending: Map<string, PendingEntry>): void {
  const now = Date.now();
  for (const [streamId, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(streamId);
  }
}
