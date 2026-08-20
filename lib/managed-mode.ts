import { relative, resolve } from "path";

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

export function publicManagedPath(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!isManagedMode(env)) return candidate;
  const normalized = resolve(candidate);
  if (normalized === managedWorkspaceRoot(env)) return "/mnt/project";
  if (normalized === "/mnt/home") return "~";
  if (normalized.startsWith("/mnt/home/")) return `~/${relative("/mnt/home", normalized)}`;
  if (normalized.startsWith(`${managedWorkspaceRoot(env)}/`)) {
    return `/mnt/project/${relative(managedWorkspaceRoot(env), normalized)}`;
  }
  return "";
}

export function resolveManagedPath(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!isManagedMode(env)) return resolve(candidate);
  const value = candidate.trim();
  if (value === "~") return "/mnt/home";
  if (value.startsWith("~/")) return resolve("/mnt/home", value.slice(2));
  return assertManagedWorkspacePath(value, env);
}
