"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CronJob {
  id?: string;
  name?: string;
  label?: string;
  schedule?: string;
  cron?: string;
  enabled?: boolean;
  active?: boolean;
  nextRun?: string;
  lastRun?: string;
}

function parseCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (min === "*" && hour === "*") return "Every minute";
  if (hour === "*") return `Every hour at :${min.padStart(2, "0")}`;
  if (dom === "*" && mon === "*" && dow === "*") return `Daily at ${hour}:${min.padStart(2, "0")}`;
  if (dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[+dow] || dow} at ${hour}:${min.padStart(2, "0")}`;
  }
  return cron;
}

function getHour(job: CronJob): number {
  const cron = job.schedule || job.cron || "";
  const parts = cron.split(" ");
  if (parts.length >= 2 && parts[1] !== "*") return parseInt(parts[1]) || 0;
  return -1;
}

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = async (withSync = false) => {
    const url = withSync ? "/api/cron?sync=1" : "/api/cron";
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.jobs || [];
    setJobs(list);
  };

  useEffect(() => {
    load(false).catch(() => {});
  }, []);

  const onSync = async () => {
    setSyncing(true);
    try {
      await load(true);
    } finally {
      setSyncing(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const jobsByHour = new Map<number, CronJob[]>();
  jobs.forEach((j) => {
    const h = getHour(j);
    if (!jobsByHour.has(h)) jobsByHour.set(h, []);
    jobsByHour.get(h)!.push(j);
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">{jobs.length} cron jobs scheduled</p>
        </div>
        <Button onClick={onSync} disabled={syncing}>
          {syncing ? "同步中..." : "同步"}
        </Button>
      </div>

      <div className="space-y-1">
        {hours.map((h) => {
          const hjobs = jobsByHour.get(h) || [];
          if (hjobs.length === 0 && !jobsByHour.has(h)) return null;
          return (
            <div key={h} className="flex gap-4 items-start">
              <div className="w-16 text-right text-xs text-muted-foreground pt-2 shrink-0">
                {h.toString().padStart(2, "0")}:00
              </div>
              <div className="flex-1 border-l border-border pl-4 py-1 min-h-[2rem]">
                {hjobs.length > 0 ? (
                  <div className="space-y-2">
                    {hjobs.map((job, i) => (
                      <Card key={i} className="bg-card/60">
                        <CardContent className="p-3 flex items-center gap-3">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.name || job.label || job.id || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{parseCron(job.schedule || job.cron || "")}</p>
                          </div>
                          <Badge variant={(job.enabled ?? job.active ?? true) ? "default" : "secondary"} className="text-xs shrink-0">
                            {(job.enabled ?? job.active ?? true) ? "active" : "paused"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {jobsByHour.has(-1) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Recurring / Variable Schedule
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(jobsByHour.get(-1) || []).map((job, i) => (
              <Card key={i} className="bg-card/60">
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{job.name || job.label || job.id || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{job.schedule || job.cron}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && <p className="text-muted-foreground text-sm">No cron jobs found. Try 同步 first.</p>}
    </div>
  );
}
