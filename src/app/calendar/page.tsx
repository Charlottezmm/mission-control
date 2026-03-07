"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agent_id: string;
  state?: {
    lastStatus?: string;
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
  };
}

function parseCron(cron: string): string {
  if (!cron || typeof cron !== "string") return "—";
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, , , dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hourParts = hour.split(",");
  const times = hourParts.map((h) => `${h.padStart(2, "0")}:${min.padStart(2, "0")}`);
  const timeStr = times.join(" / ");
  if (dow !== "*") {
    const dayNames = dow.split(",").map((d) => days[+d] || d).join(",");
    return `每周${dayNames} ${timeStr}`;
  }
  return `每天 ${timeStr}`;
}

const AGENT_META: Record<string, { label: string; color: string; dot: string }> = {
  main:      { label: "Samantha 🦐", color: "bg-violet-500/10 border-violet-500/30", dot: "bg-violet-500" },
  writer:    { label: "Luna ✍️",     color: "bg-pink-500/10 border-pink-500/30",     dot: "bg-pink-500" },
  marketing: { label: "Nova 💡",     color: "bg-orange-500/10 border-orange-500/30", dot: "bg-orange-500" },
  techlead:  { label: "Beth 🔧",     color: "bg-blue-500/10 border-blue-500/30",     dot: "bg-blue-500" },
  video:     { label: "Pixel 🎬",    color: "bg-green-500/10 border-green-500/30",   dot: "bg-green-500" },
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function nextRunIn(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return "已过期";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "即将运行";
  if (m < 60) return `${m}分钟后`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时后`;
  return `${Math.floor(h / 24)}天后`;
}

function JobCard({ job }: { job: CronJob }) {
  const active = job.enabled;
  const lastStatus = job.state?.lastStatus;
  const hasError = (job.state?.consecutiveErrors ?? 0) > 0;

  let statusDot = "bg-slate-500";
  if (!active) statusDot = "bg-slate-600";
  else if (hasError) statusDot = "bg-red-500 animate-pulse";
  else if (lastStatus === "ok") statusDot = "bg-emerald-500";
  else statusDot = "bg-yellow-500";

  return (
    <div className={`rounded-lg border p-3.5 space-y-2 ${active ? "bg-card" : "bg-muted/20 opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{job.name}</p>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${statusDot}`} title={lastStatus || "unknown"} />
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        {parseCron(job.schedule)}
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {job.state?.lastRunAtMs && (
          <span>上次: {timeAgo(job.state.lastRunAtMs)}</span>
        )}
        {job.state?.nextRunAtMs && (
          <span>下次: {nextRunIn(job.state.nextRunAtMs)}</span>
        )}
      </div>
      {hasError && (
        <p className="text-xs text-red-400">
          ⚠ {job.state?.consecutiveErrors}次连续失败
          {job.state?.lastError && <span className="block truncate opacity-70">{job.state.lastError}</span>}
        </p>
      )}
      {!active && <Badge variant="secondary" className="text-xs">已暂停</Badge>}
    </div>
  );
}

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/cron", { cache: "no-store" });
      const data = await r.json();
      if (data.error) setError(data.error);
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Group by agent_id
  const grouped: Record<string, CronJob[]> = {};
  jobs.forEach((j) => {
    const key = j.agent_id || "main";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(j);
  });

  // Sort jobs in each group by first hour
  const getHour = (j: CronJob) => {
    const parts = (j.schedule || "").split(" ");
    return parts.length >= 2 && parts[1] !== "*" ? parseInt(parts[1].split(",")[0]) || 0 : 99;
  };
  Object.values(grouped).forEach((g) => g.sort((a, b) => getHour(a) - getHour(b)));

  const agentOrder = ["main", "techlead", "writer", "marketing", "video"];
  const sortedKeys = [
    ...agentOrder.filter((k) => grouped[k]),
    ...Object.keys(grouped).filter((k) => !agentOrder.includes(k)),
  ];

  // Stats
  const activeCount = jobs.filter((j) => j.enabled).length;
  const errorCount = jobs.filter((j) => (j.state?.consecutiveErrors ?? 0) > 0).length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs.length} 个定时任务 · {activeCount} 活跃
            {errorCount > 0 && <span className="text-red-400 ml-1">· {errorCount} 报错</span>}
          </p>
        </div>
        <Button onClick={load} disabled={loading} size="sm" variant="outline">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "加载中..." : "刷新"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          ⚠ {error}
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">暂无任务。</p>
      )}

      <div className="space-y-8">
        {sortedKeys.map((key) => {
          const meta = AGENT_META[key] || { label: key, color: "bg-slate-500/10 border-slate-500/30", dot: "bg-slate-500" };
          const groupJobs = grouped[key];
          const groupErrors = groupJobs.filter((j) => (j.state?.consecutiveErrors ?? 0) > 0).length;
          return (
            <section key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-xs text-muted-foreground">({groupJobs.length})</span>
                {groupErrors > 0 && (
                  <span className="text-xs text-red-400">⚠ {groupErrors}</span>
                )}
              </div>
              <div className={`rounded-xl border p-4 ${meta.color}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {groupJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
