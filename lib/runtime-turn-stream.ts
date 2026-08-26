import type { AgentEventLike } from "./agent-event-wire";
import type {
  SessionEntry,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

interface RuntimeTurnSession {
  onEvent(listener: (event: AgentEventLike) => void): () => void;
  inner: {
    sessionManager: {
      getBranch(): SessionEntry[];
    };
  };
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export function createRuntimeTurnStream(
  req: Request,
  session: RuntimeTurnSession,
  startTurn: () => Promise<unknown>,
): ReadableStream<Uint8Array> {
  let cancel: (closeController: boolean) => void = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;
      let abortHandler: (() => void) | null = null;

      const cleanup = (closeController: boolean) => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        if (abortHandler) req.signal.removeEventListener("abort", abortHandler);
        if (closeController) {
          try { controller.close(); } catch { /* stream already closed */ }
        }
      };
      cancel = cleanup;

      const enqueue = (value: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          cleanup(false);
        }
      };
      const emit = (event: string, data: Record<string, unknown>) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const finishWithError = (message: string) => {
        emit("error", { message });
        cleanup(true);
      };

      unsubscribe = session.onEvent((event) => {
        try {
          if (event.type === "agent_start") {
            emit("turn_start", {});
            return;
          }
          if (event.type === "message_update") {
            emitAssistantDelta(event, emit);
            return;
          }
          if (event.type === "tool_execution_start") {
            emit("tool_call_start", {
              toolId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            });
            return;
          }
          if (event.type === "tool_execution_end") {
            emit("tool_call_result", {
              toolId: event.toolCallId,
              toolName: event.toolName,
              result: event.result,
              status: event.isError ? "failed" : "completed",
            });
            return;
          }
          if (event.type === "auto_retry_start" || event.type === "auto_retry_end") {
            const { type, ...payload } = event;
            emit(type, payload);
            return;
          }
          if (event.type === "prompt_error") {
            finishWithError(text(event.errorMessage, "PI_RUNTIME_PROMPT_FAILED"));
            return;
          }
          if (event.type === "prompt_done") {
            const completed = completedMessage(session);
            const metadata = record(completed.metadata);
            const failure = text(metadata.errorMessage, "");
            if (failure) {
              finishWithError(failure);
              return;
            }
            emit("message_complete", completed);
            emit("done", {});
            cleanup(true);
          }
        } catch (error) {
          finishWithError(error instanceof Error ? error.message : String(error));
        }
      });

      abortHandler = () => cleanup(true);
      if (req.signal.aborted) {
        cleanup(true);
        return;
      }
      req.signal.addEventListener("abort", abortHandler, { once: true });
      heartbeat = setInterval(() => enqueue(":\n\n"), HEARTBEAT_INTERVAL_MS);
      enqueue(":\n\n");
      queueMicrotask(() => {
        if (closed) return;
        void startTurn().catch((error) => {
          finishWithError(error instanceof Error ? error.message : String(error));
        });
      });
    },
    cancel() {
      cancel(false);
    },
  });
}

function emitAssistantDelta(
  event: AgentEventLike,
  emit: (event: string, data: Record<string, unknown>) => void,
): void {
  const update = record(event.assistantMessageEvent);
  if (update.type === "text_delta") {
    emit("token", { text: text(update.delta, "") });
  } else if (update.type === "thinking_delta") {
    emit("agent_thinking", { content: text(update.delta, "") });
  }
}

function completedMessage(session: RuntimeTurnSession): Record<string, unknown> {
  const entry = [...session.inner.sessionManager.getBranch()]
    .reverse()
    .find(isAssistantEntry);
  if (!entry || entry.message.role !== "assistant") {
    throw new Error("PI_RUNTIME_ASSISTANT_MESSAGE_MISSING");
  }
  const message = entry.message;
  const thinking = message.content
    .filter((block) => block.type === "thinking")
    .map((block) => block.thinking)
    .join("\n");
  return {
    messageId: entry.id,
    content: message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(""),
    toolCalls: message.content
      .filter((block) => block.type === "toolCall")
      .map((block) => ({
        id: block.id,
        name: block.name,
        arguments: block.arguments,
      })),
    metadata: {
      provider: message.provider,
      model: message.model,
      ...(message.usage ? { usage: message.usage } : {}),
      ...(thinking ? { thinking } : {}),
      ...(message.stopReason ? { stopReason: message.stopReason } : {}),
      ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
    },
  };
}

function isAssistantEntry(
  entry: SessionEntry,
): entry is SessionMessageEntry & {
  message: Extract<SessionMessageEntry["message"], { role: "assistant" }>;
} {
  return entry.type === "message" && entry.message.role === "assistant";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, defaultValue: string): string {
  return typeof value === "string" ? value : defaultValue;
}
