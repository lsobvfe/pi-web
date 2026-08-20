import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";

const CONFIG_DIR = "command-os";
const CONFIG_FILE = "endpoint-config.json";

export function readCommandOsEndpointConfig(): Record<string, unknown> {
  const path = commandOsEndpointConfigPath();
  if (!existsSync(path)) return {};
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PI_COMMAND_OS_ENDPOINT_CONFIG_INVALID");
  }
  return value as Record<string, unknown>;
}

export function writeCommandOsEndpointConfig(
  settings: Record<string, unknown>,
): void {
  const dir = join(getAgentDir(), CONFIG_DIR);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writePrivateFileAtomicSync(
    join(dir, CONFIG_FILE),
    `${JSON.stringify(settings, null, 2)}\n`,
  );
}

function commandOsEndpointConfigPath(): string {
  return join(getAgentDir(), CONFIG_DIR, CONFIG_FILE);
}
