"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanSquare, FileText, Calendar, Brain, Users, Activity } from "lucide-react";

interface Stats {
  tasks: { total: number; inProgress: number; done: number };
  cron: { total: number };
  memory: { files: number };
  content: { total: number };
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    { title: "Tasks", icon: KanbanSquare, value: stats ? `${stats.tasks.inProgress} active / ${stats.tasks.total} total` : "...", color: "text-blue-400" },
    { title: "Content", icon: FileText, value: stats ? `${stats.content.total} items` : "...", color: "text-green-400" },
    { title: "Cron Jobs", icon: Calendar, value: stats ? `${stats.cron.total} scheduled` : "...", color: "text-yellow-400" },
    { title: "Memory Files", icon: Brain, value: stats ? `${stats.memory.files} files` : "...", color: "text-purple-400" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
        <p className="text-muted-foreground mt-1">Welcome back, Charlotte ✨</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ title, icon: Icon, value, color }) => (
          <Card key={title} className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Samantha 🦐", role: "主控 / PM", status: "online" },
              { name: "Beth 🔧", role: "Tech Lead", status: "idle" },
              { name: "Luna ✍️", role: "Writer", status: "idle" },
              { name: "Nova 💡", role: "Marketing", status: "idle" },
              { name: "Pixel 🎬", role: "Video Pipeline", status: "idle" },
              { name: "Charlotte 👑", role: "CEO", status: "online" },
            ].map((a) => (
              <div key={a.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${a.status === "online" ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.role}</p>
                  </div>
                </div>
                <Badge variant={a.status === "online" ? "default" : "secondary"} className="text-xs">
                  {a.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Tasks board → manage backlog & priorities</p>
            <p>• Content pipeline → track 小红书/X posts</p>
            <p>• Calendar → view cron schedules</p>
            <p>• Memory → search agent memory files</p>
            <p>• Office → see the team at work 🏢</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
