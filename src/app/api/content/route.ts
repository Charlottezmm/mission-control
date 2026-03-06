import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("content_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = {
      title: body?.title,
      status: body?.status || "Ideas",
      platform: body?.platform || "xiaohongshu",
      body: body?.body || null,
      tags: Array.isArray(body?.tags) ? body.tags : [],
      updated_at: new Date().toISOString(),
    };

    if (!payload.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("content_items").insert(payload).select("*").single();
    if (error) throw error;

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
