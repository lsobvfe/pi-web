import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { POST } = await jiti.import("./route.ts");
const { projectIdentityKey } = await jiti.import("../../../../lib/project-identity.ts");

test("validated cwd responses include server-resolved project identity", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-web-cwd-validate-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const response = await POST(new Request("http://localhost/api/cwd/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    cwd,
    projectRoot: cwd,
    projectKey: projectIdentityKey(cwd),
  });
});

test("managed mode accepts only the fixed runtime cwd", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-web-managed-cwd-"));
  const child = path.join(cwd, "child");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(child));
  const previousManaged = process.env.PI_WEB_MANAGED;
  const previousRoot = process.env.PI_WEB_WORKSPACE_ROOT;
  process.env.PI_WEB_MANAGED = "1";
  process.env.PI_WEB_WORKSPACE_ROOT = cwd;
  t.after(async () => {
    restoreEnv("PI_WEB_MANAGED", previousManaged);
    restoreEnv("PI_WEB_WORKSPACE_ROOT", previousRoot);
    await rm(cwd, { recursive: true, force: true });
  });

  const accepted = await POST(new Request("http://localhost/api/cwd/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  }));
  const denied = await POST(new Request("http://localhost/api/cwd/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd: child }),
  }));

  assert.equal(accepted.status, 200);
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), {
    error: "PI_WEB_MANAGED_WORKSPACE_REQUIRED",
  });
});

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
