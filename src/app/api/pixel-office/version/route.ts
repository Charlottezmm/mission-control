import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ tag: "1.0.0", url: "", publishedAt: new Date().toISOString() });
}
