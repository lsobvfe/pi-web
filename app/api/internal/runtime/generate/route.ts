import { NextResponse } from "next/server";
import {
  generateRuntimeText,
  generationErrorCode,
  streamRuntimeText,
  type RuntimeGenerationInput,
} from "@/lib/runtime-generation";
import { logRuntimeError } from "@/lib/runtime-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const input = generationInput(body);
    if (body.stream === true) {
      return new Response(streamRuntimeText(request, input), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    return NextResponse.json({ content: await generateRuntimeText(input) });
  } catch (error) {
    logRuntimeError("failed to run managed runtime generation", error);
    return NextResponse.json({
      error: generationErrorCode(error),
    }, { status: 500 });
  }
}

function generationInput(body: Record<string, unknown>): RuntimeGenerationInput {
  const prompt = promptText(body);
  const provider = requiredText(body.provider, "PI_RUNTIME_PROVIDER_REQUIRED");
  const model = requiredText(body.model, "PI_RUNTIME_MODEL_REQUIRED");
  return {
    prompt,
    provider,
    model,
    ...(typeof body.systemPrompt === "string"
      ? { systemPrompt: body.systemPrompt }
      : {}),
    ...(body.temperature !== undefined
      ? { temperature: finiteNumber(body.temperature, "PI_RUNTIME_TEMPERATURE_INVALID") }
      : {}),
    ...(body.samplingParams !== undefined
      ? { samplingParams: record(body.samplingParams, "PI_RUNTIME_SAMPLING_PARAMS_INVALID") }
      : {}),
  };
}

function promptText(body: Record<string, unknown>): string {
  if (typeof body.prompt === "string" && body.prompt.trim()) return body.prompt.trim();
  if (!Array.isArray(body.messages)) throw new Error("PI_RUNTIME_PROMPT_REQUIRED");
  const parts = body.messages
    .filter(isRecord)
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .filter((content): content is string => typeof content === "string" && Boolean(content.trim()));
  if (!parts.length) throw new Error("PI_RUNTIME_PROMPT_REQUIRED");
  return parts.join("\n\n");
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function finiteNumber(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(code);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
