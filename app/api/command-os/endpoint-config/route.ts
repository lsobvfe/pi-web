import { NextResponse } from "next/server";
import {
  readCommandOsEndpointConfig,
  writeCommandOsEndpointConfig,
} from "@/lib/command-os-endpoint-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      settings: readCommandOsEndpointConfig(),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "PI_COMMAND_OS_ENDPOINT_CONFIG_INVALID" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as { settings?: unknown };
    if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
      return NextResponse.json({ error: "PI_COMMAND_OS_ENDPOINT_CONFIG_INVALID" }, { status: 400 });
    }
    writeCommandOsEndpointConfig(body.settings as Record<string, unknown>);
    return NextResponse.json({ settings: body.settings }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "PI_COMMAND_OS_ENDPOINT_CONFIG_WRITE_FAILED" }, { status: 500 });
  }
}
