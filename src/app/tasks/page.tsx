"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  X,
  Trash2,
  Check,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Clock,
  Circle,
  CheckCircle2,
  PauseCircle,
  Loader2,
  Flag,
  MessageSquare,
} from "lucide-react";

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

const AGENTS: Record<string, { name: string; emoji: string; color: string; bg: string; border: string; text: string }> = {
  main: { name: "Samantha", emoji: "🦐", color: "rose", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  writer: { name: "Luna", emoji: "✍️", color: "purple", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  marketing: { name: "Nova", emoji: "💡", color: "amber", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  techlead: { name: "Beth", emoji: "🔧", color: "blue", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  video: { name: "Pixel", emoji: "🎬", color: "emerald", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  charlotte: { name: "Charlotte", emoji: "👩", color: "violet", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
};

const ASSIGNEE_KEYS = ["main", "writer", "marketing", "techlead", "video", "charlotte"];

const STATUS_CFG: Record<string, { label: string; icon: typeof Circle; color: string; bg: string; text: string; border: string; bar: string }> = {
  backlog: { label: "待办", icon: Circle, color: "slate", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", bar: "bg-slate-300" },
  "in-progress": { label: "进行中", icon: Loader2, color: "blue", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", bar: "bg-blue-500" },
  done: { label: "完成", icon: CheckCircle2, color: "green", bg: "bg-green-50", text: "text-green-600", border: "border-green-200", bar: "bg-green-500" },
  blocked: { label: "阻塞", icon: AlertCircle, color: "red", bg: "bg-red-50", text: "text-red-600", border: "border-red-200", bar: "bg-red-500" },
  "on-hold": { label: "暂缓", icon: PauseCircle, color: "yellow", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", bar: "bg-yellow-500" },
};

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string; text: string; border: string }> = {
  high: { label: "紧急", color: "red", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  medium: { label: "中等", color: "orange", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  low: { label: "低", color: "slate", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
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
  if (d < 0) return { cls: "text-red-600 font-semibold", text: `已过期${-d}天` };
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
  const order = ["backlog", "in-progress", "done", "blocked", "on-hold"];
  const idx = order.indexOf(normStatus(s));
  return order[(idx + 1) % order.length];
}

function parentStatus(children: Task[]): string {
  if (!children.length) return "backlog";
  const ss = children.map((c) => normStatus(c.status));
  if (ss.every((s) => s === "done")) return "done";
  if (ss.some((s) => s === "in-progress" || s === "done")) return "in-progress";
  return "backlog";
}

/* ─── Status bar color for left accent ─── */
function statusBarColor(s: string): string {
  const cfg = STATUS_CFG[s];
  return cfg?.bar || "bg-slate-300";
}

/* ─── Main ─── */

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const [subtaskForm, setSubtaskForm] = useState({ title: "", assignee: "main", ddl: "" });
  const [showSubtaskAdd, setShowSubtaskAdd] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assignee: "main", priority: "medium", ddl: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"subtasks" | "description" | "activity">("subtasks");
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);

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
      setExpandedSubtaskId(null);
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
    <div className="h-full overflow-hidden bg-[#fafafa]">
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Tasks</h1>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新项目
            </button>
          </div>

          {/* ── Filter segment control ── */}
          <div className="mb-6">
            <div className="inline-flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`relative px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                    filter === f
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {FILTER_LABELS[f]}
                  {(counts[f] ?? 0) > 0 && (
                    <span className={`ml-1.5 text-[11px] tabular-nums ${filter === f ? "text-slate-500" : "text-slate-400"}`}>
                      {counts[f]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Task List ── */}
          <div className="space-y-[1px] rounded-xl border border-slate-200 bg-slate-200/50 overflow-hidden shadow-sm">
            {visibleParents.length === 0 && (
              <div className="py-16 text-center bg-white">
                <p className="text-slate-400 text-sm">暂无任务</p>
              </div>
            )}
            {visibleParents.map((parent) => {
              const children = childrenOf.get(parent.id) ?? [];
              const doneCount = children.filter((c) => normStatus(c.status) === "done").length;
              const autoStatus = children.length > 0 ? parentStatus(children) : normStatus(parent.status);
              const isSelected = selectedId === parent.id;
              const isHovered = hoveredParent === parent.id;
              const { ddl } = parseDDL(parent.description || "");
              const badge = ddlBadge(ddl);
              const pct = children.length === 0 ? 0 : Math.round((doneCount / children.length) * 100);
              const agent = AGENTS[parent.assignee || "main"] || AGENTS.main;

              return (
                <div
                  key={parent.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredParent(parent.id)}
                  onMouseLeave={() => setHoveredParent(null)}
                >
                  <button
                    onClick={() => setSelectedId(parent.id)}
                    className={`w-full text-left bg-white flex items-center h-[52px] transition-colors relative ${
                      isSelected ? "bg-slate-50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Left color accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusBarColor(autoStatus)} ${isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100"} transition-opacity`} />

                    <div className="flex items-center gap-3 w-full px-4 pl-5">
                      {/* Status icon */}
                      {(() => {
                        const cfg = STATUS_CFG[autoStatus] || STATUS_CFG.backlog;
                        const Icon = cfg.icon;
                        return <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.text}`} />;
                      })()}

                      {/* Title + progress */}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className={`text-[13px] font-medium truncate ${autoStatus === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {parent.title}
                        </span>
                        {children.length > 0 && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-16 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                              {doneCount}/{children.length}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right meta */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Priority flag */}
                        {parent.priority === "high" && <Flag className="w-3.5 h-3.5 text-red-400" />}

                        {/* DDL */}
                        {ddl && (
                          <span className={`text-[11px] ${badge.cls} whitespace-nowrap`}>{badge.text}</span>
                        )}

                        {/* Assignee avatars */}
                        {(() => {
                          const assignees = new Set<string>();
                          assignees.add(parent.assignee || "main");
                          children.forEach((c) => { if (c.assignee) assignees.add(c.assignee); });
                          const arr = Array.from(assignees).slice(0, 3);
                          return (
                            <div className="flex -space-x-1.5">
                              {arr.map((k) => {
                                const a = AGENTS[k] || AGENTS.main;
                                return (
                                  <span
                                    key={k}
                                    className={`w-6 h-6 rounded-full ${a.bg} border-2 border-white flex items-center justify-center text-xs`}
                                    title={a.name}
                                  >
                                    {a.emoji}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Delete button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            del(parent.id);
                          }}
                          className={`p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all ${isHovered ? "opacity-100" : "opacity-0"}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ════════ Task Detail Modal ════════ */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal Header ── */}
            <div className="px-6 pt-6 pb-4">
              {/* Close + delete */}
              <div className="flex items-center justify-end gap-1 mb-3">
                <button
                  onClick={() => del(selectedTask.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title */}
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
                  className="w-full text-xl font-bold border-none outline-none bg-transparent text-slate-900 placeholder:text-slate-300"
                />
              ) : (
                <h2
                  className="text-xl font-bold text-slate-900 cursor-text hover:text-slate-700 transition-colors leading-tight"
                  onClick={() => { setTitleEditing(true); setTitleDraft(selectedTask.title); }}
                >
                  {selectedTask.title}
                </h2>
              )}

              {/* ── Property Pills Row ── */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {/* Status pill */}
                <PropertyPill
                  options={Object.entries(STATUS_CFG).map(([k, v]) => ({ key: k, label: v.label, bg: v.bg, text: v.text, border: v.border }))}
                  current={normStatus(selectedTask.status)}
                  onChange={(v) => patch(selectedTask.id, { status: v })}
                  prefix={(() => {
                    const cfg = STATUS_CFG[normStatus(selectedTask.status)] || STATUS_CFG.backlog;
                    const Icon = cfg.icon;
                    return <Icon className="w-3.5 h-3.5" />;
                  })()}
                />

                {/* Priority pill */}
                <PropertyPill
                  options={Object.entries(PRIORITY_CFG).map(([k, v]) => ({ key: k, label: v.label, bg: v.bg, text: v.text, border: v.border }))}
                  current={selectedTask.priority || "medium"}
                  onChange={(v) => patch(selectedTask.id, { priority: v })}
                  prefix={<Flag className="w-3.5 h-3.5" />}
                />

                {/* Assignee pill */}
                <AssigneePill
                  current={selectedTask.assignee || "main"}
                  onChange={(v) => patch(selectedTask.id, { assignee: v })}
                />

                {/* DDL pill */}
                <DDLPill
                  description={selectedTask.description || ""}
                  onChange={async (newDdl) => {
                    const { text } = parseDDL(selectedTask.description || "");
                    await patch(selectedTask.id, { description: serializeDesc(newDdl, text) });
                  }}
                />
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="px-6 flex gap-0 border-b border-slate-100">
              {(["subtasks", "description", "activity"] as const).map((tab) => {
                const labels = { subtasks: "子任务", description: "描述", activity: "活动" };
                const icons = { subtasks: CheckCircle2, description: MessageSquare, activity: Clock };
                const Icon = icons[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {labels[tab]}
                    {tab === "subtasks" && selectedChildren.length > 0 && (
                      <span className="text-[11px] text-slate-400 ml-0.5 tabular-nums">
                        {selectedChildren.filter((c) => normStatus(c.status) === "done").length}/{selectedChildren.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Modal Body ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {activeTab === "description" && (
                  <textarea
                    rows={10}
                    defaultValue={parseDDL(selectedTask.description || "").text}
                    placeholder="添加描述..."
                    onBlur={async (e) => {
                      const { ddl } = parseDDL(selectedTask.description || "");
                      await patch(selectedTask.id, { description: serializeDesc(ddl, e.target.value) });
                    }}
                    className="w-full rounded-lg px-4 py-3 text-sm bg-slate-50 border border-slate-200 resize-y min-h-[200px] outline-none focus:border-slate-400 focus:bg-white transition-colors placeholder:text-slate-300"
                  />
                )}

                {activeTab === "activity" && (
                  <div className="space-y-0">
                    {/* Generate activity from task data */}
                    {[
                      ...(selectedTask.updated_at && selectedTask.updated_at !== selectedTask.created_at
                        ? [{ time: selectedTask.updated_at!, text: "任务信息已更新", icon: "✏️" }]
                        : []),
                      ...selectedChildren
                        .filter((c) => normStatus(c.status) === "done" && c.updated_at)
                        .map((c) => ({ time: c.updated_at!, text: `子任务「${c.title}」已完成`, icon: "✅" })),
                      ...selectedChildren
                        .filter((c) => normStatus(c.status) === "in-progress" && c.updated_at)
                        .map((c) => ({ time: c.updated_at!, text: `子任务「${c.title}」开始执行`, icon: "🔄" })),
                      { time: selectedTask.created_at!, text: "任务已创建", icon: "📌" },
                    ]
                      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                      .map((item, i) => (
                        <div key={i} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-b-0">
                          <span className="text-base mt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">{item.text}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(item.time).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    {selectedChildren.length === 0 && !selectedTask.updated_at && (
                      <div className="py-8 text-center">
                        <Clock className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">暂无活动</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "subtasks" && (
                  <div>
                    {selectedChildren.length === 0 && !showSubtaskAdd && (
                      <div className="py-12 text-center">
                        <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm mb-3">还没有子任务</p>
                        <button
                          onClick={() => setShowSubtaskAdd(true)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          添加子任务
                        </button>
                      </div>
                    )}

                    {selectedChildren.length > 0 && (
                      <div className="space-y-0">
                        {selectedChildren.map((child) => (
                          <SubtaskRow
                            key={child.id}
                            child={child}
                            isExpanded={expandedSubtaskId === child.id}
                            onToggleExpand={() =>
                              setExpandedSubtaskId(expandedSubtaskId === child.id ? null : child.id)
                            }
                            onPatch={patch}
                            onDelete={del}
                          />
                        ))}
                      </div>
                    )}

                    {/* Add subtask */}
                    {selectedChildren.length > 0 && !showSubtaskAdd && (
                      <button
                        onClick={() => setShowSubtaskAdd(true)}
                        className="flex items-center gap-1.5 mt-2 px-3 py-2 text-[13px] text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-50 w-full"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加子任务
                      </button>
                    )}

                    {showSubtaskAdd && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
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
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                          />
                          <button
                            onClick={onAddSubtask}
                            disabled={!subtaskForm.title.trim()}
                            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            添加
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex gap-1">
                            {ASSIGNEE_KEYS.map((k) => {
                              const a = AGENTS[k] || AGENTS.main;
                              return (
                                <button
                                  key={k}
                                  onClick={() => setSubtaskForm((prev) => ({ ...prev, assignee: k }))}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${
                                    subtaskForm.assignee === k
                                      ? `${a.bg} ring-2 ring-slate-400 scale-110`
                                      : "bg-white border border-slate-200 hover:border-slate-300"
                                  }`}
                                  title={a.name}
                                >
                                  {a.emoji}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            type="date"
                            value={subtaskForm.ddl}
                            onChange={(e) => setSubtaskForm((prev) => ({ ...prev, ddl: e.target.value }))}
                            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-slate-400"
                          />
                          <button
                            onClick={() => setShowSubtaskAdd(false)}
                            className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
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
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>创建 {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString("zh-CN") : "-"}</span>
              <span>更新 {selectedTask.updated_at ? new Date(selectedTask.updated_at).toLocaleDateString("zh-CN") : "-"}</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Add Task Modal ════════ */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 flex items-center justify-center p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onSubmit={onAddTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">新建项目</h2>

              <input
                required
                autoFocus
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                placeholder="项目名称"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300"
              />

              {/* Assignee */}
              <div>
                <label className="text-[12px] font-medium text-slate-500 mb-2 block">负责人</label>
                <div className="flex gap-1.5">
                  {ASSIGNEE_KEYS.map((k) => {
                    const a = AGENTS[k] || AGENTS.main;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewTask((p) => ({ ...p, assignee: k }))}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${
                          newTask.assignee === k
                            ? `${a.bg} ring-2 ring-slate-400 scale-110`
                            : "bg-slate-50 border border-slate-200 hover:border-slate-300"
                        }`}
                        title={a.name}
                      >
                        {a.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[12px] font-medium text-slate-500 mb-2 block">优先级</label>
                <div className="flex gap-1.5">
                  {(["high", "medium", "low"] as const).map((p) => {
                    const cfg = PRIORITY_CFG[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTask((prev) => ({ ...prev, priority: p }))}
                        className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all border ${
                          newTask.priority === p
                            ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DDL */}
              <div>
                <label className="text-[12px] font-medium text-slate-500 mb-2 block">截止日期</label>
                <input
                  type="date"
                  value={newTask.ddl}
                  onChange={(e) => setNewTask((p) => ({ ...p, ddl: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <textarea
                rows={2}
                value={newTask.description}
                onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                placeholder="描述（可选）"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm resize-none outline-none focus:border-slate-400 placeholder:text-slate-300 transition-colors"
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
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

/* ═══════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════ */

/* ── Property Pill (generic clickable pill with popover) ── */
function PropertyPill({
  options,
  current,
  onChange,
  prefix,
}: {
  options: { key: string; label: string; bg: string; text: string; border: string }[];
  current: string;
  onChange: (key: string) => void;
  prefix?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opt = options.find((o) => o.key === current) || options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all hover:shadow-sm ${opt.bg} ${opt.text} ${opt.border}`}
      >
        {prefix}
        {opt.label}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20 min-w-[120px]">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                o.key === current ? "font-semibold" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${o.bg.replace("50", "500").replace("bg-slate-50", "bg-slate-400")}`} />
              <span className={o.key === current ? o.text : "text-slate-600"}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Assignee Pill ── */
function AssigneePill({ current, onChange }: { current: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const agent = AGENTS[current] || AGENTS.main;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all hover:shadow-sm ${agent.bg} ${agent.text} ${agent.border}`}
      >
        <span>{agent.emoji}</span>
        {agent.name}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20 min-w-[140px]">
          {ASSIGNEE_KEYS.map((k) => {
            const a = AGENTS[k] || AGENTS.main;
            return (
              <button
                key={k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  k === current ? "font-semibold" : ""
                }`}
              >
                <span>{a.emoji}</span>
                <span className={k === current ? a.text : "text-slate-600"}>{a.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── DDL Pill ── */
function DDLPill({ description, onChange }: { description: string; onChange: (ddl: string | null) => void }) {
  const { ddl } = parseDDL(description);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all hover:shadow-sm ${
          ddl
            ? daysUntil(ddl) <= 3
              ? "bg-red-50 text-red-600 border-red-200"
              : daysUntil(ddl) <= 7
              ? "bg-orange-50 text-orange-600 border-orange-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
            : "bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:border-slate-400"
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {ddl || "设置DDL"}
      </button>
      {showPicker && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border border-slate-200 shadow-lg p-3">
          <input
            type="date"
            autoFocus
            value={ddl || ""}
            onChange={(e) => {
              onChange(e.target.value || null);
              setShowPicker(false);
            }}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
          />
          {ddl && (
            <button
              onClick={() => { onChange(null); setShowPicker(false); }}
              className="ml-2 text-xs text-red-500 hover:text-red-700"
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Subtask Row with inline expandable detail panel ── */
function SubtaskRow({
  child,
  isExpanded,
  onToggleExpand,
  onPatch,
  onDelete,
}: {
  child: Task;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPatch: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isDone = normStatus(child.status) === "done";
  const childDdl = parseDDL(child.description || "").ddl;

  return (
    <div className={`border-b border-slate-100 last:border-b-0 ${isExpanded ? "bg-slate-50/50" : ""}`}>
      {/* Main row */}
      <div className="group flex items-center gap-2.5 px-2 py-2.5 hover:bg-slate-50/80 transition-colors">
        {/* Checkbox with animation */}
        <button
          onClick={() => onPatch(child.id, { status: isDone ? "backlog" : "done" })}
          className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 transition-all duration-300 flex items-center justify-center ${
            isDone
              ? "bg-green-500 border-green-500 scale-100"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <Check className={`w-2.5 h-2.5 text-white transition-all duration-300 ${isDone ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} />
        </button>

        {/* Expand chevron */}
        <button onClick={onToggleExpand} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Title */}
        <button
          onClick={onToggleExpand}
          className={`flex-1 min-w-0 text-left text-[13px] truncate transition-colors ${
            isDone ? "line-through text-slate-400" : "text-slate-700 hover:text-slate-900"
          }`}
        >
          {child.title}
        </button>

        {/* Meta */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {childDdl && (
            <span className={`text-[11px] ${ddlBadge(childDdl).cls}`}>{ddlBadge(childDdl).text}</span>
          )}
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              (AGENTS[child.assignee || "main"] || AGENTS.main).bg
            }`}
            title={(AGENTS[child.assignee || "main"] || AGENTS.main).name}
          >
            {(AGENTS[child.assignee || "main"] || AGENTS.main).emoji}
          </span>
          <button
            onClick={() => onDelete(child.id)}
            className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Expanded inline detail panel ── */}
      {isExpanded && (
        <SubtaskDetailPanel child={child} onPatch={onPatch} />
      )}
    </div>
  );
}

/* ── Subtask Detail Panel (inline, not a modal) ── */
function SubtaskDetailPanel({
  child,
  onPatch,
}: {
  child: Task;
  onPatch: (id: string, updates: Partial<Task>) => Promise<void>;
}) {
  const [localTitle, setLocalTitle] = useState(child.title);
  const { ddl, text: descText } = parseDDL(child.description || "");
  const [localDesc, setLocalDesc] = useState(descText);

  useEffect(() => {
    setLocalTitle(child.title);
    const parsed = parseDDL(child.description || "");
    setLocalDesc(parsed.text);
  }, [child.id, child.title, child.description]);

  return (
    <div className="px-10 pb-4 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
      {/* Editable title */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={() => {
          if (localTitle.trim() && localTitle !== child.title)
            onPatch(child.id, { title: localTitle.trim() });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full text-sm font-medium bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 transition-colors"
      />

      {/* Property pills row */}
      <div className="flex flex-wrap items-center gap-2">
        <PropertyPill
          options={Object.entries(STATUS_CFG).map(([k, v]) => ({ key: k, label: v.label, bg: v.bg, text: v.text, border: v.border }))}
          current={normStatus(child.status)}
          onChange={(v) => onPatch(child.id, { status: v })}
          prefix={(() => {
            const cfg = STATUS_CFG[normStatus(child.status)] || STATUS_CFG.backlog;
            const Icon = cfg.icon;
            return <Icon className="w-3 h-3" />;
          })()}
        />
        <PropertyPill
          options={Object.entries(PRIORITY_CFG).map(([k, v]) => ({ key: k, label: v.label, bg: v.bg, text: v.text, border: v.border }))}
          current={child.priority || "medium"}
          onChange={(v) => onPatch(child.id, { priority: v })}
          prefix={<Flag className="w-3 h-3" />}
        />
        <AssigneePill
          current={child.assignee || "main"}
          onChange={(v) => onPatch(child.id, { assignee: v })}
        />
        <DDLPill
          description={child.description || ""}
          onChange={async (newDdl) => {
            await onPatch(child.id, { description: serializeDesc(newDdl, localDesc) });
          }}
        />
      </div>

      {/* Description */}
      <textarea
        rows={3}
        value={localDesc}
        onChange={(e) => setLocalDesc(e.target.value)}
        onBlur={() => {
          const { ddl: currentDdl } = parseDDL(child.description || "");
          onPatch(child.id, { description: serializeDesc(currentDdl, localDesc) });
        }}
        placeholder="添加描述..."
        className="w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 resize-none outline-none focus:border-slate-400 transition-colors placeholder:text-slate-300"
      />
    </div>
  );
}
