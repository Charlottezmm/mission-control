import { NextResponse } from "next/server";

// 静态agent配置 — 与OpenClaw openclaw.json保持同步
const AGENTS = [
  {
    id: "main",
    name: "Samantha",
    emoji: "🦐",
    model: "claude-sonnet-4-5",
    platforms: ["telegram"],
  },
  {
    id: "writer",
    name: "Luna",
    emoji: "✍️",
    model: "glm-5",
    platforms: ["telegram"],
  },
  {
    id: "marketing",
    name: "Nova",
    emoji: "💡",
    model: "claude-sonnet-4-6",
    platforms: ["telegram"],
  },
  {
    id: "techlead",
    name: "Beth",
    emoji: "🔧",
    model: "gpt-5.3-codex",
    platforms: ["telegram"],
  },
  {
    id: "video",
    name: "Pixel",
    emoji: "🎬",
    model: "gpt-5.3-codex",
    platforms: ["telegram"],
  },
];

export async function GET() {
  return NextResponse.json({
    agents: AGENTS,
    gateway: {
      port: 18789,
      host: "localhost",
      token: "",
    },
    providers: [],
  });
}
