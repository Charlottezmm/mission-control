import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface CronItem {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agent_id: string;
  last_run: string | null;
  next_run: string | null;
  payload: Record<string, any>;
}

function normalizeCron(raw: any): CronItem {
  // Gateway schedule format: { kind: "cron", expr: "0 9 * * *", tz: "..." }
  const sched = raw.schedule;
  const schedStr =
    typeof sched === "string"
      ? sched
      : sched?.expr || raw.cron || "* * * * *";

  return {
    id: String(raw.id || crypto.randomUUID()),
    name: raw.name || raw.label || raw.id || "Unnamed",
    schedule: schedStr,
    enabled: raw.enabled ?? raw.active ?? true,
    agent_id: raw.agentId || raw.agent_id || "main",
    last_run: raw.state?.lastRunAtMs
      ? new Date(raw.state.lastRunAtMs).toISOString()
      : null,
    next_run: raw.state?.nextRunAtMs
      ? new Date(raw.state.nextRunAtMs).toISOString()
      : null,
    // Store only what we need in payload (state info for the frontend)
    payload: {
      agentId: raw.agentId || raw.agent_id || "main",
      state: raw.state || null,
    },
  };
}

async function readCache(): Promise<CronItem[]> {
  const { data, error } = await supabaseAdmin
    .from("cron_sync")
    .select("*")
    .order("synced_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => {
    // Parse payload if it's a string
    let payload = row.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    return {
      id: row.id,
      name: row.name || "Unnamed",
      schedule: typeof row.schedule === "object" ? row.schedule?.expr || "—" : row.schedule || "—",
      enabled: row.enabled ?? true,
      agent_id: row.agent_id || payload?.agentId || "main",
      last_run: row.last_run,
      next_run: row.next_run,
      payload,
    };
  });
}

async function syncFromGateway(): Promise<CronItem[]> {
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
    // Delete old records first, then insert fresh data
    await supabaseAdmin.from("cron_sync").delete().neq("id", "");

    const upserts = normalized.map((j) => ({
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      enabled: j.enabled,
      last_run: j.last_run,
      next_run: j.next_run,
      payload: j.payload, // { agentId, state }
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("cron_sync")
      .upsert(upserts, { onConflict: "id" });
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
      } catch (e: any) {
        // Fall back to cache if gateway unreachable
        const cached = await readCache();
        return NextResponse.json({
          jobs: cached,
          source: "cache",
          fallback: true,
          syncError: e?.message,
        });
      }
    }

    const cached = await readCache();
    return NextResponse.json({ jobs: cached, source: "cache" });
  } catch (e: any) {
    return NextResponse.json(
      { jobs: [], error: e?.message || "failed" },
      { status: 500 }
    );
  }
}
