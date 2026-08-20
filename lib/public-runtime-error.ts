export function publicRuntimeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api key|credential|no api key|authentication/i.test(message)) {
    return "PI_RUNTIME_CREDENTIAL_MISSING";
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return message;
  return message.replace(
    /\/(?:mnt|runtime|tmp|home|var|opt|usr)(?:\/[^\s),\]}"]*)?/g,
    "[runtime-path]",
  );
}
