"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ChevronDown, ChevronRight, Clock3 } from "lucide-react";
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

const MONTH_RE = /(\d{4}-\d{2})/;
const DAY_RE = /(\d{4}-\d{2}-\d{2})/;

const getBaseName = (path: string) => path.split("/").pop() || path;
const stripMd = (name: string) => name.replace(/\.md$/i, "");

const getMonthKey = (path: string) => {
  const match = path.match(MONTH_RE);
  return match?.[1] || "Other";
};

const getDayKey = (path: string) => {
  const match = path.match(DAY_RE);
  return match?.[1] || null;
};

const formatTime = (value?: string) => {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
};

export default function MemoryPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | undefined>();
  const [contentLoading, setContentLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => {
        const nextFiles = (d.files || []) as FileEntry[];
        setFiles(nextFiles);

        const months = Array.from(new Set(nextFiles.map((f) => getMonthKey(f.path)))).sort((a, b) =>
          a < b ? 1 : -1,
        );

        setExpandedMonths((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const next: Record<string, boolean> = {};
          months.forEach((month, i) => {
            next[month] = i === 0;
          });
          return next;
        });
      });
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
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    fetch(`/api/memory?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => {
        setSearchResults(d.results || []);
      })
      .finally(() => setSearching(false));
  };

  const today = new Date().toISOString().slice(0, 10);

  const groupedFiles = useMemo(() => {
    const map = new Map<string, FileEntry[]>();

    files
      .filter((f) => !f.isDir)
      .forEach((f) => {
        const month = getMonthKey(f.path);
        if (!map.has(month)) map.set(month, []);
        map.get(month)!.push(f);
      });

    const months = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return months.map((month) => ({
      month,
      files: (map.get(month) || []).sort((a, b) => (a.path < b.path ? 1 : -1)),
    }));
  }, [files]);

  const recentFiles = useMemo(() => {
    return [...files]
      .filter((f) => !f.isDir)
      .sort((a, b) => {
        const ta = a.synced_at ? new Date(a.synced_at).getTime() : 0;
        const tb = b.synced_at ? new Date(b.synced_at).getTime() : 0;
        if (ta !== tb) return tb - ta;
        return a.path < b.path ? 1 : -1;
      })
      .slice(0, 3);
  }, [files]);

  const currentFileMeta = files.find((f) => f.path === currentFile);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <aside className="w-[280px] border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-lg font-semibold">Memory</h1>
          <div className="flex gap-2">
            <Input
              placeholder="Search memory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="text-xs"
            />
            <button onClick={doSearch} className="p-2 hover:bg-muted rounded-md" aria-label="Search memory">
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {searchResults.length > 0 || searching ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">
                {searching ? "Searching..." : `${searchResults.length} results`}
              </p>
              {searchResults.map((r, i) => (
                <button
                  key={`${r.file}-${r.lineNum}-${i}`}
                  onClick={() => openFile(r.file)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs"
                >
                  <p className="font-medium truncate">{stripMd(getBaseName(r.file))}:{r.lineNum}</p>
                  <p className="text-muted-foreground truncate">{r.line}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {groupedFiles.map((group) => {
                const isOpen = expandedMonths[group.month] ?? false;
                return (
                  <div key={group.month}>
                    <button
                      onClick={() => setExpandedMonths((prev) => ({ ...prev, [group.month]: !isOpen }))}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded"
                    >
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="font-medium">{group.month}</span>
                    </button>

                    {isOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        {group.files.map((f) => {
                          const selected = currentFile === f.path;
                          const isToday = getDayKey(f.path) === today;
                          return (
                            <button
                              key={f.path}
                              onClick={() => openFile(f.path)}
                              className={`w-full text-left flex items-center gap-2 pl-4 pr-2 py-1.5 text-xs rounded-r-md transition-colors ${
                                selected
                                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate flex-1">{stripMd(getBaseName(f.path))}</span>
                              {isToday && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
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
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {!currentFile ? (
          <div className="flex-1 p-8 md:p-10">
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">📚 Memory Bank</h2>
                <p className="text-sm text-muted-foreground mt-1">Samantha 的记忆档案库</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {recentFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => openFile(f.path)}
                    className="text-left rounded-lg border border-border p-4 hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium truncate">{stripMd(getBaseName(f.path))}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{f.path}</p>
                    <p className="text-xs text-muted-foreground mt-2">Updated {formatTime(f.synced_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {stripMd(getBaseName(currentFile))}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                <span>
                  Last updated {formatTime(contentUpdatedAt || currentFileMeta?.synced_at)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {contentLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-11/12" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-32 bg-muted rounded w-full mt-4" />
                </div>
              ) : (
                <article className="prose prose-slate max-w-none prose-pre:bg-muted prose-pre:text-foreground">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </article>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
