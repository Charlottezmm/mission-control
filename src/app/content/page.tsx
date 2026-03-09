"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  { key: "Ideas", label: "💡 Ideas", color: "bg-yellow-500/20" },
  { key: "Writing", label: "✍️ Writing", color: "bg-blue-500/20" },
  { key: "Review", label: "👀 Review", color: "bg-orange-500/20" },
  { key: "Publishing", label: "📤 Publishing", color: "bg-purple-500/20" },
  { key: "Published", label: "✅ Published", color: "bg-green-500/20" },
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

  const openDetail = (item: ContentItem) => {
    setSelected(item);
    setEditing(false);
    setEditForm({});
  };

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!selected || !confirm("确定删除这条内容？")) return;
    try {
      await fetch(`/api/content?id=${selected.id}`, { method: "DELETE" });
      setSelected(null);
      fetchItems();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: items.filter((item) => matchColumn(item.status) === col.key),
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">小红书 / X content tracking</p>
      </div>
      {error && <p className="text-sm text-destructive">Error: {error}</p>}
      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-10rem)]">
        {grouped.map((col) => (
          <div key={col.key} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {col.label}
              </h2>
              <Badge variant="secondary" className="ml-auto text-xs">{col.items.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {col.items.map((item) => (
                  <Card
                    key={item.id}
                    className="bg-card/80 hover:bg-card transition-colors cursor-pointer hover:ring-1 hover:ring-primary/30"
                    onClick={() => openDetail(item)}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs font-medium leading-snug">{item.title}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{item.platform}</Badge>
                        {item.tags?.slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {col.items.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-6">Empty</p>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "编辑内容" : selected?.title}
            </DialogTitle>
          </DialogHeader>

          {selected && !editing && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{selected.platform}</Badge>
                <Badge variant="secondary">{selected.status}</Badge>
                {selected.tags?.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
              {selected.body && (
                <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
                  {selected.body}
                </div>
              )}
              {!selected.body && (
                <p className="text-sm text-muted-foreground">（无正文内容）</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                创建: {selected.created_at ? new Date(selected.created_at).toLocaleString("zh-CN") : "—"}
              </p>
            </div>
          )}

          {selected && editing && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标题</label>
                <Input
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">状态</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={editForm.status || ""}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">平台</label>
                  <Input
                    value={editForm.platform || ""}
                    onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">正文</label>
                <textarea
                  className="w-full min-h-[300px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                  value={editForm.body || ""}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                <Input
                  value={(editForm.tags || []).join(", ")}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 pt-2">
            {!editing ? (
              <>
                <Button variant="destructive" size="sm" onClick={deleteItem}>删除</Button>
                <Button variant="outline" size="sm" onClick={startEdit}>编辑</Button>
                <Button size="sm" onClick={() => {
                  if (selected) {
                    const next = STATUS_OPTIONS[STATUS_OPTIONS.indexOf(selected.status) + 1];
                    if (next) {
                      fetch("/api/content", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: selected.id, status: next }),
                      }).then(() => { fetchItems(); setSelected({ ...selected, status: next }); });
                    }
                  }
                }}>
                  推进 →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>取消</Button>
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
