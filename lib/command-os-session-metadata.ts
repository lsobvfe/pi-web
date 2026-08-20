import { closeSync, openSync, readSync } from "node:fs";

const METADATA_ENTRY_TYPE = "command_os.session_metadata";
const MAX_METADATA_SCAN_BYTES = 256 * 1024;

export function readCommandOsSessionMetadata(
  filePath: string,
): Record<string, unknown> | undefined {
  let fd: number;
  try {
    fd = openSync(filePath, "r");
  } catch {
    return undefined;
  }

  try {
    const buffer = Buffer.alloc(MAX_METADATA_SCAN_BYTES);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as {
          type?: unknown;
          customType?: unknown;
          data?: unknown;
        };
        if (
          entry.type === "custom"
          && entry.customType === METADATA_ENTRY_TYPE
          && entry.data
          && typeof entry.data === "object"
          && !Array.isArray(entry.data)
        ) {
          return entry.data as Record<string, unknown>;
        }
      } catch {
        // A partial trailing line is expected when the bounded read ends mid-entry.
      }
    }
    return undefined;
  } finally {
    closeSync(fd);
  }
}
