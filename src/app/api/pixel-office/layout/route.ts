import { NextResponse } from "next/server";

const SUPABASE_URL = "https://hkarpznjtrhehauvcphf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwMDA2NCwiZXhwIjoyMDg4Mjc2MDY0fQ.C_le0bRcZyA-pFDV3SOq4PxsyGouiVE2dg_ugvRa-kQ";

export async function GET() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/office_layout?id=eq.default&select=layout`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    const rows = await res.json();
    if (!rows || rows.length === 0 || !rows[0]?.layout || Object.keys(rows[0].layout).length === 0) {
      return NextResponse.json(null);
    }
    return NextResponse.json(rows[0].layout);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(req: Request) {
  try {
    const layout = await req.json();
    await fetch(`${SUPABASE_URL}/rest/v1/office_layout?id=eq.default`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ layout, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
