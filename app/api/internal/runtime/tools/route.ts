import { NextResponse } from "next/server";
import { listRuntimeTools } from "@/lib/internal-runtime";

export async function GET() {
  try {
    return NextResponse.json({ tools: await listRuntimeTools() }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("[pi-web] failed to load managed runtime tools", error);
    return NextResponse.json({ error: "PI_RUNTIME_TOOLS_FAILED" }, { status: 500 });
  }
}
