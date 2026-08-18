import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { createRuntimeTurnStream } = await createJiti(import.meta.url).import("./runtime-turn-stream.ts");

test("projects one Pi turn to the canonical finite runtime stream", async () => {
  const listeners = [];
  const session = {
    onEvent(listener) {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    inner: {
      sessionManager: {
        getBranch() {
          return [{
            type: "message",
            id: "assistant-1",
            parentId: "user-1",
            timestamp: "2026-08-17T00:00:00Z",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "Hello" }],
              provider: "mock",
              model: "mock-stream",
              timestamp: Date.now(),
            },
          }];
        },
      },
    },
  };
  let startTurnCalled = false;
  const stream = createRuntimeTurnStream(
    new Request("http://runtime.test"),
    session,
    async () => {
      startTurnCalled = true;
    },
  );
  const responseText = new Response(stream).text();
  await Promise.resolve();

  assert.equal(startTurnCalled, true);
  listeners[0]({ type: "agent_start" });
  listeners[0]({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: "Hel" },
  });
  listeners[0]({ type: "prompt_done" });

  const output = await responseText;
  assert.match(output, /event: turn_start\ndata: \{\}/);
  assert.match(output, /event: token\ndata: \{"text":"Hel"\}/);
  assert.match(output, /event: message_complete\ndata: \{"messageId":"assistant-1","content":"Hello"/);
  assert.match(output, /event: done\ndata: \{\}/);
  assert.equal(listeners.length, 0);
});

test("closes a failed turn with an explicit error event", async () => {
  const listeners = [];
  const session = {
    onEvent(listener) {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    inner: { sessionManager: { getBranch: () => [] } },
  };
  const stream = createRuntimeTurnStream(
    new Request("http://runtime.test"),
    session,
    async () => {},
  );
  const responseText = new Response(stream).text();

  listeners[0]({ type: "prompt_error", errorMessage: "MODEL_FAILED" });

  assert.match(await responseText, /event: error\ndata: \{"message":"MODEL_FAILED"\}/);
  assert.equal(listeners.length, 0);
});

test("opens the stream before a prompt command settles", async () => {
  let resolveStart;
  const startTurn = new Promise((resolve) => {
    resolveStart = resolve;
  });
  const session = {
    onEvent() {
      return () => {};
    },
    inner: { sessionManager: { getBranch: () => [] } },
  };
  const stream = createRuntimeTurnStream(
    new Request("http://runtime.test"),
    session,
    () => startTurn,
  );
  const reader = stream.getReader();

  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), ":\n\n");
  resolveStart();
  await reader.cancel();
});

test("reports prompt startup rejection as a finite error stream", async () => {
  const session = {
    onEvent() {
      return () => {};
    },
    inner: { sessionManager: { getBranch: () => [] } },
  };
  const stream = createRuntimeTurnStream(
    new Request("http://runtime.test"),
    session,
    async () => {
      throw new Error("PROMPT_START_FAILED");
    },
  );

  assert.match(
    await new Response(stream).text(),
    /event: error\ndata: \{"message":"PROMPT_START_FAILED"\}/,
  );
});
