import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body?.path;
    const content = body?.content;

    if (!path || typeof content !== "string") {
      return NextResponse.json({ error: "path and content are required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("memory_files")
      .upsert(
        { path, content, synced_at: new Date().toISOString() },
        { onConflict: "path" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
