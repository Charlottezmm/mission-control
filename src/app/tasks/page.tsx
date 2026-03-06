"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  category?: string;
  priority?: string;
  description?: string;
  parent_id?: string | null;
}

interface TaskNode extends Task {
  children: TaskNode[];
}

const ASSIGNEES = ["Samantha", "Beth", "Luna", "Nova", "Pixel", "Charlotte"];
const STATUS_OPTIONS = ["backlog", "in-progress", "done"];

const ASSIGNEE_DOT: Record<string, string> = {
  Samantha: "bg-violet-500",
  Beth: "bg-blue-500",
  Luna: "bg-pink-500",
  Nova: "bg-orange-500",
  Pixel: "bg-green-500",
  Charlotte: "bg-amber-500",
};

function normalizeStatus(s: string) {
  const lower = s?.toLowerCase().replace(/_/g, "-") || "backlog";
  if (lower.includes("progress") || lower.includes("active")) return "in-progress";
  if (lower.includes("done") || lower.includes("complete")) return "done";
  return "backlog";
}

function buildTree(tasks: Task[]): TaskNode[] {
  const byParent = new Map<string | null, Task[]>();
  tasks.forEach((task) => {
    const pid = task.parent_id || null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(task);
  });

  const makeNodes = (parentId: string | null): TaskNode[] => {
    const list = (byParent.get(parentId) || []).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return list.map((task) => ({ ...task, children: makeNodes(task.id) }));
  };

  return makeNodes(null);
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  if (normalized === "in-progress") {
    return <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">in-progress</Badge>;
  }
  if (normalized === "done") {
    return <Badge className="bg-emerald-800 hover:bg-emerald-800 text-white text-xs">done</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground hover:bg-muted text-xs">backlog</Badge>;
}

function AssigneeChip({ assignee }: { assignee?: string }) {
  if (!assignee) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${ASSIGNEE_DOT[assignee] || "bg-slate-400"}`} />
      {assignee}
    </span>
  );
}

function parseDDL(description?: string): string | null {
  if (!description) return null;
  const m = description.match(/DDL:(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function DDLBadge({ description }: { description?: string }) {
  const ddl = parseDDL(description);
  if (!ddl) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(ddl);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let cls = "bg-slate-700 text-slate-200";
  let label = `📅 ${ddl}`;
  if (diffDays < 0) {
    cls = "bg-red-900 text-red-200";
    label = `🔴 逾期 ${ddl}`;
  } else if (diffDays <= 3) {
    cls = "bg-red-700 text-red-100";
    label = `🚨 ${diffDays}天 ${ddl}`;
  } else if (diffDays <= 7) {
    cls = "bg-orange-700 text-orange-100";
    label = `⚠️ ${diffDays}天 ${ddl}`;
  } else if (diffDays <= 30) {
    cls = "bg-yellow-800 text-yellow-100";
    label = `📅 ${diffDays}天 ${ddl}`;
  }

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono ${cls}`}>
      {label}
    </span>
  );
}

function cleanDescription(description?: string): string {
  if (!description) return "";
  return description.replace(/DDL:\d{4}-\d{2}-\d{2}\s*\|?\s*/, "").trim();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(ASSIGNEES[0]);
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [createExpanded, setCreateExpanded] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", status: "backlog", assignee: "", description: "" });

  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({});
  const [doneOpen, setDoneOpen] = useState(false);

  const load = async () => {
    const r = await fetch("/api/tasks", { cache: "no-store" });
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.tasks || [];
    setTasks(list);
  };

  useEffect(() => {
    load().catch(() => {});
    const iv = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(iv);
  }, []);

  const rootTree = useMemo(() => buildTree(tasks), [tasks]);
  const rootOptions = useMemo(() => rootTree.map((r) => ({ id: r.id, title: r.title })), [rootTree]);

  useEffect(() => {
    setExpandedRoots((prev) => {
      const next = { ...prev };
      for (const root of rootTree) {
        if (!(root.id in next)) next[root.id] = true;
      }
      return next;
    });
  }, [rootTree]);

  const groupedRoots = useMemo(() => {
    const grouped: Record<string, TaskNode[]> = { "in-progress": [], backlog: [], done: [] };
    for (const root of rootTree) {
      grouped[normalizeStatus(root.status)].push(root);
    }
    return grouped;
  }, [rootTree]);

  const stats = useMemo(() => {
    const rootCount = rootTree.length;
    const inProgressCount = tasks.filter((t) => normalizeStatus(t.status) === "in-progress").length;
    const doneCount = tasks.filter((t) => normalizeStatus(t.status) === "done").length;
    return { rootCount, inProgressCount, doneCount };
  }, [tasks, rootTree]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assignee,
          priority,
          category,
          description: description.trim() || null,
          parent_id: parentId || null,
          status: "backlog",
        }),
      });
      setTitle("");
      setDescription("");
      setParentId("");
      setCreateExpanded(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title || "",
      status: normalizeStatus(task.status),
      assignee: task.assignee || "",
      description: task.description || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    });
    setEditingId(null);
    await load();
  };

  const deleteTask = async (id: string) => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;
    await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  };

  const renderTask = (task: TaskNode, level: number, isLast: boolean, isRoot = false) => {
    const normalized = normalizeStatus(task.status);
    const muted = normalized === "done";
    const rowClass = isRoot
      ? "rounded-md border bg-muted/40 px-3 py-2.5"
      : "rounded-md px-2 py-1.5";

    return (
      <div key={task.id} className="space-y-1">
        <div
          className={`${rowClass} ${muted ? "text-muted-foreground" : ""} flex items-start justify-between gap-3`}
          style={{ marginLeft: isRoot ? 0 : `${level * 24}px` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {!isRoot && <span className="text-xs text-muted-foreground w-5 shrink-0">{isLast ? "└─" : "├─"}</span>}
              <span className={`${isRoot ? "font-semibold" : "font-medium"} text-sm break-words`}>
                {isRoot && normalized === "in-progress" ? "🔥 " : ""}
                {task.title}
              </span>
              <AssigneeChip assignee={task.assignee} />
              <StatusBadge status={task.status} />
              <DDLBadge description={task.description} />
            </div>
            {/* Description shown below title */}
            {task.description && editingId !== task.id && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words pl-0">
                {cleanDescription(task.description)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(task)}>
              Edit
            </Button>
            {isRoot ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setCreateExpanded(true);
                  setParentId(task.id);
                }}
              >
                +子任务
              </Button>
            ) : (
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => deleteTask(task.id)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {editingId === task.id && (
          <div
            className="rounded-md border bg-background p-4 space-y-3 max-w-2xl"
            style={{ marginLeft: isRoot ? 0 : `${level * 24 + 24}px` }}
          >
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Title"
              className="h-8"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                className="w-full h-8 rounded-md border bg-background px-2 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="w-full h-8 rounded-md border bg-background px-2 text-sm"
                value={editForm.assignee}
                onChange={(e) => setEditForm((s) => ({ ...s, assignee: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {ASSIGNEES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Description（时间线、目标、备注...）"
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 px-2 text-xs" onClick={saveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {task.children.length > 0 && (!isRoot || expandedRoots[task.id]) && (
          <div className="space-y-1">
            {task.children.map((child, idx) => renderTask(child, level + 1, idx === task.children.length - 1))}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (label: string, emoji: string, roots: TaskNode[], collapsible = false) => {
    const open = !collapsible || doneOpen;
    return (
      <Card className="bg-card/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => collapsible && setDoneOpen((v) => !v)}
              className={`text-sm font-semibold flex items-center gap-2 ${collapsible ? "cursor-pointer" : "cursor-default"}`}
            >
              {collapsible ? (open ? "▼" : "▶") : "•"} {emoji} {label}
              <span className="text-xs text-muted-foreground">({roots.length})</span>
            </button>
          </div>
          {open && (
            <div className="space-y-2">
              {roots.length === 0 && <p className="text-xs text-muted-foreground">No tasks</p>}
              {roots.map((root) => (
                <div key={root.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedRoots((s) => ({ ...s, [root.id]: !s[root.id] }))}
                      className="text-xs text-muted-foreground w-4"
                    >
                      {expandedRoots[root.id] ? "▼" : "▶"}
                    </button>
                    <div className="flex-1">{renderTask(root, 0, true, true)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8 space-y-5">
      <h1 className="text-2xl font-bold">Tasks</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">父任务数</p>
            <p className="text-xl font-semibold">{stats.rootCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">进行中</p>
            <p className="text-xl font-semibold text-green-600">{stats.inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">已完成</p>
            <p className="text-xl font-semibold text-emerald-700">{stats.doneCount}</p>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[calc(100vh-24rem)] pr-2">
        <div className="space-y-4">
          {renderGroup("In Progress", "🔥", groupedRoots["in-progress"])}
          {renderGroup("Backlog", "📋", groupedRoots.backlog)}
          {renderGroup("Done", "✅", groupedRoots.done, true)}
        </div>
      </ScrollArea>

      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={onCreate} className="space-y-3">
            <div className="flex gap-2 items-center">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a new task..."
                required
                className="h-9"
              />
              <Button type="submit" disabled={submitting} className="h-9">
                {submitting ? "Adding..." : "Add Task"}
              </Button>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCreateExpanded((v) => !v)}>
                {createExpanded ? "−" : "+"}
              </Button>
            </div>

            {createExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  {ASSIGNEES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>

                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="h-9" />

                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">Root task</option>
                  {rootOptions.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>

                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  className="h-9 md:col-span-5"
                />
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
