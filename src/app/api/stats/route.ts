import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeStatus(status?: string) {
  const s = (status || "backlog").toLowerCase().replace(/_/g, "-");
  if (s.includes("progress") || s.includes("active")) return "in-progress";
  if (s.includes("done") || s.includes("complete")) return "done";
  return "backlog";
}

export async function GET() {
  const tasks = { total: 0, inProgress: 0, done: 0 };
  const cron = { total: 0 };
  const content = { total: 0 };
  const memory = { files: 0 };

  try {
    const { data, error } = await supabase.from("tasks").select("status");
    if (!error) {
      const list = data || [];
      tasks.total = list.length;
      tasks.inProgress = list.filter((t: any) => normalizeStatus(t.status) === "in-progress").length;
      tasks.done = list.filter((t: any) => normalizeStatus(t.status) === "done").length;
    }
  } catch {}

  try {
    const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
      supabaseAdmin.from("cron_sync").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("content_items").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("memory_files").select("path", { count: "exact", head: true }),
    ]);
    cron.total = c1 || 0;
    content.total = c2 || 0;
    memory.files = c3 || 0;
  } catch {}

  return NextResponse.json({ tasks, cron, memory, content });
}
