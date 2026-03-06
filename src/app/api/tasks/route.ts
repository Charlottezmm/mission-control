import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizeStatus(status?: string) {
  const s = (status || "backlog").toLowerCase().replace(/_/g, "-");
  if (s.includes("progress") || s.includes("active")) return "in-progress";
  if (s.includes("done") || s.includes("complete")) return "done";
  return "backlog";
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const tasks = (data || []).map((t) => ({ ...t, status: normalizeStatus(t.status) }));
    return NextResponse.json({ tasks });
  } catch (e: any) {
    return NextResponse.json({ tasks: [], error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = {
      title: body?.title,
      status: normalizeStatus(body?.status),
      assignee: body?.assignee || null,
      category: body?.category || null,
      priority: body?.priority || null,
      description: body?.description || null,
      parent_id: body?.parent_id || null,
    };

    if (!payload.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const { data, error } = await supabase.from("tasks").insert(payload).select("*").single();
    if (error) throw error;

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = normalizeStatus(body.status);
    if (body.assignee !== undefined) updates.assignee = body.assignee || null;
    if (body.category !== undefined) updates.category = body.category || null;
    if (body.priority !== undefined) updates.priority = body.priority || null;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.parent_id !== undefined) updates.parent_id = body.parent_id || null;

    const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select("*").single();
    if (error) throw error;

    return NextResponse.json({ task: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
