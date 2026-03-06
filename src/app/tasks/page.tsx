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
  const m = (desc || "").match(/DDL:(\d{4}-\d{2}-\d{2})\s*\|?\s*/);
  return m ? { ddl: m[1], text: desc.replace(m[0], "").trim() } : { ddl: null, text: desc || "" };
}

function serializeDesc(ddl: string | null, text: string): string {
  return ddl ? `DDL:${ddl} | ${text}` : text;
}

function ddlColor(ddl: string | null): string {
  if (!ddl) return "text-gray-400";
  const days = Math.ceil((new Date(ddl).getTime() - Date.now()) / 86400000);
  if (days <= 3) return "bg-red-500/20 text-red-400 border border-red-500/30";
  if (days <= 7) return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
  if (days <= 30) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
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

  const load = async () => {
    const r = await fetch("/api/tasks", { cache: "no-store" });
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.tasks || [];
    setTasks(list);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tree = useMemo(() => buildTree(tasks), [tasks]);
  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);

  useEffect(() => {
    setCollapsedRoots((prev) => {
      const next = { ...prev };
      tree.forEach((t) => {
        if (!(t.id in next)) next[t.id] = false;
      });
      return next;
    });
  }, [tree]);

  const visibleTree = useMemo(() => {
    if (filter === "all") return tree;
    return tree.filter((n) => normalizeStatus(n.status) === filter);
  }, [tree, filter]);

  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) || null : null;
  const selectedChildren = useMemo(
    () => (selectedTask ? tasks.filter((t) => t.parent_id === selectedTask.id) : []),
    [selectedTask, tasks],
  );

  useEffect(() => {
    if (selectedTask) setTitleDraft(selectedTask.title || "");
  }, [selectedTask?.id]);

  const patchTask = async (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    const r = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!r.ok) await load();
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("删除这个任务？")) return;
    await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (selectedTaskId === id) setSelectedTaskId(null);
    await load();
  };

  const updateTaskDDL = async (task: Task, ddl: string | null) => {
    const parsed = parseDDL(task.description || "");
    const nextDesc = serializeDesc(ddl, parsed.text);
    await patchTask(task.id, { description: nextDesc || null });
  };

  const toggleDone = async (task: Task) => {
    const current = normalizeStatus(task.status);
    const next = current === "done" ? "backlog" : "done";
    await patchTask(task.id, { status: next });
  };

  const onCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const priorityBadgeClass = (p?: string | null) => {
    if (p === "high") return "bg-red-500/20 text-red-300 border-red-500/30";
    if (p === "low") return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
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
          className={`grid grid-cols-[36px_minmax(220px,1fr)_90px_170px_110px_48px] items-center border-b border-white/5 hover:bg-white/5 ${
            selectedTaskId === node.id ? "bg-white/10" : ""
          }`}
        >
          <div className="px-2 py-2 flex items-center gap-1" style={{ paddingLeft: 8 + level * 20 }}>
            {childCount > 0 ? (
              <button
                className="text-xs text-muted-foreground w-4"
                onClick={() => setCollapsedRoots((s) => ({ ...s, [node.id]: !s[node.id] }))}
              >
                {collapsed ? "▶" : "▼"}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                normalizeStatus(node.status) === "done"
                  ? "bg-green-500"
                  : normalizeStatus(node.status) === "in-progress"
                  ? "bg-blue-500"
                  : normalizeStatus(node.status) === "blocked"
                  ? "bg-red-500"
                  : "bg-gray-500"
              }`}
              title={node.status}
            />
          </div>

          <button className="px-2 py-2 text-left text-sm hover:text-primary" onClick={() => setSelectedTaskId(node.id)}>
            <span className={normalizeStatus(node.status) === "done" ? "opacity-50" : ""}>{node.title}</span>
            {childCount > 0 && <span className="ml-2 text-xs text-muted-foreground">({childCount} 子任务)</span>}
          </button>

          <div className="px-2 py-2 text-sm">
            {AGENTS[agentKey].name}
            {AGENTS[agentKey].emoji}
          </div>

          <div className="px-2 py-2 text-sm">
            {ddlEditingId === node.id ? (
              <input
                autoFocus
                type="date"
                defaultValue={parsed.ddl || ""}
                className="h-7 rounded border bg-transparent px-1 text-xs"
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
              <button
                className={`rounded-md px-2 py-1 text-xs ${ddlColor(parsed.ddl)}`}
                onClick={() => setDdlEditingId(node.id)}
              >
                {parsed.ddl}
              </button>
            ) : (
              <button className="text-xs text-gray-400" onClick={() => setDdlEditingId(node.id)}>
                + 设置截止日
              </button>
            )}
          </div>

          <div className="px-2 py-2 text-sm">
            <Badge className={`capitalize border ${priorityBadgeClass(node.priority)}`}>{node.priority || "medium"}</Badge>
          </div>

          <div className="px-2 py-2">
            <button className="text-muted-foreground hover:text-red-400 text-lg leading-none" title="删除" onClick={() => deleteTask(node.id)}>
              ×
            </button>
          </div>
        </div>,
      );

      if (!collapsed && node.children.length > 0) {
        rows.push(...renderRows(node.children, level + 1));
      }
    });

    return rows;
  };

  return (
    <div className="relative p-6 pr-[350px]">
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

      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[36px_minmax(220px,1fr)_90px_170px_110px_48px] bg-white/5 text-xs text-muted-foreground">
          <div className="px-2 py-2"></div>
          <div className="px-2 py-2">任务</div>
          <div className="px-2 py-2">负责人</div>
          <div className="px-2 py-2">DDL</div>
          <div className="px-2 py-2">优先级</div>
          <div className="px-2 py-2">操作</div>
        </div>

        <div>{visibleTree.length ? renderRows(visibleTree) : <div className="p-6 text-sm text-muted-foreground">暂无任务</div>}</div>
      </div>

      <aside className="fixed right-0 top-0 h-screen w-[320px] border-l border-white/10 bg-background/95 p-4 overflow-y-auto">
        {!selectedTask ? (
          <div className="text-sm text-muted-foreground mt-10">点击任务标题查看详情</div>
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
                <span className="mb-1 block text-xs text-muted-foreground">状态</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2"
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
                <span className="mb-1 block text-xs text-muted-foreground">Assignee</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2"
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
                <span className="mb-1 block text-xs text-muted-foreground">优先级</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2"
                  value={selectedTask.priority || "medium"}
                  onChange={(e) => patchTask(selectedTask.id, { priority: e.target.value })}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">DDL</span>
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
                <span className="mb-1 block text-xs text-muted-foreground">描述</span>
                <textarea
                  className="w-full min-h-28 rounded-md border bg-background px-3 py-2"
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
                    className="block w-full rounded border border-white/10 px-2 py-1 text-left text-sm hover:bg-white/5"
                    onClick={() => setSelectedTaskId(child.id)}
                  >
                    {child.title}
                  </button>
                ))}
                {!selectedChildren.length && <div className="text-xs text-muted-foreground">暂无子任务</div>}
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

            <div className="border-t border-white/10 pt-3 text-xs text-muted-foreground">
              创建时间：{selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString() : "-"}
            </div>
          </div>
        )}
      </aside>

      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={onCreateTask} className="w-full max-w-lg rounded-xl border border-white/10 bg-background p-5 space-y-4">
            <h2 className="text-lg font-semibold">添加任务</h2>

            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">标题 *</span>
              <Input required value={newTask.title} onChange={(e) => setNewTask((s) => ({ ...s, title: e.target.value }))} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Assignee</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2"
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
                <span className="mb-1 block text-xs text-muted-foreground">优先级</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2"
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
              <span className="mb-1 block text-xs text-muted-foreground">DDL</span>
              <Input type="date" value={newTask.ddl} onChange={(e) => setNewTask((s) => ({ ...s, ddl: e.target.value }))} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">描述</span>
              <textarea
                className="w-full min-h-24 rounded-md border bg-background px-3 py-2"
                value={newTask.description}
                onChange={(e) => setNewTask((s) => ({ ...s, description: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">父任务（可选）</span>
              <select
                className="w-full h-9 rounded-md border bg-background px-2"
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
