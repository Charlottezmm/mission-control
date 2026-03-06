"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface TaskNode extends Task {
  children: TaskNode[];
}

const SUPABASE_BASE = "https://hkarpznjtrhehauvcphf.supabase.co/rest/v1/tasks";
const SUPABASE_LIST_URL = `${SUPABASE_BASE}?select=*&order=created_at.asc`;
const SUPABASE_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXJwem5qdHJoZWhhdXZjcGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAwNjQsImV4cCI6MjA4ODI3NjA2NH0.kXedOrtBkcXVc5s01MRA2sxdc1yDmFFi8TTskeqs0J0";

const AGENTS = {
  main: { name: "Samantha", emoji: "🦐" },
  writer: { name: "Luna", emoji: "✍️" },
  marketing: { name: "Nova", emoji: "💡" },
  techlead: { name: "Beth", emoji: "🔧" },
  video: { name: "Pixel", emoji: "🎬" },
} as const;

type AgentKey = keyof typeof AGENTS;
const FILTERS = ["all", "backlog", "in-progress", "done"] as const;

function parseDDL(desc: string): { ddl: string | null; text: string } {
  const m = (desc || '').match(/DDL:(\d{4}-\d{2}-\d{2})\s*\|?\s*/)
  return m ? { ddl: m[1], text: desc.replace(m[0], '').trim() } : { ddl: null, text: desc || '' }
}

function serializeDesc(ddl: string | null, text: string): string {
  return ddl ? `DDL:${ddl} | ${text}` : text;
}

function normalizeStatus(status?: string | null) {
  const s = (status || "backlog").toLowerCase().replace(/_/g, "-");
  if (s.includes("progress") || s.includes("active")) return "in-progress";
  if (s.includes("done") || s.includes("complete")) return "done";
  if (s.includes("block")) return "blocked";
  return "backlog";
}

function normalizeAssignee(value?: string | null): AgentKey {
  const v = (value || "").trim();
  if (!v) return "main";
  if ((Object.keys(AGENTS) as AgentKey[]).includes(v as AgentKey)) return v as AgentKey;
  const entry = (Object.entries(AGENTS) as [AgentKey, (typeof AGENTS)[AgentKey]][]).find(
    ([, a]) => a.name.toLowerCase() === v.toLowerCase(),
  );
  return entry?.[0] || "main";
}

function buildTree(tasks: Task[]): TaskNode[] {
  const byParent = new Map<string | null, Task[]>();
  tasks.forEach((task) => {
    const pid = task.parent_id || null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(task);
  });

  const makeNodes = (parentId: string | null): TaskNode[] => {
    const list = (byParent.get(parentId) || []).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    return list.map((task) => ({ ...task, children: makeNodes(task.id) }));
  };

  return makeNodes(null);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(ddl: string): number {
  const due = startOfDay(new Date(ddl));
  const today = startOfDay(new Date());
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function ddlBadgeClass(ddl: string | null): string {
  if (!ddl) return "bg-slate-100 text-slate-500 border border-slate-200";
  const days = daysUntil(ddl);
  if (days <= 3) return "bg-red-100 text-red-700 border border-red-200";
  if (days <= 7) return "bg-orange-100 text-orange-700 border border-orange-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

function statusDotClass(status?: string | null): string {
  const n = normalizeStatus(status);
  if (n === "done") return "bg-green-500";
  if (n === "in-progress") return "bg-blue-500";
  if (n === "blocked") return "bg-red-500";
  return "bg-slate-400";
}

function priorityBadgeClass(p?: string | null) {
  if (p === "high") return "bg-red-50 text-red-700 border-red-200";
  if (p === "low") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function filterTree(nodes: TaskNode[], filter: (typeof FILTERS)[number]): TaskNode[] {
  if (filter === "all") return nodes;
  const out: TaskNode[] = [];
  for (const node of nodes) {
    const children = filterTree(node.children, filter);
    if (normalizeStatus(node.status) === filter || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({});
  const [ddlEditingId, setDdlEditingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    assignee: "main" as AgentKey,
    priority: "medium",
    ddl: "",
    description: "",
    parent_id: "",
  });

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const headers = useMemo(
    () => ({
      apikey: SUPABASE_API_KEY,
      Authorization: `Bearer ${SUPABASE_API_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    [],
  );

  const load = async () => {
    const r = await fetch(SUPABASE_LIST_URL, { headers, cache: "no-store" });
    const data = await r.json();
    setTasks(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tree = useMemo(() => buildTree(tasks), [tasks]);
  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);
  const visibleTree = useMemo(() => filterTree(tree, filter), [tree, filter]);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => normalizeStatus(t.status) === filter);
  }, [tasks, filter]);

  const weeklyDDLTasks = useMemo(() => {
    return filteredTasks
      .map((t) => ({ task: t, ddl: parseDDL(t.description || "").ddl }))
      .filter((x) => !!x.ddl)
      .filter((x) => {
        const d = daysUntil(x.ddl!);
        return d >= 0 && d <= 7;
      })
      .sort((a, b) => daysUntil(a.ddl!) - daysUntil(b.ddl!));
  }, [filteredTasks]);

  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) || null : null;
  const selectedChildren = useMemo(
    () => (selectedTask ? tasks.filter((t) => t.parent_id === selectedTask.id) : []),
    [selectedTask, tasks],
  );

  useEffect(() => {
    if (selectedTask) setTitleDraft(selectedTask.title || "");
  }, [selectedTask?.id]);

  useEffect(() => {
    setCollapsedRoots((prev) => {
      const next = { ...prev };
      tree.forEach((t) => {
        if (!(t.id in next)) next[t.id] = false;
      });
      return next;
    });
  }, [tree]);

  const patchTask = async (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    const r = await fetch(`${SUPABASE_BASE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(updates),
    });
    if (!r.ok) await load();
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("删除这个任务？")) return;
    await fetch(`${SUPABASE_BASE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_API_KEY,
        Authorization: `Bearer ${SUPABASE_API_KEY}`,
      },
    });
    if (selectedTaskId === id) setSelectedTaskId(null);
    await load();
  };

  const updateTaskDDL = async (task: Task, ddl: string | null) => {
    const parsed = parseDDL(task.description || "");
    const nextDesc = serializeDesc(ddl, parsed.text);
    await patchTask(task.id, { description: nextDesc || null });
  };

  const onCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setCreating(true);
    try {
      await fetch(SUPABASE_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: newTask.title.trim(),
          assignee: newTask.assignee,
          priority: newTask.priority,
          description: serializeDesc(newTask.ddl || null, newTask.description.trim()) || null,
          parent_id: newTask.parent_id || null,
          status: "backlog",
        }),
      });
      setShowCreateModal(false);
      setNewTask({ title: "", assignee: "main", priority: "medium", ddl: "", description: "", parent_id: "" });
      await load();
    } finally {
      setCreating(false);
    }
  };

  const onCreateSubtask = async () => {
    if (!selectedTask || !subtaskTitle.trim()) return;
    await fetch(SUPABASE_BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: subtaskTitle.trim(),
        assignee: normalizeAssignee(selectedTask.assignee),
        priority: selectedTask.priority || "medium",
        parent_id: selectedTask.id,
        status: "backlog",
      }),
    });
    setAddingSubtask(false);
    setSubtaskTitle("");
    await load();
  };

  const renderRows = (nodes: TaskNode[], level = 0) => {
    const rows: ReactNode[] = [];

    nodes.forEach((node) => {
      const parsed = parseDDL(node.description || "");
      const agentKey = normalizeAssignee(node.assignee);
      const childCount = node.children.length;
      const collapsed = !!collapsedRoots[node.id];

      rows.push(
        <div
          key={node.id}
          className={`grid grid-cols-[36px_minmax(220px,1fr)_90px_130px_110px_48px] items-center border-b border-slate-200 hover:bg-slate-50 ${
            selectedTaskId === node.id ? "bg-violet-50" : ""
          } ${level > 0 ? "text-[13px]" : "text-sm"}`}
        >
          <div className="px-2 py-2 flex items-center gap-1" style={{ paddingLeft: 8 + level * 20 }}>
            {childCount > 0 ? (
              <button
                className="text-xs text-slate-500 w-4"
                onClick={() => setCollapsedRoots((s) => ({ ...s, [node.id]: !s[node.id] }))}
              >
                {collapsed ? "▶" : "▼"}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(node.status)}`} title={node.status} />
          </div>

          <button className="px-2 py-2 text-left hover:text-violet-700" onClick={() => setSelectedTaskId(node.id)}>
            <span className={normalizeStatus(node.status) === "done" ? "opacity-60 line-through" : ""}>{node.title}</span>
          </button>

          <div className="px-2 py-2 text-sm">{AGENTS[agentKey].emoji}</div>

          <div className="px-2 py-2 text-sm">
            {ddlEditingId === node.id ? (
              <input
                autoFocus
                type="date"
                defaultValue={parsed.ddl || ""}
                className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
                onBlur={async (e) => {
                  const v = e.target.value || null;
                  await updateTaskDDL(node, v);
                  setDdlEditingId(null);
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value || null;
                    await updateTaskDDL(node, v);
                    setDdlEditingId(null);
                  }
                  if (e.key === "Escape") setDdlEditingId(null);
                }}
              />
            ) : parsed.ddl ? (
              <button className={`rounded-md px-2 py-1 text-xs ${ddlBadgeClass(parsed.ddl)}`} onClick={() => setDdlEditingId(node.id)}>
                {parsed.ddl}
              </button>
            ) : (
              <button className="text-xs text-slate-400" onClick={() => setDdlEditingId(node.id)}>
                + 设置截止日
              </button>
            )}
          </div>

          <div className="px-2 py-2 text-sm">
            <Badge className={`capitalize border ${priorityBadgeClass(node.priority)}`}>{node.priority || "medium"}</Badge>
          </div>

          <div className="px-2 py-2">
            <button className="text-slate-400 hover:text-red-500 text-lg leading-none" title="删除" onClick={() => deleteTask(node.id)}>
              ×
            </button>
          </div>
        </div>,
      );

      if (!collapsed && node.children.length > 0) rows.push(...renderRows(node.children, level + 1));
    });

    return rows;
  };

  return (
    <div className="relative min-h-screen bg-[#fafafa] p-6 pr-[350px] text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? "全部" : f}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ 添加任务</Button>
      </div>

      {weeklyDDLTasks.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold">⏰ 本周截止</h2>
          <div className="flex flex-wrap gap-3">
            {weeklyDDLTasks.map(({ task, ddl }) => {
              const agent = AGENTS[normalizeAssignee(task.assignee)];
              return (
                <button
                  key={task.id}
                  className="w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-violet-300"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="mb-2 line-clamp-2 text-sm font-medium">{task.title}</div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2 py-1 text-xs ${ddlBadgeClass(ddl)}`}>{ddl}</span>
                    <span className="text-lg">{agent.emoji}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">📋 所有任务</h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[36px_minmax(220px,1fr)_90px_130px_110px_48px] bg-slate-50 text-xs text-slate-500">
            <div className="px-2 py-2"></div>
            <div className="px-2 py-2">任务</div>
            <div className="px-2 py-2">负责人</div>
            <div className="px-2 py-2">DDL</div>
            <div className="px-2 py-2">优先级</div>
            <div className="px-2 py-2">操作</div>
          </div>
          <div>{visibleTree.length ? renderRows(visibleTree) : <div className="p-6 text-sm text-slate-500">暂无任务</div>}</div>
        </div>
      </section>

      <aside className="fixed right-0 top-0 h-screen w-[320px] border-l border-slate-200 bg-white p-4 overflow-y-auto">
        {!selectedTask ? (
          <div className="text-sm text-slate-500 mt-10">点击任务标题查看详情</div>
        ) : (
          <div className="space-y-4">
            <div>
              {!titleEditing ? (
                <button className="text-left text-lg font-semibold" onClick={() => setTitleEditing(true)}>
                  {selectedTask.title}
                </button>
              ) : (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={async () => {
                    setTitleEditing(false);
                    if (titleDraft.trim() && titleDraft !== selectedTask.title) {
                      await patchTask(selectedTask.id, { title: titleDraft.trim() });
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      setTitleEditing(false);
                      if (titleDraft.trim() && titleDraft !== selectedTask.title) {
                        await patchTask(selectedTask.id, { title: titleDraft.trim() });
                      }
                    }
                  }}
                />
              )}
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">状态</span>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                  value={normalizeStatus(selectedTask.status)}
                  onChange={(e) => patchTask(selectedTask.id, { status: e.target.value })}
                >
                  <option value="backlog">backlog</option>
                  <option value="in-progress">in-progress</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Assignee</span>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                  value={normalizeAssignee(selectedTask.assignee)}
                  onChange={(e) => patchTask(selectedTask.id, { assignee: e.target.value })}
                >
                  {(Object.keys(AGENTS) as AgentKey[]).map((k) => (
                    <option key={k} value={k}>
                      {AGENTS[k].name}
                      {AGENTS[k].emoji}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">优先级</span>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                  value={selectedTask.priority || "medium"}
                  onChange={(e) => patchTask(selectedTask.id, { priority: e.target.value })}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">DDL</span>
                <Input
                  type="date"
                  value={parseDDL(selectedTask.description || "").ddl || ""}
                  onChange={async (e) => {
                    const parsed = parseDDL(selectedTask.description || "");
                    const next = serializeDesc(e.target.value || null, parsed.text);
                    await patchTask(selectedTask.id, { description: next || null });
                  }}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">描述</span>
                <textarea
                  className="w-full min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2"
                  defaultValue={parseDDL(selectedTask.description || "").text}
                  onBlur={async (e) => {
                    const parsed = parseDDL(selectedTask.description || "");
                    const next = serializeDesc(parsed.ddl, e.target.value.trim());
                    await patchTask(selectedTask.id, { description: next || null });
                  }}
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">子任务</h3>
                <Button size="sm" variant="outline" onClick={() => setAddingSubtask((v) => !v)}>
                  +
                </Button>
              </div>
              <div className="space-y-1">
                {selectedChildren.map((child) => (
                  <button
                    key={child.id}
                    className="block w-full rounded border border-slate-200 px-2 py-1 text-left text-sm hover:bg-slate-50"
                    onClick={() => setSelectedTaskId(child.id)}
                  >
                    {child.title}
                  </button>
                ))}
                {!selectedChildren.length && <div className="text-xs text-slate-500">暂无子任务</div>}
              </div>
              {addingSubtask && (
                <div className="mt-2 flex gap-2">
                  <Input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} placeholder="子任务标题" />
                  <Button size="sm" onClick={onCreateSubtask}>
                    添加
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
              创建时间：{selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString() : "-"}
            </div>
          </div>
        )}
      </aside>

      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={onCreateTask} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold">添加任务</h2>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">标题 *</span>
              <Input required value={newTask.title} onChange={(e) => setNewTask((s) => ({ ...s, title: e.target.value }))} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Assignee</span>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                  value={newTask.assignee}
                  onChange={(e) => setNewTask((s) => ({ ...s, assignee: e.target.value as AgentKey }))}
                >
                  {(Object.keys(AGENTS) as AgentKey[]).map((k) => (
                    <option key={k} value={k}>
                      {AGENTS[k].name}
                      {AGENTS[k].emoji}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">优先级</span>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                  value={newTask.priority}
                  onChange={(e) => setNewTask((s) => ({ ...s, priority: e.target.value }))}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">DDL</span>
              <Input type="date" value={newTask.ddl} onChange={(e) => setNewTask((s) => ({ ...s, ddl: e.target.value }))} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">描述</span>
              <textarea
                className="w-full min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2"
                value={newTask.description}
                onChange={(e) => setNewTask((s) => ({ ...s, description: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">父任务（可选）</span>
              <select
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-2"
                value={newTask.parent_id}
                onChange={(e) => setNewTask((s) => ({ ...s, parent_id: e.target.value }))}
              >
                <option value="">无（顶级任务）</option>
                {topLevelTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                取消
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "提交中..." : "提交"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
