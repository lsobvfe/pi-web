import {
  createAgentSessionFromServices,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { managedWorkspaceRoot } from "@/lib/managed-mode";

export type RuntimeGenerationInput = {
  prompt: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  temperature?: number;
  samplingParams?: Record<string, unknown>;
};

type GenerationSession = Awaited<ReturnType<typeof createGenerationSession>>;

export async function generateRuntimeText(input: RuntimeGenerationInput): Promise<string> {
  const session = await createGenerationSession(input);
  try {
    await session.prompt(input.prompt, {
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
    });
    return assistantText(session.messages);
  } finally {
    session.dispose();
  }
}

export function streamRuntimeText(
  request: Request,
  input: RuntimeGenerationInput,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let session: GenerationSession | null = null;
      let unsubscribe: (() => void) | null = null;
      let closed = false;

      const emit = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
        ));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        session?.dispose();
        controller.close();
      };
      const abort = () => close();
      request.signal.addEventListener("abort", abort, { once: true });

      void (async () => {
        try {
          session = await createGenerationSession(input);
          unsubscribe = session.subscribe((event) => {
            if (
              event.type === "message_update"
              && event.assistantMessageEvent.type === "text_delta"
            ) {
              emit("token", { text: event.assistantMessageEvent.delta });
            }
          });
          await session.prompt(input.prompt, {
            ...(input.systemPrompt !== undefined
              ? { systemPrompt: input.systemPrompt }
              : {}),
          });
          emit("complete", { content: assistantText(session.messages) });
          close();
        } catch (error) {
          console.error("[pi-web] managed runtime generation failed", error);
          emit("error", { message: generationErrorCode(error) });
          close();
        } finally {
          request.signal.removeEventListener("abort", abort);
        }
      })();
    },
  });
}

async function createGenerationSession(input: RuntimeGenerationInput) {
  const cwd = managedWorkspaceRoot();
  const services = await createAgentSessionServices({
    cwd,
    agentDir: getAgentDir(),
  });
  const model = services.modelRuntime.getModel(input.provider, input.model);
  if (!model) throw new Error("PI_RUNTIME_MODEL_NOT_FOUND");
  const { session } = await createAgentSessionFromServices({
    services,
    sessionManager: SessionManager.inMemory(cwd),
    model,
    noTools: "all",
    requestOptions: {
      ...(input.temperature !== undefined
        ? { temperature: input.temperature }
        : {}),
      ...(input.samplingParams
        ? { samplingParams: input.samplingParams }
        : {}),
    },
  });
  return session;
}

function assistantText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }
    return message.content
      .filter((block) => isRecord(block) && block.type === "text" && typeof block.text === "string")
      .map((block) => String(block.text))
      .join("");
  }
  throw new Error("PI_RUNTIME_GENERATION_EMPTY");
}

export function generationErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/api key|credential|authentication/i.test(message)) {
    return "PI_RUNTIME_CREDENTIAL_MISSING";
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return message;
  return "PI_RUNTIME_GENERATION_FAILED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
