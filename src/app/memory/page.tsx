"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, FileText, ChevronDown, ChevronRight, Clock3, ArrowLeft, Brain, BookOpen, Lightbulb, Settings, Calendar as CalendarIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
  synced_at?: string;
}

interface SearchResult {
  file: string;
  line: string;
  lineNum: number;
}

const DAY_RE = /(\d{4}-\d{2}-\d{2})/;
const getBaseName = (path: string) => path.split("/").pop() || path;
const stripMd = (name: string) => name.replace(/\.md$/i, "");
const getDayKey = (path: string) => DAY_RE.exec(path)?.[1] || null;

const formatTime = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
};

// Categorize files
type Category = "daily" | "project" | "lesson" | "config" | "xhs" | "other";
const CATEGORIES: Record<Category, { label: string; icon: typeof Brain; color: string }> = {
  daily: { label: "日报", icon: CalendarIcon, color: "text-blue-500" },
  project: { label: "项目文档", icon: BookOpen, color: "text-purple-500" },
  lesson: { label: "经验教训", icon: Lightbulb, color: "text-amber-500" },
  xhs: { label: "小红书", icon: FileText, color: "text-rose-500" },
  config: { label: "系统配置", icon: Settings, color: "text-slate-500" },
  other: { label: "其他", icon: Brain, color: "text-emerald-500" },
};

function categorizeFile(path: string): Category {
  const name = path.toLowerCase();
  if (DAY_RE.test(name) && !name.includes("xhs") && !name.includes("xiaohongshu")) return "daily";
  if (name.includes("lesson") || name.includes("feedback")) return "lesson";
  if (name.includes("xhs") || name.includes("xiaohongshu") || name.includes("redbook")) return "xhs";
  if (name.endsWith(".json") || name.includes("config") || name.includes("state") || name.includes("push-history") || name.includes("heartbeat")) return "config";
  if (name.includes("flux") || name.includes("project") || name.includes("opportunity") || name.includes("ui-redesign") || name.includes("kanban")) return "project";
  return "other";
}

export default function MemoryPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | undefined>();
  const [contentLoading, setContentLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ daily: true });

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setFiles((d.files || []) as FileEntry[]));
  }, []);

  const openFile = (path: string) => {
    setCurrentFile(path);
    setContentLoading(true);
    fetch(`/api/memory?file=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content || d.error || "");
        setContentUpdatedAt(d.synced_at);
      })
      .finally(() => setContentLoading(false));
  };

  const doSearch = () => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearching(true);
    fetch(`/api/memory?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => setSearchResults(d.results || []))
      .finally(() => setSearching(false));
  };

  const today = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const map = new Map<Category, FileEntry[]>();
    files.filter((f) => !f.isDir).forEach((f) => {
      const cat = categorizeFile(f.path);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    });
    // Sort files within each category
    map.forEach((list) => list.sort((a, b) => (a.path < b.path ? 1 : -1)));
    const order: Category[] = ["daily", "project", "lesson", "xhs", "config", "other"];
    return order.filter((c) => map.has(c)).map((c) => ({ cat: c, files: map.get(c)! }));
  }, [files]);

  const recentFiles = useMemo(() => {
    return [...files]
      .filter((f) => !f.isDir)
      .sort((a, b) => {
        const ta = a.synced_at ? new Date(a.synced_at).getTime() : 0;
        const tb = b.synced_at ? new Date(b.synced_at).getTime() : 0;
        return tb - ta || (a.path < b.path ? 1 : -1);
      })
      .slice(0, 6);
  }, [files]);

  const totalFiles = files.filter((f) => !f.isDir).length;

  // ── Content view (mobile: full screen, desktop: right panel) ──
  if (currentFile) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          <button onClick={() => setCurrentFile(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors lg:hidden">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={() => setCurrentFile(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors hidden lg:block">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{stripMd(getBaseName(currentFile))}</p>
            {contentUpdatedAt && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock3 className="w-3 h-3" />
                {formatTime(contentUpdatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {contentLoading ? (
            <div className="p-6 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
            </div>
          ) : (
            <article className="p-4 md:p-6 prose prose-slate prose-sm max-w-none prose-pre:bg-slate-50 prose-pre:text-slate-800 prose-headings:text-slate-800">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    );
  }

  // ── File browser (single column, mobile friendly) ──
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">🧠 记忆库</h1>
            <p className="text-xs text-slate-400 mt-0.5">{totalFiles} 个文件</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              placeholder="搜索记忆..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white transition-colors placeholder:text-slate-300"
            />
          </div>
          <button
            onClick={doSearch}
            className="px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search Results */}
        {(searchResults.length > 0 || searching) && (
          <div className="p-4">
            <p className="text-xs text-slate-400 mb-2">
              {searching ? "搜索中..." : `找到 ${searchResults.length} 条结果`}
            </p>
            <div className="space-y-2">
              {searchResults.map((r, i) => (
                <button
                  key={`${r.file}-${r.lineNum}-${i}`}
                  onClick={() => openFile(r.file)}
                  className="w-full text-left bg-white rounded-lg border border-slate-100 p-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <p className="text-xs font-medium text-slate-700 truncate">{stripMd(getBaseName(r.file))}</p>
                    <span className="text-[10px] text-slate-400 shrink-0">L{r.lineNum}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 pl-5.5">{r.line}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {searchResults.length === 0 && !searching && (
          <div className="p-4 space-y-3">
            {/* Recent files */}
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-1">最近更新</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {recentFiles.map((f) => {
                  const cat = categorizeFile(f.path);
                  const cfg = CATEGORIES[cat];
                  const Icon = cfg.icon;
                  const isToday = getDayKey(f.path) === today;
                  return (
                    <button
                      key={f.path}
                      onClick={() => openFile(f.path)}
                      className="text-left bg-white rounded-lg border border-slate-100 p-3 hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        {isToday && <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-1 py-0.5 font-medium">今天</span>}
                      </div>
                      <p className="text-xs font-medium text-slate-700 truncate">{stripMd(getBaseName(f.path))}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatTime(f.synced_at)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categorized file list */}
            {grouped.map(({ cat, files: catFiles }) => {
              const cfg = CATEGORIES[cat];
              const Icon = cfg.icon;
              const isOpen = expandedCats[cat] ?? false;
              return (
                <div key={cat} className="bg-white rounded-lg border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setExpandedCats((prev) => ({ ...prev, [cat]: !isOpen }))}
                    className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className="flex-1 text-left text-sm font-medium text-slate-700">{cfg.label}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{catFiles.length}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-50">
                      {catFiles.map((f) => {
                        const isToday = getDayKey(f.path) === today;
                        return (
                          <button
                            key={f.path}
                            onClick={() => openFile(f.path)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span className="flex-1 text-xs text-slate-600 truncate">{stripMd(getBaseName(f.path))}</span>
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                            <span className="text-[10px] text-slate-400 shrink-0">{formatTime(f.synced_at)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
