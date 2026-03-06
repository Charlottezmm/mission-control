"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContentItem {
  id: string;
  title: string;
  status: string;
  platform: string;
  createdAt: string;
}

const COLUMNS = [
  { key: "Ideas", label: "💡 Ideas", color: "bg-yellow-500/20" },
  { key: "Writing", label: "✍️ Writing", color: "bg-blue-500/20" },
  { key: "Review", label: "👀 Review", color: "bg-orange-500/20" },
  { key: "Publishing", label: "📤 Publishing", color: "bg-purple-500/20" },
  { key: "Published", label: "✅ Published", color: "bg-green-500/20" },
];

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

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch((e) => setError(e.message));
  }, []);

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: items.filter((item) => matchColumn(item.status) === col.key),
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">小红书 / X content tracking via Notion</p>
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
                  <Card key={item.id} className="bg-card/80 hover:bg-card transition-colors">
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs font-medium leading-snug">{item.title}</p>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{item.platform}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>
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
    </div>
  );
}
