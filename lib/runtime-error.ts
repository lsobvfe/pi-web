export function runtimeErrorCode(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]+$/.test(message) ? message : fallback;
}

export function logRuntimeError(operation: string, error: unknown): void {
  console.error(`[pi-web] ${operation}`, error);
}
