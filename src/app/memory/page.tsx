"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Folder, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface FileEntry { path: string; name: string; isDir: boolean }
interface SearchResult { file: string; line: string; lineNum: number }

export default function MemoryPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/memory").then((r) => r.json()).then((d) => setFiles(d.files || []));
  }, []);

  const openFile = (path: string) => {
    setCurrentFile(path);
    fetch(`/api/memory?file=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content || d.error || ""));
  };

  const doSearch = () => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearching(true);
    fetch(`/api/memory?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => { setSearchResults(d.results || []); setSearching(false); });
  };

  // Group files by directory
  const dirs = new Map<string, FileEntry[]>();
  const topLevel: FileEntry[] = [];
  files.forEach((f) => {
    if (f.isDir) return;
    const slash = f.path.indexOf("/");
    if (slash === -1) topLevel.push(f);
    else {
      const dir = f.path.slice(0, slash);
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push(f);
    }
  });

  return (
    <div className="flex h-[calc(100vh)] overflow-hidden">
      {/* File browser sidebar */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-lg font-bold">Memory</h1>
          <div className="flex gap-2">
            <Input
              placeholder="Search memory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="text-xs"
            />
            <button onClick={doSearch} className="p-2 hover:bg-muted rounded-md">
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-2">
          {searchResults.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">{searchResults.length} results</p>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => openFile(r.file)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs"
                >
                  <p className="font-medium truncate">{r.file}:{r.lineNum}</p>
                  <p className="text-muted-foreground truncate">{r.line}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {topLevel.map((f) => (
                <button
                  key={f.path}
                  onClick={() => openFile(f.path)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted ${
                    currentFile === f.path ? "bg-muted" : ""
                  }`}
                >
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
              {Array.from(dirs.entries()).map(([dir, dirFiles]) => (
                <div key={dir}>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    <Folder className="h-3 w-3" />
                    <span className="font-medium">{dir}/</span>
                  </div>
                  {dirFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => openFile(f.path)}
                      className={`w-full text-left flex items-center gap-2 pl-6 pr-2 py-1 rounded text-xs hover:bg-muted ${
                        currentFile === f.path ? "bg-muted" : ""
                      }`}
                    >
                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Content viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentFile ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <button onClick={() => setCurrentFile(null)} className="p-1 hover:bg-muted rounded">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Badge variant="outline" className="text-xs font-mono">{currentFile}</Badge>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
