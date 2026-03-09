"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  { key: "Ideas", label: "💡 Ideas" },
  { key: "Writing", label: "✍️ Writing" },
  { key: "Review", label: "👀 Review" },
  { key: "Publishing", label: "📤 Publishing" },
  { key: "Published", label: "✅ Published" },
];

const STATUS_OPTIONS = ["Ideas", "Writing", "Review", "Publishing", "Published"];

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
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function platformLabel(p: string) {
  if (p === "xiaohongshu") return "小红书";
  if (p === "douyin") return "抖音";
  return p.toUpperCase();
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
    setEditForm({ title: selected.title, status: selected.status, platform: selected.platform, body: selected.body || "", tags: selected.tags || [] });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, ...editForm }) });
      const data = await res.json();
      if (data.item) { setSelected(data.item); setEditing(false); fetchItems(); }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteItem = async () => {
    if (!selected || !confirm("确定删除？")) return;
    await fetch(`/api/content?id=${selected.id}`, { method: "DELETE" });
    setSelected(null); fetchItems();
  };

  const moveStatus = async (newStatus: string) => {
    if (!selected) return;
    const res = await fetch("/api/content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status: newStatus }) });
    const data = await res.json();
    if (data.item) { setSelected(data.item); fetchItems(); }
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: items.filter((item) => matchColumn(item.status) === col.key),
  }));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Content Pipeline</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{items.length} 条内容 · 小红书 / X / 抖音</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Kanban Board - always full width */}
      <div className="grid grid-cols-5 gap-3 h-[calc(100vh-10rem)]">
        {grouped.map((col) => (
          <div key={col.key} className="flex flex-col min-h-0">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className="text-xs font-medium text-muted-foreground">{col.label}</span>
              {col.items.length > 0 && (
                <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono">{col.items.length}</span>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 px-0.5">
                {col.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setSelected(item); setEditing(false); }}
                    className={`rounded-lg border p-2.5 cursor-pointer transition-all ${
                      selected?.id === item.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-border bg-card/50 hover:bg-card"
                    }`}
                  >
                    <p className="text-[13px] font-medium leading-snug line-clamp-2 mb-1.5">{item.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{platformLabel(item.platform)}</span>
                      {item.created_at && <span className="text-[10px] text-muted-foreground/60 ml-auto">{timeAgo(item.created_at)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Center Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditing(false); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden !bg-white dark:!bg-neutral-900 shadow-2xl">
          {selected && (
            <>
              {/* Modal Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                {!editing ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold leading-snug pr-8">{selected.title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{platformLabel(selected.platform)}</span>
                      <span>·</span>
                      <span>{selected.status}</span>
                      {selected.tags && selected.tags.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="truncate">{selected.tags.join(", ")}</span>
                        </>
                      )}
                      {selected.created_at && (
                        <>
                          <span className="ml-auto">{new Date(selected.created_at).toLocaleString("zh-CN")}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">标题</label>
                      <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] text-muted-foreground mb-1 block">状态</label>
                        <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] text-muted-foreground mb-1 block">平台</label>
                        <Input value={editForm.platform || ""} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                      <Input className="text-sm" value={(editForm.tags || []).join(", ")} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Body - scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {!editing ? (
                  selected.body ? (
                    <article className="text-[15px] leading-[1.9] text-foreground/90">
                      {selected.body.split("\n").map((line, i) => {
                        if (/^[━─═—]{3,}$/.test(line.trim())) return <hr key={i} className="my-5 border-border/30" />;
                        if (line.trim() === "") return <div key={i} className="h-3" />;
                        return <p key={i} className="my-0">{line}</p>;
                      })}
                    </article>
                  ) : (
                    <p className="text-sm text-muted-foreground">（无正文）</p>
                  )
                ) : (
                  <textarea
                    className="w-full min-h-[350px] rounded-md border border-input bg-transparent px-4 py-3 text-[15px] leading-[1.9] resize-y focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                    value={editForm.body || ""}
                    onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-border/50 flex items-center gap-3 shrink-0">
                {!editing ? (
                  <>
                    <button onClick={deleteItem} className="text-xs text-muted-foreground hover:text-destructive transition-colors">删除</button>
                    <button onClick={startEdit} className="text-xs text-muted-foreground hover:text-foreground transition-colors">编辑</button>
                    <div className="flex-1" />
                    {(() => {
                      const idx = STATUS_OPTIONS.indexOf(selected.status);
                      const next = idx >= 0 && idx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[idx + 1] : null;
                      return next ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moveStatus(next)}>→ {next}</Button>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
                    <div className="flex-1" />
                    <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={saving}>{saving ? "..." : "保存"}</Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
