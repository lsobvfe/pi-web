import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});
const { clearManagedProviderSdkIdentity } = await jiti.import("./managed-provider-identity.ts");

test("managed provider identity clears OpenAI SDK transport headers only", () => {
  const headers = {
    Authorization: "Bearer token",
    "User-Agent": "OpenAI/JS 6.40.0",
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": "6.40.0",
    "X-Stainless-OS": "Linux",
    "X-Stainless-Arch": "x64",
    "X-Stainless-Runtime": "node",
    "X-Stainless-Runtime-Version": "v22.22.2",
    "X-Stainless-Retry-Count": "0",
    "X-Stainless-Timeout": "600",
    "X-Provider-Contract": "kept",
  };

  clearManagedProviderSdkIdentity(headers);

  assert.equal(headers.Authorization, "Bearer token");
  assert.equal(headers["X-Provider-Contract"], "kept");
  for (const name of [
    "User-Agent",
    "X-Stainless-Lang",
    "X-Stainless-Package-Version",
    "X-Stainless-OS",
    "X-Stainless-Arch",
    "X-Stainless-Runtime",
    "X-Stainless-Runtime-Version",
    "X-Stainless-Retry-Count",
    "X-Stainless-Timeout",
  ]) {
    assert.equal(headers[name], null);
  }
});
