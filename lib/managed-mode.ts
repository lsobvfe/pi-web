import { resolve } from "path";

const MANAGED_MODE = "1";

export function isManagedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PI_WEB_MANAGED === MANAGED_MODE;
}

export function managedWorkspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PI_WEB_WORKSPACE_ROOT?.trim();
  if (!configured) throw new Error("PI_WEB_WORKSPACE_ROOT_REQUIRED");
  return resolve(configured);
}

export function directorySelectionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isManagedMode(env) && env.PI_WEB_ALLOW_DIRECTORY_SELECTION !== "0";
}

export function assertManagedWorkspacePath(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const root = managedWorkspaceRoot(env);
  const resolved = resolve(candidate);
  if (isManagedMode(env) && resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new Error("PI_WEB_MANAGED_WORKSPACE_REQUIRED");
  }
  return resolved;
}

export function assertRuntimeWorkspaceCwd(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const resolved = resolve(candidate);
  if (isManagedMode(env) && resolved !== managedWorkspaceRoot(env)) {
    throw new Error("PI_WEB_MANAGED_WORKSPACE_REQUIRED");
  }
  return resolved;
}
