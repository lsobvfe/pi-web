import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("scopes Next.js output file tracing to the pi-web package", async () => {
  const config = await createJiti(import.meta.url).import("../next.config.ts", { default: true });

  assert.equal(config.outputFileTracingRoot, projectRoot);
});

test("loads Pi packages from the sandbox runtime instead of bundling them", async () => {
  const configModule = await createJiti(import.meta.url).import("../next.config.ts");
  const serverConfig = { externals: [], resolve: { alias: {} } };
  const clientConfig = { externals: [], resolve: { alias: {} } };

  configModule.default.webpack(serverConfig, { isServer: true });
  configModule.default.webpack(clientConfig, { isServer: false });

  assert.equal(serverConfig.externals.length, 1);
  assert.equal(clientConfig.externals.length, 0);
  assert.deepEqual(
    configModule.default.serverExternalPackages.filter((name) => name.startsWith("@earendil-works/pi-")),
    [...configModule.piExternalPackages],
  );

  const externalize = serverConfig.externals[0];
  await new Promise((resolve, reject) => {
    externalize(
      { request: "@earendil-works/pi-coding-agent" },
      (error, result) => {
        try {
          assert.ifError(error);
          assert.equal(result, "module @earendil-works/pi-coding-agent");
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
  await new Promise((resolve, reject) => {
    externalize(
      { request: "next/server" },
      (error, result) => {
        try {
          assert.ifError(error);
          assert.equal(result, undefined);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});
