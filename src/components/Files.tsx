import React, { useState, useRef, useCallback } from "react";
import { Plus, Trash2, FolderOpen, File, FileText, Film, Music, Archive, Image as ImageIcon,
         ChevronLeft, Upload, Edit2, Check, X, Download, Search, Grid, List } from "lucide-react";
import { invoke } from "@tauri-apps/api/tauri";
import { useLang } from "../i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileItem {
  id: string;
  name: string;
  filePath: string;
  size: number;
  folderId: string;
  createdAt: number;
  ext: string;
}

interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const FILES_KEY   = "an_files_v1";
const FOLDERS_KEY = "an_file_folders_v1";

function loadFiles(): FileItem[] { try { return JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]"); } catch { return []; } }
function saveFiles(f: FileItem[]) { try { localStorage.setItem(FILES_KEY, JSON.stringify(f)); } catch {} }
function loadFolders(): Folder[] { try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]"); } catch { return []; } }
function saveFolders(f: Folder[]) { try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(f)); } catch {} }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function fmtSize(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024*1024) return (b/1024).toFixed(1) + " KB";
  return (b/1024/1024).toFixed(1) + " MB";
}

// ─── File type helpers ────────────────────────────────────────────────────────

function fileExt(name: string): string { return name.split(".").pop()?.toLowerCase() ?? ""; }
function fileIcon(name: string): React.ReactNode {
  const e = fileExt(name);
  const style = { flexShrink: 0 as const };
  if (["jpg","jpeg","png","gif","webp","svg","heic"].includes(e)) return <ImageIcon size={20} style={style} />;
  if (["mp4","mov","avi","mkv","webm"].includes(e)) return <Film size={20} style={style} />;
  if (["mp3","wav","flac","aac","m4a"].includes(e)) return <Music size={20} style={style} />;
  if (["zip","rar","7z","tar","gz"].includes(e)) return <Archive size={20} style={style} />;
  if (["pdf","doc","docx","txt","md","pages"].includes(e)) return <FileText size={20} style={style} />;
  return <File size={20} style={style} />;
}
function fileColor(name: string): string {
  const e = fileExt(name);
  if (["jpg","jpeg","png","gif","webp","heic","svg"].includes(e)) return "#10b981";
  if (["mp4","mov","avi","mkv"].includes(e)) return "#6366f1";
  if (["mp3","wav","flac","aac"].includes(e)) return "#f59e0b";
  if (["zip","rar","7z"].includes(e)) return "#ef4444";
  if (["pdf"].includes(e)) return "#ef4444";
  if (["doc","docx","pages"].includes(e)) return "#3b82f6";
  if (["ppt","pptx","key"].includes(e)) return "#f97316";
  if (["xls","xlsx","numbers"].includes(e)) return "#22c55e";
  return "#6b7280";
}

const FOLDER_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

// ─── FileCard ─────────────────────────────────────────────────────────────────

const FileCard: React.FC<{
  file: FileItem;
  view: "grid" | "list";
  onDelete: () => void;
}> = ({ file, view, onDelete }) => {
  const color = fileColor(file.name);
  const [pressed, setPressed] = React.useState(false);

  const handleOpen = async () => {
    if (!file.filePath) return;
    try {
      await invoke("open_file_native", { path: file.filePath });
    } catch (e) { console.error("[Files] open failed:", e); }
  };

  const clickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = React.useRef(0);
  const handleClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current >= 2) handleOpen();
      clickCountRef.current = 0;
    }, 280);
  };

  if (view === "list") {
    return (
      <div className="group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
        style={{ background: pressed ? "var(--c-elevated)" : "var(--c-surface)", border: `1px solid ${pressed ? "var(--c-accent)40" : "var(--c-border)"}`, cursor: "pointer", transform: pressed ? "scale(0.99)" : "scale(1)", transition: "all 0.1s" }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onClick={handleClick}>
        <div style={{ color, flexShrink: 0 }}>{fileIcon(file.name)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-500 truncate" style={{ color: "var(--c-text-1)" }}>{file.name}</p>
          <p className="text-[11px]" style={{ color: "var(--c-text-4)" }}>
            {fileExt(file.name).toUpperCase()} · {fmtSize(file.size)} · {new Date(file.createdAt).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-xl transition-all"
            style={{ color: "var(--c-text-4)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
      style={{ background: pressed ? "var(--c-elevated)" : "var(--c-surface)", border: `1px solid ${pressed ? "var(--c-accent)40" : "var(--c-border)"}`, cursor: "pointer", transform: pressed ? "scale(0.97)" : "scale(1)", transition: "all 0.1s" }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={handleClick}>
      {/* File icon big */}
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl"
        style={{ background: color + "18" }}>
        <div style={{ color }}>{React.cloneElement(fileIcon(file.name) as React.ReactElement, { size: 28 })}</div>
      </div>
      <p className="text-[12px] font-500 text-center w-full truncate" style={{ color: "var(--c-text-1)" }}>{file.name}</p>
      <p className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{fmtSize(file.size)}</p>
      {/* Hover controls */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
        <button onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center rounded-lg"
          style={{ background: "#f43f5e22", color: "#f43f5e", border: "none", cursor: "pointer" }}>
          <Trash2 size={11} />
        </button>
      </div>
      {/* Double-click hint */}
      <p className="text-[9px] opacity-0 group-hover:opacity-100 transition-all select-none"
        style={{ color: "var(--c-text-4)" }}>дв. клик — открыть</p>
    </div>
  );
};

// ─── Main Files component ─────────────────────────────────────────────────────

export const Files: React.FC = () => {
  useLang();
  const [files,   setFiles]   = useState<FileItem[]>(() => loadFiles());
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [view,   setView]     = useState<"grid" | "list">("grid");
  const [dragging, setDragging] = useState(false);
  const [editId,   setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const currentFolder = folders.find(f => f.id === activeFolder);

  const visibleFiles = files.filter(f => {
    const inFolder = activeFolder ? f.folderId === activeFolder : true;
    const matchSearch = !search.trim() || f.name.toLowerCase().includes(search.toLowerCase());
    return inFolder && matchSearch;
  });

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const folderId = activeFolder ?? "";
    for (const file of Array.from(fileList)) {
      try {
        const buf   = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buf));
        const filePath = await invoke<string>("save_attachment", {
          noteId: "files_" + (folderId || "root"),
          fileName: file.name,
          data: bytes,
        });
        const item: FileItem = {
          id: uid(), name: file.name, filePath,
          size: file.size, folderId,
          createdAt: Date.now(),
          ext: fileExt(file.name),
        };
        setFiles(prev => { const next = [item, ...prev]; saveFiles(next); return next; });
      } catch (e) { console.error("Upload failed:", e); }
    }
  }, [activeFolder]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Folders ───────────────────────────────────────────────────────────────────

  const createFolder = () => {
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    const f: Folder = { id: uid(), name: `Папка ${folders.length + 1}`, color, createdAt: Date.now() };
    const next = [...folders, f]; setFolders(next); saveFolders(next);
    setActiveFolder(f.id);
  };

  const deleteFolder = (id: string) => {
    const next = folders.filter(f => f.id !== id); setFolders(next); saveFolders(next);
    const nextFiles = files.filter(f => f.folderId !== id); setFiles(nextFiles); saveFiles(nextFiles);
    if (activeFolder === id) setActiveFolder(null);
  };

  const renameFolder = (id: string, name: string) => {
    const next = folders.map(f => f.id === id ? { ...f, name } : f);
    setFolders(next); saveFolders(next); setEditId(null);
  };

  const deleteFile = async (id: string) => {
    const file = files.find(f => f.id === id);
    if (file?.filePath) {
      try { await invoke("delete_attachment", { path: file.filePath }); } catch {}
    }
    const next = files.filter(f => f.id !== id); setFiles(next); saveFiles(next);
  };

  return (
    <div className="flex h-full" style={{ background: "var(--c-bg)" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* ── Sidebar ── */}
      <aside className="flex flex-col h-full border-r flex-shrink-0"
        style={{ width: 220, background: "var(--c-surface)", borderColor: "var(--c-border-sub)" }}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b"
          style={{ borderColor: "var(--c-border-sub)" }}>
          <span className="text-[13px] font-600 select-none" style={{ color: "var(--c-text-2)" }}>Файлы</span>
          <button onClick={createFolder}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-white active:scale-90 transition-all"
            style={{ background: "var(--c-accent)" }}>
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* All files */}
        <button onClick={() => setActiveFolder(null)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] transition-all"
          style={{
            background: activeFolder === null ? "var(--c-elevated)" : "transparent",
            color: activeFolder === null ? "var(--c-text-1)" : "var(--c-text-3)",
            borderLeft: activeFolder === null ? "2px solid var(--c-accent)" : "2px solid transparent",
          }}>
          <Grid size={13} />
          <span>Все файлы</span>
          <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{files.length}</span>
        </button>

        <div className="flex-1 overflow-y-auto">
          {folders.map(folder => {
            const count = files.filter(f => f.folderId === folder.id).length;
            const isActive = activeFolder === folder.id;
            return (
              <div key={folder.id} className="group relative">
                {editId === folder.id ? (
                  <div className="flex items-center gap-1 px-3 py-2">
                    <input autoFocus value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") renameFolder(folder.id, editName || folder.name);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="flex-1 bg-transparent text-[12px] outline-none border-b text-select"
                      style={{ color: "var(--c-text-1)", borderColor: "var(--c-accent)" }}
                    />
                    <button onClick={() => renameFolder(folder.id, editName || folder.name)}
                      style={{ color: "var(--c-accent)", background: "none", border: "none", cursor: "pointer" }}>
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setActiveFolder(folder.id)}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] transition-all"
                    style={{
                      background: isActive ? "var(--c-elevated)" : "transparent",
                      color: isActive ? "var(--c-text-1)" : "var(--c-text-3)",
                      borderLeft: isActive ? `2px solid ${folder.color}` : "2px solid transparent",
                    }}>
                    <FolderOpen size={13} style={{ color: folder.color }} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{count}</span>
                  </button>
                )}
                {editId !== folder.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                    <button onClick={e => { e.stopPropagation(); setEditId(folder.id); setEditName(folder.name); }}
                      className="w-5 h-5 flex items-center justify-center rounded"
                      style={{ color: "var(--c-text-4)", background: "var(--c-elevated)", border: "none", cursor: "pointer" }}>
                      <Edit2 size={9} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }}
                      className="w-5 h-5 flex items-center justify-center rounded"
                      style={{ color: "var(--c-text-4)", background: "var(--c-elevated)", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>
                      <Trash2 size={9} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upload button */}
        <div className="p-3 border-t" style={{ borderColor: "var(--c-border-sub)" }}>
          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-2xl text-[12px] font-500 transition-all active:scale-95"
            style={{ background: "var(--c-accent)", color: "#fff" }}>
            <Upload size={13} />Загрузить
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--c-border-sub)" }}>
          {activeFolder && (
            <button onClick={() => setActiveFolder(null)}
              style={{ color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer" }}>
              <ChevronLeft size={18} />
            </button>
          )}
          <div style={{ width: 10, height: 10, borderRadius: "50%",
            background: currentFolder?.color ?? "var(--c-accent)", flexShrink: 0 }} />
          <h1 className="text-[17px] font-700"
            style={{ color: "var(--c-text-1)", fontFamily: "'Syne', sans-serif" }}>
            {activeFolder ? (currentFolder?.name ?? "Папка") : "Все файлы"}
          </h1>
          <span className="text-[12px] font-mono" style={{ color: "var(--c-text-4)" }}>
            {visibleFiles.length} файлов
          </span>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl ml-4"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", flex: 1, maxWidth: 260 }}>
            <Search size={12} style={{ color: "var(--c-text-4)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск файлов…"
              className="bg-transparent text-[12px] outline-none w-full text-select"
              style={{ color: "var(--c-text-2)" }} />
            {search && <button onClick={() => setSearch("")}
              style={{ color: "var(--c-text-4)", background: "none", border: "none", cursor: "pointer" }}>
              <X size={11} />
            </button>}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-xl p-1 ml-auto"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ background: view === v ? "var(--c-accent)" : "transparent", color: view === v ? "#fff" : "var(--c-text-3)", border: "none", cursor: "pointer" }}>
                {v === "grid" ? <Grid size={13} /> : <List size={13} />}
              </button>
            ))}
          </div>

          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-500 transition-all active:scale-95"
            style={{ background: "var(--c-accent)", color: "#fff" }}>
            <Plus size={13} />Добавить
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {dragging && (
            <div className="absolute inset-4 z-50 flex items-center justify-center rounded-2xl"
              style={{ background: "var(--c-accent)12", border: "3px dashed var(--c-accent)" }}>
              <div className="text-center">
                <Upload size={36} style={{ color: "var(--c-accent)", margin: "0 auto" }} />
                <p className="text-[15px] font-600 mt-3" style={{ color: "var(--c-accent)" }}>
                  Отпусти чтобы загрузить
                </p>
              </div>
            </div>
          )}

          {visibleFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
              <div className="w-20 h-20 flex items-center justify-center rounded-3xl"
                style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                <File size={32} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
              </div>
              <p className="text-[15px] font-600" style={{ color: "var(--c-text-2)" }}>
                {search ? "Файлы не найдены" : "Нет файлов"}
              </p>
              <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>
                Перетащи файлы или нажми «Добавить»
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="p-6 grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {visibleFiles.map(file => (
                <FileCard key={file.id} file={file} view="grid"
                  onDelete={() => deleteFile(file.id)} />
              ))}
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-2">
              {visibleFiles.map(file => (
                <FileCard key={file.id} file={file} view="list"
                  onDelete={() => deleteFile(file.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
