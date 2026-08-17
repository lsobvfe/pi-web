import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  invalidateSessionListCache,
  invalidateSessionPathCache,
  readSessionHeader,
  resolveSessionPath,
} from "@/lib/session-reader";
import { getRpcSession } from "@/lib/rpc-manager";

export async function trashSession(sessionId: string): Promise<void> {
  const sourcePath = await resolveSessionPath(sessionId);
  if (!sourcePath) throw new Error("PI_RUNTIME_SESSION_NOT_FOUND");
  const targetPath = trashPathForSession(sourcePath);
  if (existsSync(targetPath)) throw new Error("PI_RUNTIME_SESSION_TRASH_CONFLICT");

  await getRpcSession(sessionId)?.shutdown();
  mkdirSync(dirname(targetPath), { recursive: true });
  renameSync(sourcePath, targetPath);
  invalidateSessionPathCache(sessionId);
  invalidateSessionListCache();
}

export function restoreSession(sessionId: string): void {
  const sourcePath = findTrashedSession(sessionId);
  if (!sourcePath) throw new Error("PI_RUNTIME_SESSION_NOT_FOUND");
  const targetPath = restorePathForTrash(sourcePath);
  if (existsSync(targetPath)) throw new Error("PI_RUNTIME_SESSION_RESTORE_CONFLICT");

  mkdirSync(dirname(targetPath), { recursive: true });
  renameSync(sourcePath, targetPath);
  invalidateSessionPathCache(sessionId);
  invalidateSessionListCache();
}

export function listTrashedSessionFiles(): string[] {
  const root = sessionTrashRoot();
  if (!existsSync(root)) return [];
  return walkJsonlFiles(root);
}

function findTrashedSession(sessionId: string): string | undefined {
  return listTrashedSessionFiles().find((filePath) => {
    if (!basename(filePath).includes(sessionId)) return false;
    return readSessionHeader(filePath)?.id === sessionId;
  });
}

function trashPathForSession(sourcePath: string): string {
  const sessionRelativePath = relative(sessionRoot(), resolve(sourcePath));
  assertRelativeSessionPath(sessionRelativePath);
  return join(sessionTrashRoot(), sessionRelativePath);
}

function restorePathForTrash(sourcePath: string): string {
  const sessionRelativePath = relative(sessionTrashRoot(), resolve(sourcePath));
  assertRelativeSessionPath(sessionRelativePath);
  return join(sessionRoot(), sessionRelativePath);
}

function assertRelativeSessionPath(value: string): void {
  if (!value || value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw new Error("PI_RUNTIME_SESSION_PATH_INVALID");
  }
}

function walkJsonlFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkJsonlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      result.push(entryPath);
    }
  }
  return result;
}

function sessionRoot(): string {
  return join(getAgentDir(), "sessions");
}

function sessionTrashRoot(): string {
  return join(getAgentDir(), "trash", "sessions");
}
