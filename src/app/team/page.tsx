"use client";

import { useState } from "react";
import { Sparkles, Wrench, PenTool, TrendingUp, Video, User, FileEdit, X, Save, Loader2 } from "lucide-react";

const AGENTS = [
  {
    id: "main",
    name: "Samantha 🦐",
    icon: Sparkles,
    role: "主控 / PM",
    model: "Claude Sonnet 4.6",
    color: "text-rose-500",
    bg: "bg-rose-50",
    border: "border-rose-200",
    description: "核心主控。管理任务、处理 Telegram、协调所有 agent。负责早晚报、情报推送、cron 调度。",
    tasks: ["任务分派 & 验收", "早晚报 & 情报推送", "跨 agent 协调", "Charlotte 直接请求处理"],
  },
  {
    id: "techlead",
    name: "Beth 🔧",
    icon: Wrench,
    role: "Tech Lead",
    model: "Codex 5.3",
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "技术负责人。架构设计、代码任务统筹、Flux iOS 开发、夜间自动开发循环。",
    tasks: ["Flux iOS 功能开发", "架构设计 & 代码审查", "夜间自动开发", "技术方案拆解"],
  },
  {
    id: "writer",
    name: "Luna ✍️",
    icon: PenTool,
    role: "Writer",
    model: "GLM-5",
    color: "text-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
    description: "内容创作专家。小红书长文、X/Twitter 推文，每日 4 篇自动发布。",
    tasks: ["小红书日更 4 篇", "X/Twitter 推文", "内容选题 & 优化", "文案撰写"],
  },
  {
    id: "marketing",
    name: "Nova 💡",
    icon: TrendingUp,
    role: "Marketing & Business",
    model: "Claude Sonnet 4.6",
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description: "商业化与增长。变现方案、市场调研、需求挖掘、AI 资讯情报扫描。",
    tasks: ["Flux 变现路径规划", "市场需求挖掘", "AI 资讯情报扫描", "增长策略"],
  },
  {
    id: "video",
    name: "Pixel 🎬",
    icon: Video,
    role: "Video Pipeline",
    model: "Codex 5.3",
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    description: "视频 Pipeline 执行。AI 漫剧视频全自动生成、Remotion 渲染、多平台批量发布。",
    tasks: ["Remotion 视频生成", "AI 漫剧 Pipeline", "多平台批量发布", "视频素材处理"],
  },
  {
    id: "charlotte",
    name: "Charlotte 👑",
    icon: User,
    role: "产品经理 & CEO",
    model: "Human",
    color: "text-violet-500",
    bg: "bg-violet-50",
    border: "border-violet-200",
    description: "产品方向、最终验收、战略决策。数学本科在读，目标硅谷 Robotics 硕士。",
    tasks: ["产品方向 & 验收", "Apple Developer 账号", "Flux 商业化决策", "Dalink"],
  },
];

export default function TeamPage() {
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [soulContent, setSoulContent] = useState("");
  const [soulLoading, setSoulLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const openEditor = async (agentId: string) => {
    if (agentId === "charlotte") return; // Charlotte doesn't have a SOUL.md
    setSoulLoading(true);
    setEditingAgent(agentId);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/soul?agent=${agentId}`);
      const data = await res.json();
      setSoulContent(data.content || "");
    } catch {
      setSoulContent("// 无法加载 SOUL.md");
    } finally {
      setSoulLoading(false);
    }
  };

  const saveSoul = async () => {
    if (!editingAgent) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: editingAgent, content: soulContent }),
      });
      if (res.ok) {
        setSaveMsg("✅ 已保存");
        setTimeout(() => setSaveMsg(""), 2000);
      } else {
        setSaveMsg("❌ 保存失败");
      }
    } catch {
      setSaveMsg("❌ 网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="px-4 md:px-8 pt-4 pb-3 bg-white border-b border-slate-100">
        <h1 className="text-lg font-semibold text-slate-900">👥 团队</h1>
        <p className="text-xs text-slate-400 mt-0.5">全女团队 · 6 members · 点击编辑 SOUL.md</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isAI = agent.id !== "charlotte";
            return (
              <div
                key={agent.id}
                className={`bg-white rounded-xl border ${agent.border} p-4 hover:shadow-md transition-all`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${agent.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${agent.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{agent.name}</h3>
                      <p className="text-[11px] text-slate-400">{agent.role} · {agent.model}</p>
                    </div>
                  </div>
                  {isAI && (
                    <button
                      onClick={() => openEditor(agent.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      title="编辑 SOUL.md"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{agent.description}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {agent.tasks.map((task) => (
                    <span
                      key={task}
                      className={`text-[10px] px-2 py-0.5 rounded-full ${agent.bg} ${agent.color} font-medium`}
                    >
                      {task}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SOUL.md Editor Modal ── */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditingAgent(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  编辑 SOUL.md — {AGENTS.find((a) => a.id === editingAgent)?.name}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">定义这个 agent 的性格、行为和工作方式</p>
              </div>
              <div className="flex items-center gap-2">
                {saveMsg && <span className="text-xs">{saveMsg}</span>}
                <button
                  onClick={saveSoul}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  保存
                </button>
                <button
                  onClick={() => setEditingAgent(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              {soulLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">加载中...</p>
                </div>
              ) : (
                <textarea
                  value={soulContent}
                  onChange={(e) => setSoulContent(e.target.value)}
                  className="w-full h-full min-h-[50vh] p-5 text-sm font-mono text-slate-700 bg-slate-50/50 resize-none outline-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
