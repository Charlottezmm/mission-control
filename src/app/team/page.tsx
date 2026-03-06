"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wrench, PenTool, TrendingUp, Video, User } from "lucide-react";

const agents = [
  {
    name: "Samantha 🦐",
    icon: Sparkles,
    role: "主控 / PM",
    model: "Claude Sonnet 4.5",
    status: "online",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    description: "核心主控。管理任务、处理 Telegram、协调所有 agent。负责早晚报、情报推送、cron 调度。",
    tasks: ["任务分派 & 验收", "早晚报 & 情报推送", "跨 agent 协调", "Charlotte 直接请求处理"],
  },
  {
    name: "Beth 🔧",
    icon: Wrench,
    role: "Tech Lead",
    model: "Codex 5.3",
    status: "idle",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    description: "技术负责人。架构设计、代码任务统筹、Flux iOS 开发、夜间自动开发循环。",
    tasks: ["Flux iOS 功能开发", "架构设计 & 代码审查", "夜间自动开发", "技术方案拆解"],
  },
  {
    name: "Luna ✍️",
    icon: PenTool,
    role: "Writer",
    model: "GLM-5",
    status: "idle",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    description: "内容创作专家。小红书长文、X/Twitter 推文，每日 4 篇自动发布。",
    tasks: ["小红书日更 4 篇", "X/Twitter 推文", "内容选题 & 优化", "文案撰写"],
  },
  {
    name: "Nova 💡",
    icon: TrendingUp,
    role: "Marketing & Business",
    model: "Claude Sonnet 4.6",
    status: "idle",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    description: "商业化与增长。变现方案、市场调研、需求挖掘、AI 资讯情报扫描。",
    tasks: ["Flux 变现路径规划", "市场需求挖掘", "AI 资讯情报扫描", "增长策略"],
  },
  {
    name: "Pixel 🎬",
    icon: Video,
    role: "Video Pipeline",
    model: "Codex 5.3",
    status: "idle",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    description: "视频 Pipeline 执行。AI 漫剧视频全自动生成、Remotion 渲染、多平台批量发布。",
    tasks: ["Remotion 视频生成", "AI 漫剧 Pipeline", "多平台批量发布", "视频素材处理"],
  },
  {
    name: "Charlotte 👑",
    icon: User,
    role: "产品经理 & CEO",
    model: "Human",
    status: "online",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    description: "产品方向、最终验收、战略决策。数学本科在读，目标硅谷 Robotics 硕士。",
    tasks: ["产品方向 & 验收", "Apple Developer 账号", "Flux 商业化决策", "人续 CRM"],
  },
];

const statusColor: Record<string, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-500",
};

export default function TeamPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">全女团队 · 6 members · Agent architecture</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.name} className="bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${agent.bgColor}`}>
                    <Icon className={`h-5 w-5 ${agent.color}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColor[agent.status]}`} />
                    <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{agent.role} · {agent.model}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tasks.map((task) => (
                    <Badge key={task} variant="secondary" className="text-xs">{task}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
