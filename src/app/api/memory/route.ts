import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type MemoryRow = { path: string; content: string; synced_at?: string };

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const search = req.nextUrl.searchParams.get("search");

  if (file) {
    const { data, error } = await supabaseAdmin
      .from("memory_files")
      .select("path,content,synced_at")
      .eq("path", file)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ file, content: data.content, synced_at: data.synced_at });
  }

  if (search) {
    const query = search.toLowerCase();
    const { data, error } = await supabaseAdmin.from("memory_files").select("path,content");
    if (error) return NextResponse.json({ results: [], error: error.message }, { status: 500 });

    const results: { file: string; line: string; lineNum: number }[] = [];
    for (const row of (data || []) as MemoryRow[]) {
      const lines = (row.content || "").split("\n");
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(query)) {
          results.push({ file: row.path, line: line.trim().slice(0, 200), lineNum: i + 1 });
        }
      });
    }

    return NextResponse.json({ results: results.slice(0, 200) });
  }

  const { data, error } = await supabaseAdmin
    .from("memory_files")
    .select("path,synced_at")
    .order("path", { ascending: true });
  if (error) return NextResponse.json({ files: [], error: error.message }, { status: 500 });

  const files = (data || []).map((f: any) => {
    const path = f.path as string;
    const name = path.split("/").pop() || path;
    return { path, name, isDir: false, synced_at: f.synced_at };
  });

  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  try {
    const { path, content } = await req.json();
    if (!path || typeof content !== "string") {
      return NextResponse.json({ error: "path and content required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("memory_files")
      .upsert({ path, content, synced_at: new Date().toISOString() }, { onConflict: "path" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
