import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});

test("reports managed runtime policy from server-side environment", async (t) => {
  const previous = {
    managed: process.env.PI_WEB_MANAGED,
    root: process.env.PI_WEB_WORKSPACE_ROOT,
    directorySelection: process.env.PI_WEB_ALLOW_DIRECTORY_SELECTION,
  };
  process.env.PI_WEB_MANAGED = "1";
  process.env.PI_WEB_WORKSPACE_ROOT = "/mnt/project";
  process.env.PI_WEB_ALLOW_DIRECTORY_SELECTION = "0";
  t.after(() => {
    restoreEnv("PI_WEB_MANAGED", previous.managed);
    restoreEnv("PI_WEB_WORKSPACE_ROOT", previous.root);
    restoreEnv("PI_WEB_ALLOW_DIRECTORY_SELECTION", previous.directorySelection);
  });

  const { GET } = await jiti.import("./route.ts");
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    managed: true,
    directorySelectionEnabled: false,
    workspaceRoot: "/mnt/project",
  });
});

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
