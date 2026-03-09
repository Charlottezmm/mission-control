"use client";
import { useEffect, useState, useCallback } from "react";
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

  const panelOpen = !!selected;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Board */}
      <div className="flex-1 flex flex-col min-w-0 p-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Content Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{items.length} 条内容 · 小红书 / X / 抖音</p>
        </div>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}

        <div className="flex-1 grid grid-cols-5 gap-2 min-h-0">
          {grouped.map((col) => (
            <div key={col.key} className="flex flex-col min-w-0 min-h-0">
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
                      className={`rounded-lg border p-2.5 cursor-pointer transition-all text-left ${
                        selected?.id === item.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border bg-card/50 hover:bg-card"
                      }`}
                    >
                      <p className="text-[13px] font-medium leading-snug line-clamp-2 mb-1.5">{item.title}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{platformLabel(item.platform)}</span>
                        {item.created_at && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">{timeAgo(item.created_at)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      </div>

      {/* Side Panel */}
      {panelOpen && selected && (
        <div className="w-[480px] border-l border-border/50 flex flex-col h-screen shrink-0 bg-card/30">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {!editing ? (
                  <h2 className="text-base font-semibold leading-snug">{selected.title}</h2>
                ) : (
                  <Input className="text-base font-semibold" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                )}
              </div>
              <button onClick={() => { setSelected(null); setEditing(false); }} className="text-muted-foreground hover:text-foreground p-1 -mt-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            {!editing ? (
              <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground">
                <span>{platformLabel(selected.platform)}</span>
                <span>·</span>
                <span>{selected.status}</span>
                {selected.tags && selected.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="truncate">{selected.tags.join(", ")}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-2 mt-2.5">
                <select className="h-8 rounded-md border border-input bg-transparent px-2 text-xs flex-1" value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Input className="flex-1 h-8 text-xs" placeholder="平台" value={editForm.platform || ""} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })} />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!editing ? (
              selected.body ? (
                <article className="text-[14px] leading-[1.8] text-foreground/85 whitespace-pre-wrap [&>*]:my-0">
                  {selected.body.split("\n").map((line, i) => {
                    // Hide ugly separator lines
                    if (/^[━─═—]{3,}$/.test(line.trim())) {
                      return <div key={i} className="my-4 border-t border-border/30" />;
                    }
                    if (line.trim() === "") return <div key={i} className="h-3" />;
                    return <p key={i} className="my-0">{line}</p>;
                  })}
                </article>
              ) : (
                <p className="text-sm text-muted-foreground">（无正文）</p>
              )
            ) : (
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[400px] rounded-md border border-input bg-transparent px-3 py-2 text-[14px] leading-[1.8] resize-y focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  value={editForm.body || ""}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                />
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                  <Input className="text-xs" value={(editForm.tags || []).join(", ")} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2">
            {!editing ? (
              <>
                <button onClick={deleteItem} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">删除</button>
                <button onClick={startEdit} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1">编辑</button>
                <div className="flex-1" />
                {selected.created_at && (
                  <span className="text-[10px] text-muted-foreground/50">{new Date(selected.created_at).toLocaleString("zh-CN")}</span>
                )}
                {(() => {
                  const idx = STATUS_OPTIONS.indexOf(selected.status);
                  const next = idx >= 0 && idx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[idx + 1] : null;
                  return next ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={() => moveStatus(next)}>
                      → {next}
                    </Button>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">取消</button>
                <div className="flex-1" />
                <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={saving}>{saving ? "..." : "保存"}</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
