"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

interface Task {
  id: string;
  title: string;
  status: string;
  assignee?: string | null;
  category?: string | null;
  priority?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  parent_id?: string | null;
}

const SUPABASE_BASE = "https://hkarpznjtrhehauvcphf.supabase.co/rest/v1/tasks";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAwNjQsImV4cCI6MjA4ODI3NjA2NH0.kXedOrtBkcXVc5s01MRA2sxdc1yDmFFi8TTskeqs0J0";

const AGENTS: Record<string, { name: string; emoji: string; color: string }> = {
  main: { name: "Samantha", emoji: "🦐", color: "bg-rose-100 text-rose-700 border-rose-200" },
  writer: { name: "Luna", emoji: "✍️", color: "bg-purple-100 text-purple-700 border-purple-200" },
  marketing: { name: "Nova", emoji: "💡", color: "bg-amber-100 text-amber-700 border-amber-200" },
  techlead: { name: "Beth", emoji: "🔧", color: "bg-blue-100 text-blue-700 border-blue-200" },
  video: { name: "Pixel", emoji: "🎬", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const ASSIGNEE_KEYS = Object.keys(AGENTS);

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  backlog: { label: "待办", dot: "bg-slate-300", pill: "bg-slate-100 text-slate-600" },
  "in-progress": { label: "进行中", dot: "bg-blue-500", pill: "bg-blue-50 text-blue-700" },
  done: { label: "完成", dot: "bg-green-500", pill: "bg-green-50 text-green-700" },
  blocked: { label: "阻塞", dot: "bg-red-500", pill: "bg-red-50 text-red-700" },
  "on-hold": { label: "暂缓", dot: "bg-yellow-500", pill: "bg-yellow-50 text-yellow-700" },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  high: { label: "高", dot: "bg-red-500", pill: "bg-red-50 text-red-600" },
  medium: { label: "中", dot: "bg-orange-400", pill: "bg-orange-50 text-orange-600" },
  low: { label: "低", dot: "bg-slate-400", pill: "bg-slate-50 text-slate-500" },
};

const FILTERS = ["all", "backlog", "in-progress", "done", "on-hold"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<string, string> = {
  all: "全部",
  backlog: "待办",
  "in-progress": "进行中",
  done: "完成",
  "on-hold": "暂缓",
};

const HDR = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/* ─── Utilities ─── */

function parseDDL(desc: string): { ddl: string | null; text: string } {
  const m = (desc || "").match(/DDL:(\d{4}-\d{2}-\d{2})\s*\|?\s*/);
  return m ? { ddl: m[1], text: desc.replace(m[0], "").trim() } : { ddl: null, text: desc || "" };
}

function serializeDesc(ddl: string | null, text: string): string {
  return ddl ? `DDL:${ddl} | ${text}` : text;
}

function normStatus(s?: string | null) {
  const v = (s || "backlog").toLowerCase();
  if (v.includes("progress") || v.includes("active")) return "in-progress";
  if (v.includes("done") || v.includes("complete")) return "done";
  if (v.includes("block")) return "blocked";
  if (v.includes("hold")) return "on-hold";
  return "backlog";
}

function daysUntil(ddl: string) {
  const due = new Date(ddl);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function ddlBadge(ddl: string | null) {
  if (!ddl) return { cls: "text-slate-400", text: "无DDL" };
  const d = daysUntil(ddl);
  if (d < 0) return { cls: "text-red-600 font-semibold", text: `已过期 ${-d}天` };
  if (d === 0) return { cls: "text-red-600 font-semibold", text: "今天截止" };
  if (d <= 3) return { cls: "text-red-500", text: `${d}天后` };
  if (d <= 7) return { cls: "text-orange-500", text: `${d}天后` };
  return { cls: "text-slate-500", text: ddl };
}

function nextPriority(p?: string | null): string {
  if (p === "high") return "medium";
  if (p === "medium") return "low";
  return "high";
}

function nextStatus(s?: string | null): string {
  const n = normStatus(s);
  if (n === "backlog") return "in-progress";
  if (n === "in-progress") return "done";
  if (n === "done") return "backlog";
  return "backlog";
}

function parentStatus(children: Task[]): string {
  if (!children.length) return "backlog";
  const ss = children.map((c) => normStatus(c.status));
  if (ss.every((s) => s === "done")) return "done";
  if (ss.some((s) => s === "in-progress" || s === "done")) return "in-progress";
  return "backlog";
}

/* ─── Sub-components ─── */

function AssigneeChip({ agentKey, size = "sm" }: { agentKey: string; size?: "sm" | "xs" }) {
  const a = AGENTS[agentKey] || AGENTS.main;
  const cls = size === "sm" ? "px-2 py-1 text-xs gap-1" : "px-1.5 py-0.5 text-[11px] gap-0.5";
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${a.color} ${cls}`}>
      <span>{a.emoji}</span>
      <span>{a.name}</span>
    </span>
  );
}

function StatusDot({ status, size = 8 }: { status?: string | null; size?: number }) {
  const cfg = STATUS_CONFIG[normStatus(status)] || STATUS_CONFIG.backlog;
  return <span className={`inline-block rounded-full flex-shrink-0 ${cfg.dot}`} style={{ width: size, height: size }} />;
}

function StatusPill({ status, onClick }: { status?: string | null; onClick?: () => void }) {
  const s = normStatus(status);
  const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.backlog;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:opacity-80 ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}

function PriorityPill({ priority, onClick }: { priority?: string | null; onClick?: () => void }) {
  const p = priority || "medium";
  const cfg = PRIORITY_CONFIG[p] || PRIORITY_CONFIG.medium;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:opacity-80 ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : "bg-violet-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-400 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

/* ─── Main ─── */

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");
  const [subtaskForm, setSubtaskForm] = useState({ title: "", assignee: "main", ddl: "" });
  const [showSubtaskAdd, setShowSubtaskAdd] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assignee: "main", priority: "medium", ddl: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"subtasks" | "description">("subtasks");

  const load = async () => {
    const r = await fetch(`${SUPABASE_BASE}?select=*&order=created_at.asc`, { headers: HDR, cache: "no-store" });
    const d = await r.json();
    setTasks(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, []);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const parents = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);

  const childrenOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.parent_id) {
        if (!m.has(t.parent_id)) m.set(t.parent_id, []);
        m.get(t.parent_id)!.push(t);
      }
    });
    return m;
  }, [tasks]);

  const selectedTask = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedChildren = selectedId ? childrenOf.get(selectedId) ?? [] : [];

  useEffect(() => {
    if (selectedTask) {
      setTitleDraft(selectedTask.title);
      setTitleEditing(false);
      setEditingSubtaskId(null);
      setSubtaskTitleDraft("");
      setShowSubtaskAdd(false);
      setActiveTab("subtasks");
      setSubtaskForm({ title: "", assignee: selectedTask.assignee || "main", ddl: "" });
    }
  }, [selectedTask?.id]);

  const patch = async (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    await fetch(`${SUPABASE_BASE}?id=eq.${id}`, { method: "PATCH", headers: HDR, body: JSON.stringify(updates) });
  };

  const del = async (id: string) => {
    if (!confirm("删除这个任务？")) return;
    await fetch(`${SUPABASE_BASE}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (selectedId === id) setSelectedId(null);
    await load();
  };

  const weeklyDDL = useMemo(() => {
    const all = filter === "all" ? tasks : tasks.filter((t) => normStatus(t.status) === filter);
    return all
      .map((t) => ({ ...t, ddl: parseDDL(t.description || "").ddl }))
      .filter((t) => t.ddl && daysUntil(t.ddl) >= 0 && daysUntil(t.ddl) <= 7)
      .sort((a, b) => daysUntil(a.ddl!) - daysUntil(b.ddl!));
  }, [tasks, filter]);

  const visibleParents = useMemo(() => {
    if (filter === "all") return parents;
    return parents.filter((p) => {
      const children = childrenOf.get(p.id) ?? [];
      const auto = parentStatus(children);
      return normStatus(p.status) === filter || auto === filter;
    });
  }, [parents, childrenOf, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: parents.length };
    for (const p of parents) {
      const children = childrenOf.get(p.id) ?? [];
      const s = children.length > 0 ? parentStatus(children) : normStatus(p.status);
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [parents, childrenOf]);

  const onAddSubtask = async () => {
    if (!selectedTask || !subtaskForm.title.trim()) return;
    await fetch(SUPABASE_BASE, {
      method: "POST",
      headers: HDR,
      body: JSON.stringify({
        title: subtaskForm.title.trim(),
        parent_id: selectedTask.id,
        assignee: subtaskForm.assignee,
        priority: "medium",
        status: "backlog",
        description: serializeDesc(subtaskForm.ddl || null, "") || null,
      }),
    });
    setSubtaskForm((prev) => ({ ...prev, title: "", ddl: "" }));
    await load();
  };

  const onAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      await fetch(SUPABASE_BASE, {
        method: "POST",
        headers: HDR,
        body: JSON.stringify({
          title: newTask.title.trim(),
          assignee: newTask.assignee,
          priority: newTask.priority,
          status: "backlog",
          description: serializeDesc(newTask.ddl || null, newTask.description) || null,
        }),
      });
      setShowAdd(false);
      setNewTask({ title: "", assignee: "main", priority: "medium", ddl: "", description: "" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto p-4 md:p-6">
        {/* ── Filters ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {FILTER_LABELS[f]}
                {(counts[f] ?? 0) > 0 && (
                  <span className={`ml-1.5 text-[10px] ${filter === f ? "text-violet-600" : "text-slate-400"}`}>
                    {counts[f]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
          >
            + 新项目
          </button>
        </div>

        {/* ── Weekly DDL ── */}
        {weeklyDDL.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>⏰</span> 本周截止
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {weeklyDDL.map((t) => {
                const badge = ddlBadge(t.ddl);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`rounded-xl border p-3 text-left w-48 transition-all hover:shadow-md bg-white ${
                      selectedId === t.id ? "border-violet-400 shadow-md shadow-violet-100" : "border-slate-200 shadow-sm"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">{t.title}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${badge.cls}`}>{badge.text}</span>
                      <AssigneeChip agentKey={t.assignee || "main"} size="xs" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Task List ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">📋 项目列表</h2>
          <div className="space-y-1.5">
            {visibleParents.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">暂无任务</div>}
            {visibleParents.map((parent) => {
              const children = childrenOf.get(parent.id) ?? [];
              const doneCount = children.filter((c) => normStatus(c.status) === "done").length;
              const autoStatus = children.length > 0 ? parentStatus(children) : normStatus(parent.status);
              const isSelected = selectedId === parent.id;
              const { ddl } = parseDDL(parent.description || "");
              const badge = ddlBadge(ddl);

              return (
                <button
                  key={parent.id}
                  onClick={() => setSelectedId(parent.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
                    isSelected
                      ? "border-violet-300 bg-violet-50/50 shadow-sm"
                      : "border-transparent bg-white hover:border-slate-200 hover:shadow-sm"
                  }`}
                >
                  <StatusDot status={autoStatus} size={10} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-sm font-medium ${autoStatus === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}
                      >
                        {parent.title}
                      </span>
                      <PriorityPill priority={parent.priority} />
                    </div>
                    {children.length > 0 && <ProgressBar done={doneCount} total={children.length} />}
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {ddl && <span className={`text-xs ${badge.cls}`}>{badge.text}</span>}
                    <AssigneeChip agentKey={parent.assignee || "main"} size="xs" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ════════ Task Detail Modal ════════ */}
      {selectedTask && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedId(null)}>
          <div
            className="relative bg-white w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal Header ── */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {titleEditing ? (
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={async () => {
                        await patch(selectedTask.id, { title: titleDraft.trim() || selectedTask.title });
                        setTitleEditing(false);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          await patch(selectedTask.id, { title: titleDraft.trim() || selectedTask.title });
                          setTitleEditing(false);
                        }
                        if (e.key === "Escape") setTitleEditing(false);
                      }}
                      className="w-full text-lg font-bold border-b-2 border-violet-400 outline-none bg-transparent pb-0.5"
                    />
                  ) : (
                    <h2
                      className="text-lg font-bold text-slate-900 cursor-pointer hover:text-violet-600 transition-colors"
                      onClick={() => setTitleEditing(true)}
                    >
                      {selectedTask.title}
                    </h2>
                  )}

                  {/* ── Property Pills Row ── */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <StatusPill
                      status={selectedTask.status}
                      onClick={() => patch(selectedTask.id, { status: nextStatus(selectedTask.status) })}
                    />
                    <PriorityPill
                      priority={selectedTask.priority}
                      onClick={() => patch(selectedTask.id, { priority: nextPriority(selectedTask.priority) })}
                    />

                    {/* Assignee selector */}
                    <div className="relative group">
                      <AssigneeChip agentKey={selectedTask.assignee || "main"} />
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-10 hidden group-hover:block min-w-[140px]">
                        {ASSIGNEE_KEYS.map((k) => (
                          <button
                            key={k}
                            onClick={() => patch(selectedTask.id, { assignee: k })}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2 ${
                              (selectedTask.assignee || "main") === k ? "font-semibold" : ""
                            }`}
                          >
                            <span>{AGENTS[k].emoji}</span>
                            <span>{AGENTS[k].name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="text-slate-300">·</span>

                    {/* DDL inline */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">📅</span>
                      <input
                        type="date"
                        value={parseDDL(selectedTask.description || "").ddl || ""}
                        onChange={async (e) => {
                          const { text } = parseDDL(selectedTask.description || "");
                          await patch(selectedTask.id, { description: serializeDesc(e.target.value || null, text) });
                        }}
                        className="text-xs text-slate-600 bg-transparent outline-none cursor-pointer hover:text-violet-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => del(selectedTask.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Modal Body ── */}
            <div className="flex-1 overflow-y-auto">
              {/* Tabs */}
              <div className="px-6 pt-3 flex gap-4 border-b border-slate-100">
                <button
                  onClick={() => setActiveTab("subtasks")}
                  className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "subtasks"
                      ? "border-violet-500 text-violet-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  子任务
                  <span className="ml-1.5 text-xs text-slate-400">
                    {selectedChildren.filter((c) => normStatus(c.status) === "done").length}/{selectedChildren.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("description")}
                  className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "description"
                      ? "border-violet-500 text-violet-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  描述
                </button>
              </div>

              <div className="p-6">
                {activeTab === "description" && (
                  <textarea
                    rows={8}
                    defaultValue={parseDDL(selectedTask.description || "").text}
                    placeholder="添加描述..."
                    onBlur={async (e) => {
                      const { ddl } = parseDDL(selectedTask.description || "");
                      await patch(selectedTask.id, { description: serializeDesc(ddl, e.target.value) });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50/50 resize-y min-h-[160px] outline-none focus:border-violet-300 focus:bg-white transition-colors placeholder:text-slate-300"
                  />
                )}

                {activeTab === "subtasks" && (
                  <div className="space-y-1.5">
                    {selectedChildren.length === 0 && !showSubtaskAdd && (
                      <div className="py-8 text-center">
                        <p className="text-slate-400 text-sm mb-3">还没有子任务</p>
                        <button
                          onClick={() => setShowSubtaskAdd(true)}
                          className="text-violet-600 text-sm font-medium hover:text-violet-700"
                        >
                          + 添加第一个子任务
                        </button>
                      </div>
                    )}

                    {selectedChildren.map((child) => {
                      const isDone = normStatus(child.status) === "done";
                      const childDdl = parseDDL(child.description || "").ddl;
                      const isEditing = editingSubtaskId === child.id;

                      return (
                        <div
                          key={child.id}
                          className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all hover:bg-slate-50 ${
                            isDone ? "opacity-50" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => patch(child.id, { status: isDone ? "backlog" : "done" })}
                            className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 transition-all flex items-center justify-center ${
                              isDone
                                ? "bg-green-500 border-green-500"
                                : "border-slate-300 hover:border-violet-400"
                            }`}
                          >
                            {isDone && (
                              <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-white">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input
                                autoFocus
                                value={subtaskTitleDraft}
                                onChange={(e) => setSubtaskTitleDraft(e.target.value)}
                                onBlur={async () => {
                                  await patch(child.id, { title: subtaskTitleDraft.trim() || child.title });
                                  setEditingSubtaskId(null);
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter") {
                                    await patch(child.id, { title: subtaskTitleDraft.trim() || child.title });
                                    setEditingSubtaskId(null);
                                  }
                                  if (e.key === "Escape") setEditingSubtaskId(null);
                                }}
                                className="w-full text-sm border-b border-violet-400 outline-none bg-transparent"
                              />
                            ) : (
                              <button
                                className={`text-left text-sm w-full truncate ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}
                                onClick={() => {
                                  setEditingSubtaskId(child.id);
                                  setSubtaskTitleDraft(child.title);
                                }}
                              >
                                {child.title}
                              </button>
                            )}
                          </div>

                          {/* Meta pills */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            {childDdl && (
                              <span className={`text-[11px] ${ddlBadge(childDdl).cls}`}>{ddlBadge(childDdl).text}</span>
                            )}
                            <AssigneeChip agentKey={child.assignee || "main"} size="xs" />
                            <PriorityPill
                              priority={child.priority}
                              onClick={() => patch(child.id, { priority: nextPriority(child.priority) })}
                            />
                            <button
                              onClick={() => del(child.id)}
                              className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Add subtask ── */}
                    {selectedChildren.length > 0 && !showSubtaskAdd && (
                      <button
                        onClick={() => setShowSubtaskAdd(true)}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-violet-600 hover:bg-violet-50/50 transition-colors"
                      >
                        + 添加子任务
                      </button>
                    )}

                    {showSubtaskAdd && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3.5 mt-2">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={subtaskForm.title}
                            onChange={(e) => setSubtaskForm((prev) => ({ ...prev, title: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && subtaskForm.title.trim()) onAddSubtask();
                              if (e.key === "Escape") setShowSubtaskAdd(false);
                            }}
                            placeholder="子任务标题..."
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400 bg-white"
                          />
                          <button
                            onClick={onAddSubtask}
                            disabled={!subtaskForm.title.trim()}
                            className="px-3.5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
                          >
                            添加
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          {/* Assignee selector for new subtask */}
                          <div className="flex gap-1">
                            {ASSIGNEE_KEYS.map((k) => (
                              <button
                                key={k}
                                onClick={() => setSubtaskForm((prev) => ({ ...prev, assignee: k }))}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${
                                  subtaskForm.assignee === k
                                    ? "bg-violet-100 ring-2 ring-violet-400 scale-110"
                                    : "bg-slate-100 hover:bg-slate-200"
                                }`}
                                title={AGENTS[k].name}
                              >
                                {AGENTS[k].emoji}
                              </button>
                            ))}
                          </div>
                          <input
                            type="date"
                            value={subtaskForm.ddl}
                            onChange={(e) => setSubtaskForm((prev) => ({ ...prev, ddl: e.target.value }))}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-violet-400"
                          />
                          <button
                            onClick={() => setShowSubtaskAdd(false)}
                            className="ml-auto text-xs text-slate-400 hover:text-slate-600"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Modal Footer ── */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                创建于 {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString("zh-CN") : "-"}
              </span>
              <span>
                更新于 {selectedTask.updated_at ? new Date(selectedTask.updated_at).toLocaleDateString("zh-CN") : "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Add Task Modal ════════ */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <form
            onSubmit={onAddTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-800">新建项目</h2>
              <input
                required
                autoFocus
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                placeholder="项目名称"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400"
              />

              <div className="flex flex-wrap gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">负责人</label>
                  <div className="flex gap-1">
                    {ASSIGNEE_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewTask((p) => ({ ...p, assignee: k }))}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                          newTask.assignee === k
                            ? "bg-violet-100 ring-2 ring-violet-400 scale-110"
                            : "bg-slate-100 hover:bg-slate-200"
                        }`}
                        title={AGENTS[k].name}
                      >
                        {AGENTS[k].emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ml-auto">
                  <label className="text-[11px] text-slate-400 mb-1 block">优先级</label>
                  <div className="flex gap-1">
                    {(["high", "medium", "low"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTask((prev) => ({ ...prev, priority: p }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          newTask.priority === p
                            ? PRIORITY_CONFIG[p].pill + " ring-1 ring-current"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {PRIORITY_CONFIG[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">DDL（可选）</label>
                <input
                  type="date"
                  value={newTask.ddl}
                  onChange={(e) => setNewTask((p) => ({ ...p, ddl: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-violet-400"
                />
              </div>

              <textarea
                rows={2}
                value={newTask.description}
                onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                placeholder="描述（可选）"
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none outline-none focus:border-violet-400 placeholder:text-slate-300"
              />
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "创建中..." : "创建"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
