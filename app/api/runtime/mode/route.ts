import { NextResponse } from "next/server";
import { directorySelectionEnabled, isManagedMode, managedWorkspaceRoot } from "@/lib/managed-mode";

export function GET() {
  return NextResponse.json({
    managed: isManagedMode(),
    directorySelectionEnabled: directorySelectionEnabled(),
    workspaceRoot: isManagedMode() ? managedWorkspaceRoot() : null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
