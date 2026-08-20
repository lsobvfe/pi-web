import { NextResponse } from "next/server";
import {
  attachSessionProjectInfo,
  listAllSessions,
  mergeSessionLists,
} from "@/lib/session-reader";
import { getRpcSessionInfos, getRunningRpcSessionIds } from "@/lib/rpc-manager";
import { listTrashedSessionFiles } from "@/lib/session-lifecycle";
import { readSessionHeader } from "@/lib/session-reader";
import { statSync } from "node:fs";
import { publicManagedPath } from "@/lib/managed-mode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const [persistedSessions, runtimeSessions] = await Promise.all([
      listAllSessions({ force }),
      attachSessionProjectInfo(getRpcSessionInfos()),
    ]);
    const sessions = mergeSessionLists(persistedSessions, runtimeSessions);
    const includeDeleted = new URL(req.url).searchParams.get("includeDeleted") === "1";
    if (includeDeleted) {
      for (const path of listTrashedSessionFiles()) {
        const header = readSessionHeader(path);
        if (!header || sessions.some((session) => session.id === header.id)) continue;
        let modified = header.timestamp;
        try { modified = statSync(path).mtime.toISOString(); } catch { /* header is authoritative */ }
        sessions.push({
          path: publicManagedPath(path),
          id: header.id,
          cwd: header.cwd,
          created: header.timestamp,
          modified,
          messageCount: 0,
          firstMessage: "(deleted session)",
          transient: false,
          metadata: undefined,
        });
      }
      sessions.sort((a, b) => b.modified.localeCompare(a.modified));
    }
    return NextResponse.json(
      { sessions, runningSessionIds: getRunningRpcSessionIds() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
