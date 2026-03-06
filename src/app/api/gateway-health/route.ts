import { NextResponse } from "next/server";

// Mock gateway health - always returns healthy for Mission Control
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    responseMs: 12,
    version: "mission-control",
    uptime: Date.now(),
  });
}
