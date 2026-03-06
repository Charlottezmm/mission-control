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
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAwNjQsImV4cCI6MjA4ODI3NjA2NH0.kXedOrtBkcXVc5s01MRA2sxdc1yDmFFi8TTskeqs0J0";

const AGENTS: Record<string, { name: string; emoji: string }> = {
  main: { name: "Samantha", emoji: "🦐" },
  writer: { name: "Luna", emoji: "✍️" },
  marketing: { name: "Nova", emoji: "💡" },
  techlead: { name: "Beth", emoji: "🔧" },
  video: { name: "Pixel", emoji: "🎬" },
};

const FILTERS = ["all", "backlog", "in-progress", "done"] as const;
type Filter = (typeof FILTERS)[number];

type Priority = "high" | "medium" | "low";

const HDR = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

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
  return "backlog";
}

function daysUntil(ddl: string) {
  const due = new Date(ddl);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function ddlClass(ddl: string | null) {
  if (!ddl) return "bg-slate-100 text-slate-500 border-slate-200";
  const d = daysUntil(ddl);
  if (d <= 3) return "bg-red-100 text-red-700 border-red-200";
  if (d <= 7) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function dotClass(s?: string | null) {
  const n = normStatus(s);
  if (n === "done") return "bg-green-500";
  if (n === "in-progress") return "bg-blue-500";
  if (n === "blocked") return "bg-red-500";
  return "bg-slate-300";
}

function prioClass(p?: string | null) {
  if (p === "high") return "bg-red-50 text-red-700 border border-red-200";
  if (p === "low") return "bg-slate-100 text-slate-600 border border-slate-200";
  return "bg-blue-50 text-blue-700 border border-blue-200";
}

function nextPriority(priority?: string | null): Priority {
  if (priority === "high") return "medium";
  if (priority === "medium") return "low";
  return "high";
}

function parentStatus(children: Task[]): string {
  if (!children.length) return "backlog";
  const statuses = children.map((c) => normStatus(c.status));
  if (statuses.every((s) => s === "done")) return "done";
  if (statuses.some((s) => s === "in-progress" || s === "done")) return "in-progress";
  return "backlog";
}

function AssigneeStack({ ids }: { ids: string[] }) {
  const unique = Array.from(new Set(ids)).slice(0, 4);
  const extra = ids.length > 4 ? ids.length - 4 : 0;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex -space-x-1.5">
        {unique.map((id) => (
          <span
            key={id}
            title={AGENTS[id]?.name || id}
            className="w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-base shadow-sm"
          >
            {AGENTS[id]?.emoji || "🤖"}
          </span>
        ))}
        {extra > 0 && (
          <span className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600">
            +{extra}
          </span>
        )}
      </div>
      <span className="text-[10px] text-slate-400 leading-none">
        {unique.map((id) => AGENTS[id]?.name || id).join("·")}
        {extra > 0 ? `+${extra}` : ""}
      </span>
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400">
        {done}/{total}
      </span>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");

  const [subtaskForm, setSubtaskForm] = useState({ title: "", assignee: "main", ddl: "" });

  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assignee: "main", priority: "medium", ddl: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch(`${SUPABASE_BASE}?select=*&order=created_at.asc`, { headers: HDR, cache: "no-store" });
    const d = await r.json();
    setTasks(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    load();
    // Auto-refresh every 20s so cron-assigned tasks appear without manual reload
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
      setSubtaskForm({
        title: "",
        assignee: selectedTask.assignee || "main",
        ddl: "",
      });
    }
  }, [selectedTask?.id]);

  const patch = async (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    await fetch(`${SUPABASE_BASE}?id=eq.${id}`, {
      method: "PATCH",
      headers: HDR,
      body: JSON.stringify(updates),
    });
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

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f === "all" ? "全部" : f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            + 添加任务
          </button>
        </div>

        {weeklyDDL.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">⏰ 本周截止</h2>
            <div className="flex flex-wrap gap-3">
              {weeklyDDL.map((t) => {
                const agentKey = t.assignee && AGENTS[t.assignee] ? t.assignee : "main";
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`rounded-xl border p-4 text-left w-52 shadow-sm hover:shadow-md transition-shadow bg-white ${
                      selectedId === t.id ? "border-violet-400 ring-1 ring-violet-300" : "border-slate-200"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2">{t.title}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${ddlClass(t.ddl!)}`}>{t.ddl}</span>
                      <span className="text-lg">{AGENTS[agentKey]?.emoji}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">📋 所有任务</h2>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {visibleParents.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">暂无任务</div>}
            {visibleParents.map((parent) => {
              const children = childrenOf.get(parent.id) ?? [];
              const doneCount = children.filter((c) => normStatus(c.status) === "done").length;
              const childAssignees = Array.from(new Set(children.map((c) => c.assignee).filter(Boolean))) as string[];
              const { ddl } = parseDDL(parent.description || "");
              const autoStatus = children.length > 0 ? parentStatus(children) : normStatus(parent.status);
              const isSelected = selectedId === parent.id;

              return (
                <button
                  key={parent.id}
                  onClick={() => setSelectedId(parent.id)}
                  className={`w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                    isSelected ? "bg-violet-50" : ""
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass(autoStatus)}`} />

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-slate-800 ${autoStatus === "done" ? "opacity-50" : ""}`}>{parent.title}</p>
                    {children.length > 0 && <ProgressBar done={doneCount} total={children.length} />}
                  </div>

                  {childAssignees.length > 0 && <AssigneeStack ids={childAssignees} />}

                  {ddl && <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${ddlClass(ddl)}`}>{ddl}</span>}

                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${prioClass(parent.priority)}`}>
                    {parent.priority || "medium"}
                  </span>

                  <span
                    className="text-slate-300 hover:text-red-400 text-lg leading-none px-1 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      del(parent.id);
                    }}
                  >
                    ×
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedId(null)}>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-[720px] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedId(null)}
              className="absolute right-4 top-3 text-2xl leading-none text-slate-400 hover:text-slate-700"
            >
              ×
            </button>

            <div className="p-6 grid grid-cols-[55%_45%] gap-6">
              <div className="space-y-5">
                <div>
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
                      }}
                      className="w-full text-2xl font-semibold border-b-2 border-violet-400 outline-none bg-transparent"
                    />
                  ) : (
                    <h2
                      className="text-2xl font-semibold text-slate-800 cursor-pointer hover:text-violet-600"
                      onClick={() => setTitleEditing(true)}
                    >
                      {selectedTask.title}
                    </h2>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">描述</label>
                  <textarea
                    rows={6}
                    defaultValue={parseDDL(selectedTask.description || "").text}
                    onBlur={async (e) => {
                      const { ddl } = parseDDL(selectedTask.description || "");
                      await patch(selectedTask.id, { description: serializeDesc(ddl, e.target.value) });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white resize-y min-h-[120px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">子任务</h3>
                    <span className="text-xs text-slate-400">
                      {selectedChildren.filter((c) => normStatus(c.status) === "done").length}/{selectedChildren.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedChildren.map((child) => {
                      const isDone = normStatus(child.status) === "done";
                      const childDdl = parseDDL(child.description || "").ddl;
                      const isEditing = editingSubtaskId === child.id;

                      return (
                        <div
                          key={child.id}
                          className="group rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => patch(child.id, { status: isDone ? "backlog" : "done" })}
                              className={`mt-1 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                                isDone
                                  ? "bg-green-500 border-green-500"
                                  : "border-slate-300 hover:border-violet-400 bg-white"
                              }`}
                            />

                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={subtaskTitleDraft}
                                  onChange={(e) => setSubtaskTitleDraft(e.target.value)}
                                  onBlur={async () => {
                                    await patch(child.id, { title: subtaskTitleDraft.trim() || child.title });
                                    setEditingSubtaskId(null);
                                    setSubtaskTitleDraft("");
                                  }}
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter") {
                                      await patch(child.id, { title: subtaskTitleDraft.trim() || child.title });
                                      setEditingSubtaskId(null);
                                      setSubtaskTitleDraft("");
                                    }
                                    if (e.key === "Escape") {
                                      setEditingSubtaskId(null);
                                      setSubtaskTitleDraft("");
                                    }
                                  }}
                                  className="w-full text-sm font-medium border-b border-violet-400 outline-none bg-transparent"
                                />
                              ) : (
                                <button
                                  className={`text-left text-sm font-medium w-full ${
                                    isDone ? "line-through text-slate-400" : "text-slate-700"
                                  }`}
                                  onClick={() => {
                                    setEditingSubtaskId(child.id);
                                    setSubtaskTitleDraft(child.title);
                                  }}
                                >
                                  {child.title}
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => del(child.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-lg leading-none transition-opacity"
                            >
                              ×
                            </button>
                          </div>

                          <div className="flex items-center gap-2 pl-6">
                            <select
                              value={child.assignee || "main"}
                              onChange={(e) => patch(child.id, { assignee: e.target.value })}
                              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-600"
                            >
                              {Object.entries(AGENTS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.emoji} {v.name}
                                </option>
                              ))}
                            </select>

                            <input
                              type="date"
                              value={childDdl || ""}
                              onChange={async (e) => {
                                const { text } = parseDDL(child.description || "");
                                await patch(child.id, {
                                  description: serializeDesc(e.target.value || null, text),
                                });
                              }}
                              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white"
                            />

                            <button
                              onClick={() => patch(child.id, { priority: nextPriority(child.priority) })}
                              className={`text-[10px] px-2 py-1 rounded-md font-medium ${prioClass(child.priority)}`}
                              title="点击切换优先级"
                            >
                              {child.priority || "medium"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 space-y-2 bg-white">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                      <input
                        value={subtaskForm.title}
                        onChange={(e) => setSubtaskForm((prev) => ({ ...prev, title: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onAddSubtask();
                        }}
                        placeholder="子任务标题"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />

                      <select
                        value={subtaskForm.assignee}
                        onChange={(e) => setSubtaskForm((prev) => ({ ...prev, assignee: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                      >
                        {Object.entries(AGENTS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.emoji} {v.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={subtaskForm.ddl}
                        onChange={(e) => setSubtaskForm((prev) => ({ ...prev, ddl: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                      />

                      <button
                        onClick={onAddSubtask}
                        className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">状态</label>
                  <select
                    value={normStatus(selectedTask.status)}
                    onChange={(e) => patch(selectedTask.id, { status: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="backlog">backlog</option>
                    <option value="in-progress">in-progress</option>
                    <option value="done">done</option>
                    <option value="blocked">blocked</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">负责人</label>
                  <select
                    value={selectedTask.assignee || "main"}
                    onChange={(e) => patch(selectedTask.id, { assignee: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    {Object.entries(AGENTS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.emoji} {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">优先级</label>
                  <select
                    value={selectedTask.priority || "medium"}
                    onChange={(e) => patch(selectedTask.id, { priority: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">DDL</label>
                  <input
                    type="date"
                    value={parseDDL(selectedTask.description || "").ddl || ""}
                    onChange={async (e) => {
                      const { text } = parseDDL(selectedTask.description || "");
                      await patch(selectedTask.id, {
                        description: serializeDesc(e.target.value || null, text),
                      });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                  创建于 {new Date(selectedTask.created_at || "").toLocaleString("zh-CN")}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <form
            onSubmit={onAddTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-[440px] space-y-4"
          >
            <h2 className="text-lg font-semibold text-slate-800">添加任务</h2>
            <input
              required
              value={newTask.title}
              onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
              placeholder="任务标题 *"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">负责人</label>
                <select
                  value={newTask.assignee}
                  onChange={(e) => setNewTask((p) => ({ ...p, assignee: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {Object.entries(AGENTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.emoji} {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">优先级</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">DDL（可选）</label>
              <input
                type="date"
                value={newTask.ddl}
                onChange={(e) => setNewTask((p) => ({ ...p, ddl: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <textarea
              rows={2}
              value={newTask.description}
              onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
              placeholder="描述（可选）"
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none outline-none focus:border-violet-400"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? "创建中..." : "创建任务"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
