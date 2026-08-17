import {
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { managedWorkspaceRoot } from "@/lib/managed-mode";

const INTEGRATION_NAMESPACE = "commandOs";

export function readCommandOsSettings(): Record<string, unknown> {
  const manager = createSettingsManager();
  return manager.getIntegrationSettings(INTEGRATION_NAMESPACE);
}

export async function writeCommandOsSettings(
  value: unknown,
): Promise<Record<string, unknown>> {
  if (!isRecord(value)) throw new Error("PI_RUNTIME_SETTINGS_INVALID");
  const manager = createSettingsManager();
  manager.setIntegrationSettings(INTEGRATION_NAMESPACE, value);
  await manager.flush();
  assertSettingsHealthy(manager);
  return structuredClone(value);
}

function createSettingsManager(): SettingsManager {
  const manager = SettingsManager.create(managedWorkspaceRoot(), getAgentDir(), {
    projectTrusted: false,
  });
  assertSettingsHealthy(manager);
  return manager;
}

function assertSettingsHealthy(manager: SettingsManager): void {
  if (manager.drainErrors().length > 0) {
    throw new Error("PI_RUNTIME_SETTINGS_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
