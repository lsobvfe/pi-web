import type {
  ExtensionAPI,
  InlineExtension,
} from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";

export interface CommandOsContextItem {
  id: string;
  label?: string;
  content: string;
  resource?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CommandOsTurnContext {
  message: string;
  systemPrompt: string;
  contextItems: CommandOsContextItem[];
  resourceReferences: Record<string, unknown>[];
  parentMessageId?: string;
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
  provider?: string;
  modelId?: string;
  thinkingLevel?: string;
}

const pendingTurns = new Map<string, CommandOsTurnContext>();
const activeTurns = new Map<string, CommandOsTurnContext>();
type TextContent = { type: "text"; text: string };

export function prepareCommandOsTurn(
  sessionId: string,
  context: CommandOsTurnContext,
): string {
  const turnId = randomUUID();
  pendingTurns.set(turnKey(sessionId, turnId), context);
  return turnId;
}

export function startCommandOsTurn(sessionId: string, turnId: string): CommandOsTurnContext {
  const key = turnKey(sessionId, turnId);
  const context = pendingTurns.get(key);
  if (!context) throw new Error("PI_COMMAND_OS_TURN_NOT_FOUND");
  pendingTurns.delete(key);
  if (activeTurns.has(sessionId)) throw new Error("PI_COMMAND_OS_TURN_ALREADY_ACTIVE");
  activeTurns.set(sessionId, context);
  return context;
}

export function getPreparedCommandOsTurn(
  sessionId: string,
  turnId: string,
): CommandOsTurnContext {
  const context = pendingTurns.get(turnKey(sessionId, turnId));
  if (!context) throw new Error("PI_COMMAND_OS_TURN_NOT_FOUND");
  return context;
}

export function consumeCommandOsTurn(sessionId: string): CommandOsTurnContext {
  const context = activeTurns.get(sessionId);
  if (!context) throw new Error("PI_COMMAND_OS_TURN_CONTEXT_NOT_CONSUMED");
  activeTurns.delete(sessionId);
  return context;
}

export function cancelCommandOsTurn(sessionId: string, turnId: string): void {
  pendingTurns.delete(turnKey(sessionId, turnId));
}

export function cancelActiveCommandOsTurn(sessionId: string): void {
  activeTurns.delete(sessionId);
}

export function createCommandOsContextExtension(): InlineExtension {
  return {
    name: "command-os-turn-context",
    hidden: true,
    factory: (pi: ExtensionAPI) => {
      pi.on("before_agent_start", (_event, context) => {
        const turn = consumeCommandOsTurn(context.sessionManager.getSessionId());
        const content: TextContent[] = turn.contextItems.map((item) => ({
          type: "text",
          text: formatContextItem(item),
        }));
        return {
          systemPrompt: turn.systemPrompt,
          ...(content.length > 0
            ? {
                message: {
                  customType: "command_os.context",
                  content,
                  display: false,
                  details: {
                    resourceReferences: turn.resourceReferences,
                  },
                },
              }
            : {}),
        };
      });
    },
  };
}

function formatContextItem(item: CommandOsContextItem): string {
  const title = item.label?.trim() || item.id;
  const resource = item.resource
    ? `\nResource reference: ${JSON.stringify(item.resource)}`
    : "";
  return `## ${title}\n\n${item.content}${resource}`;
}

function turnKey(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}
