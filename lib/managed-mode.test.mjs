import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});
const {
  assertManagedWorkspacePath,
  assertRuntimeWorkspaceCwd,
  directorySelectionEnabled,
} = await jiti.import("./managed-mode.ts");

const managedEnv = {
  PI_WEB_MANAGED: "1",
  PI_WEB_WORKSPACE_ROOT: "/mnt/project",
  PI_WEB_ALLOW_DIRECTORY_SELECTION: "0",
};

test("managed runtime uses one fixed cwd while file paths may stay inside the project", () => {
  assert.equal(assertRuntimeWorkspaceCwd("/mnt/project", managedEnv), "/mnt/project");
  assert.throws(
    () => assertRuntimeWorkspaceCwd("/mnt/project/subdir", managedEnv),
    /PI_WEB_MANAGED_WORKSPACE_REQUIRED/,
  );
  assert.equal(
    assertManagedWorkspacePath("/mnt/project/subdir", managedEnv),
    "/mnt/project/subdir",
  );
  assert.throws(
    () => assertManagedWorkspacePath("/mnt/home", managedEnv),
    /PI_WEB_MANAGED_WORKSPACE_REQUIRED/,
  );
  assert.equal(directorySelectionEnabled(managedEnv), false);
});
