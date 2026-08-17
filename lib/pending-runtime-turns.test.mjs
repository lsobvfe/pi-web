import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

async function loadSubject() {
  return import("./pending-runtime-turns.ts");
}

afterEach(() => {
  globalThis.__piPendingRuntimeTurns?.clear();
});

test("consumes each prepared runtime turn exactly once", async () => {
  const { consumeRuntimeTurn, prepareRuntimeTurn } = await loadSubject();
  const turn = { message: "hello", contextItems: [], images: [] };
  const streamId = prepareRuntimeTurn("session-a", turn);

  assert.deepEqual(consumeRuntimeTurn("session-a", streamId), turn);
  assert.throws(
    () => consumeRuntimeTurn("session-a", streamId),
    /PI_RUNTIME_STREAM_NOT_FOUND/,
  );
});

test("does not allow a stream token to cross session boundaries", async () => {
  const { consumeRuntimeTurn, prepareRuntimeTurn } = await loadSubject();
  const streamId = prepareRuntimeTurn("session-a", {
    message: "private",
    contextItems: [],
    images: [],
  });

  assert.throws(
    () => consumeRuntimeTurn("session-b", streamId),
    /PI_RUNTIME_STREAM_NOT_FOUND/,
  );
  assert.throws(
    () => consumeRuntimeTurn("session-a", streamId),
    /PI_RUNTIME_STREAM_NOT_FOUND/,
  );
});

test("fails explicitly when the pending turn capacity is exhausted", async () => {
  const { prepareRuntimeTurn } = await loadSubject();
  for (let index = 0; index < 128; index += 1) {
    prepareRuntimeTurn(`session-${index}`, {
      message: String(index),
      contextItems: [],
      images: [],
    });
  }

  assert.throws(
    () => prepareRuntimeTurn("overflow", {
      message: "overflow",
      contextItems: [],
      images: [],
    }),
    /PI_RUNTIME_PENDING_TURN_LIMIT/,
  );
});
