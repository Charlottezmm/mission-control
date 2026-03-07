import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://hkarpznjtrhehauvcphf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwMDA2NCwiZXhwIjoyMDg4Mjc2MDY0fQ.C_le0bRcZyA-pFDV3SOq4PxsyGouiVE2dg_ugvRa-kQ";
const VALID_AGENTS = ["main", "techlead", "writer", "marketing", "video"];

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent");
  if (!agentId || !VALID_AGENTS.includes(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/memory_files?path=eq.soul/${agentId}&select=content`,
    { headers, cache: "no-store" }
  );
  const data = await res.json();
  const content = data?.[0]?.content || "";
  return NextResponse.json({ agent: agentId, content });
}

export async function POST(req: NextRequest) {
  try {
    const { agent, content } = await req.json();
    if (!agent || !VALID_AGENTS.includes(agent)) {
      return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    }

    // Upsert to Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/memory_files?path=eq.soul/${agent}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ content, synced_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
