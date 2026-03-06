import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type MemoryRow = { path: string; content: string; synced_at?: string };

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const search = req.nextUrl.searchParams.get("search");

  if (file) {
    const { data, error } = await supabaseAdmin
      .from("memory_files")
      .select("path,content")
      .eq("path", file)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ file, content: data.content });
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

  const { data, error } = await supabaseAdmin.from("memory_files").select("path").order("path", { ascending: true });
  if (error) return NextResponse.json({ files: [], error: error.message }, { status: 500 });

  const files = (data || []).map((f: any) => {
    const path = f.path as string;
    const name = path.split("/").pop() || path;
    return { path, name, isDir: false };
  });

  return NextResponse.json({ files });
}
