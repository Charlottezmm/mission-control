"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContentItem {
  id: string;
  title: string;
  status: string;
  platform: string;
  body?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

const COLUMNS = [
  { key: "Ideas", label: "💡 Ideas", color: "border-yellow-500/40" },
  { key: "Writing", label: "✍️ Writing", color: "border-blue-500/40" },
  { key: "Review", label: "👀 Review", color: "border-orange-500/40" },
  { key: "Publishing", label: "📤 Publishing", color: "border-purple-500/40" },
  { key: "Published", label: "✅ Published", color: "border-green-500/40" },
];

const STATUS_OPTIONS = ["Ideas", "Writing", "Review", "Publishing", "Published"];

const PLATFORM_COLORS: Record<string, string> = {
  xiaohongshu: "bg-red-500/20 text-red-300 border-red-500/30",
  x: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  douyin: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

function matchColumn(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("idea") || s.includes("draft") || s === "not started") return "Ideas";
  if (s.includes("writ")) return "Writing";
  if (s.includes("review") || s.includes("审")) return "Review";
  if (s.includes("publish") && !s.includes("ed")) return "Publishing";
  if (s.includes("published") || s.includes("done") || s.includes("完成")) return "Published";
  return "Ideas";
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  return `${days}天前`;
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ContentItem>>({});
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const startEdit = () => {
    if (!selected) return;
    setEditForm({
      title: selected.title,
      status: selected.status,
      platform: selected.platform,
      body: selected.body || "",
      tags: selected.tags || [],
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...editForm }),
      });
      const data = await res.json();
      if (data.item) {
        setSelected(data.item);
        setEditing(false);
        fetchItems();
      }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteItem = async () => {
    if (!selected || !confirm("确定删除？")) return;
    await fetch(`/api/content?id=${selected.id}`, { method: "DELETE" });
    setSelected(null);
    fetchItems();
  };

  const moveStatus = async (newStatus: string) => {
    if (!selected) return;
    const res = await fetch("/api/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, status: newStatus }),
    });
    const data = await res.json();
    if (data.item) { setSelected(data.item); fetchItems(); }
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: items.filter((item) => matchColumn(item.status) === col.key),
  }));

  // Side panel open?
  const panelOpen = !!selected;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Kanban Board */}
      <div className={`flex-1 p-6 transition-all duration-300 ${panelOpen ? "pr-0" : ""}`}>
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Content Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} 条内容 · 小红书 / X / 抖音
          </p>
        </div>
        {error && <p className="text-sm text-destructive mb-3">Error: {error}</p>}

        <div className={`grid gap-3 h-[calc(100vh-8rem)] ${panelOpen ? "grid-cols-3" : "grid-cols-5"}`}>
          {grouped.map((col) => {
            // When panel is open, hide Ideas and Published columns to save space
            if (panelOpen && (col.key === "Ideas" || col.key === "Published") && col.items.length === 0) return null;
            return (
              <div key={col.key} className="flex flex-col min-w-0">
                <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">{col.items.length}</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-1">
                    {col.items.map((item) => (
                      <Card
                        key={item.id}
                        className={`transition-all cursor-pointer border ${
                          selected?.id === item.id
                            ? "ring-2 ring-primary border-primary"
                            : "hover:border-muted-foreground/30"
                        }`}
                        onClick={() => { setSelected(item); setEditing(false); }}
                      >
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${PLATFORM_COLORS[item.platform] || ""}`}
                            >
                              {item.platform}
                            </Badge>
                            {item.created_at && (
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {timeAgo(item.created_at)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side Panel */}
      {selected && (
        <div className="w-[520px] border-l bg-background flex flex-col h-screen shrink-0">
          {/* Header */}
          <div className="p-4 border-b flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {!editing ? (
                <h2 className="text-lg font-semibold leading-snug">{selected.title}</h2>
              ) : (
                <Input
                  className="text-lg font-semibold"
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {!editing ? (
                  <>
                    <Badge variant="outline" className={PLATFORM_COLORS[selected.platform] || ""}>{selected.platform}</Badge>
                    <Badge variant="secondary">{selected.status}</Badge>
                    {selected.tags?.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </>
                ) : (
                  <div className="flex gap-2 w-full">
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm flex-1"
                      value={editForm.status || ""}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Input
                      className="flex-1 h-8"
                      placeholder="平台"
                      value={editForm.platform || ""}
                      onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 text-lg" onClick={() => { setSelected(null); setEditing(false); }}>✕</Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {!editing ? (
              selected.body ? (
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {selected.body}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">（无正文）</p>
              )
            ) : (
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[400px] rounded-md border border-input bg-transparent px-3 py-2 text-[15px] leading-relaxed resize-y focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  value={editForm.body || ""}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                  <Input
                    value={(editForm.tags || []).join(", ")}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t flex items-center gap-2">
            {!editing ? (
              <>
                <Button variant="destructive" size="sm" onClick={deleteItem}>删除</Button>
                <Button variant="outline" size="sm" onClick={startEdit}>编辑</Button>
                <div className="flex-1" />
                {selected.created_at && (
                  <span className="text-[11px] text-muted-foreground mr-2">
                    {new Date(selected.created_at).toLocaleString("zh-CN")}
                  </span>
                )}
                {(() => {
                  const idx = STATUS_OPTIONS.indexOf(selected.status);
                  const next = idx >= 0 && idx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[idx + 1] : null;
                  return next ? (
                    <Button size="sm" onClick={() => moveStatus(next)}>
                      → {next}
                    </Button>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>取消</Button>
                <div className="flex-1" />
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
