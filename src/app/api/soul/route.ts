import { NextRequest, NextResponse } from "next/server";

const AGENT_WORKSPACES: Record<string, string> = {
  main: "/Users/charlottezmm/.openclaw/workspace-main/SOUL.md",
  techlead: "/Users/charlottezmm/.openclaw/workspace-techlead/SOUL.md",
  writer: "/Users/charlottezmm/.openclaw/workspace-writer/SOUL.md",
  marketing: "/Users/charlottezmm/.openclaw/workspace-marketing/SOUL.md",
  video: "/Users/charlottezmm/.openclaw/workspace-video/SOUL.md",
};

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent");
  if (!agentId || !AGENT_WORKSPACES[agentId]) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(AGENT_WORKSPACES[agentId], "utf-8");
    return NextResponse.json({ agent: agentId, content });
  } catch {
    return NextResponse.json({ agent: agentId, content: "" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agent, content } = await req.json();
    if (!agent || !AGENT_WORKSPACES[agent]) {
      return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    }
    const fs = await import("fs/promises");
    await fs.writeFile(AGENT_WORKSPACES[agent], content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
