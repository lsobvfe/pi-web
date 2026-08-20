import { NextResponse } from "next/server";
import { SessionManager, createAgentSessionFromServices, createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";
import { assertRuntimeWorkspaceCwd, isManagedMode } from "@/lib/managed-mode";
import { projectTrustReloadOptions } from "@/lib/project-trust";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestedCwd = new URL(req.url).searchParams.get("cwd") || "/mnt/project";
  try {
    const cwd = isManagedMode() ? assertRuntimeWorkspaceCwd(requestedCwd) : resolve(requestedCwd);
    const services = await createAgentSessionServices({
      cwd,
      agentDir: getAgentDir(),
      ...(projectTrustReloadOptions(cwd, getAgentDir())
        ? { resourceLoaderReloadOptions: projectTrustReloadOptions(cwd, getAgentDir()) }
        : {}),
    });
    const manager = SessionManager.create(cwd);
    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager: manager,
    });
    const tools = session.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
    session.dispose();
    return NextResponse.json({ tools });
  } catch {
    return NextResponse.json({ error: "PI_TOOLS_UNAVAILABLE" }, { status: 503 });
  }
}
