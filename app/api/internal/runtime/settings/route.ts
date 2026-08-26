import { NextResponse } from "next/server";
import { readCommandOsSettings, writeCommandOsSettings } from "@/lib/command-os-settings";
import { invalidateModelsCache } from "@/lib/models-cache";

export function GET() {
  try {
    return NextResponse.json({ settings: readCommandOsSettings() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: errorCode(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as { settings?: unknown };
    const settings = await writeCommandOsSettings(body.settings);
    invalidateModelsCache();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: errorCode(error) }, { status: 400 });
  }
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]+$/.test(message) ? message : "PI_RUNTIME_SETTINGS_FAILED";
}
