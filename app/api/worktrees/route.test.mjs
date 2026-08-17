import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { DELETE, GET, POST } = await jiti.import("./route.ts");

test("managed mode disables every worktree operation", async (t) => {
  const previous = process.env.PI_WEB_MANAGED;
  process.env.PI_WEB_MANAGED = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.PI_WEB_MANAGED;
    else process.env.PI_WEB_MANAGED = previous;
  });

  const responses = await Promise.all([
    GET(new Request("http://localhost/api/worktrees?cwd=/mnt/project")),
    POST(new Request("http://localhost/api/worktrees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: "/mnt/project", branch: "test" }),
    })),
    DELETE(new Request("http://localhost/api/worktrees", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: "/mnt/project", path: "/mnt/worktree" }),
    })),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "PI_WEB_MANAGED_WORKTREES_DISABLED",
    });
  }
});
