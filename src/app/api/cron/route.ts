import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CronItem = {
  id: string;
  name?: string;
  schedule?: string;
  enabled?: boolean;
  agent_id?: string;
  last_run?: string | null;
  next_run?: string | null;
  payload?: any;
};

function normalizeCron(raw: any): CronItem {
  return {
    id: String(raw.id || raw.name || raw.label || crypto.randomUUID()),
    name: raw.name || raw.label || raw.id || "Unnamed",
    schedule: raw.schedule || raw.cron || "* * * * *",
    enabled: raw.enabled ?? raw.active ?? true,
    agent_id: raw.agentId || raw.agent_id || null,
    last_run: raw.last_run || raw.lastRun || null,
    next_run: raw.next_run || raw.nextRun || null,
    payload: raw,
  };
}

async function readCache() {
  const { data, error } = await supabaseAdmin
    .from("cron_sync")
    .select("*")
    .order("synced_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function syncFromGateway() {
  const endpoints = [
    "http://localhost:18789/api/crons",
    "http://127.0.0.1:18789/api/crons",
  ];

  let list: any[] | null = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.jobs || json.data || [];
      if (Array.isArray(arr)) {
        list = arr;
        break;
      }
    } catch {}
  }

  if (!list) throw new Error("gateway_unreachable");

  const normalized = list.map(normalizeCron);
  if (normalized.length) {
    const upserts = normalized.map((j) => ({
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      enabled: j.enabled,
      last_run: j.last_run,
      next_run: j.next_run,
      payload: j.payload,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin.from("cron_sync").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }

  return normalized;
}

export async function GET(req: NextRequest) {
  const sync = req.nextUrl.searchParams.get("sync") === "1";

  try {
    if (sync) {
      try {
        const jobs = await syncFromGateway();
        return NextResponse.json({ jobs, source: "gateway" });
      } catch {
        const cached = await readCache();
        return NextResponse.json({ jobs: cached, source: "cache", fallback: true });
      }
    }

    const cached = await readCache();
    return NextResponse.json({ jobs: cached, source: "cache" });
  } catch (e: any) {
    return NextResponse.json({ jobs: [], error: e?.message || "failed" }, { status: 500 });
  }
}
