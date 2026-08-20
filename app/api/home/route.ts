import { NextResponse } from "next/server";
import { homedir } from "os";
import { isManagedMode } from "@/lib/managed-mode";

export async function GET() {
  return NextResponse.json({ home: isManagedMode() ? null : homedir() });
}
