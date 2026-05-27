import React, { useState, useRef, useCallback } from "react";
import { Plus, FolderOpen, Trash2, Image as ImageIcon, X, Grid, ChevronLeft, Upload, Edit2, Check } from "lucide-react";
import { useLang } from "../i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  folderId: string;
  createdAt: number;
  width?: number;
  height?: number;
}

interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const IMGS_KEY    = "an_images_v1";
const FOLDERS_KEY = "an_img_folders_v1";

function loadImages(): ImageItem[] { try { return JSON.parse(localStorage.getItem(IMGS_KEY) ?? "[]"); } catch { return []; } }
function saveImages(i: ImageItem[]) { try { localStorage.setItem(IMGS_KEY, JSON.stringify(i)); } catch {} }
function loadFolders(): Folder[] { try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]"); } catch { return []; } }
function saveFolders(f: Folder[]) { try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(f)); } catch {} }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

const FOLDER_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

// ─── Main component ───────────────────────────────────────────────────────────

export const Images: React.FC = () => {
  useLang();
  const [images,  setImages]  = useState<ImageItem[]>(() => loadImages());
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ImageItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeImages = activeFolder
    ? images.filter(i => i.folderId === activeFolder)
    : images;

  // ── File upload ──────────────────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const targetFolder = activeFolder ?? (folders[0]?.id ?? "");

    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          const item: ImageItem = {
            id: uid(), name: file.name, dataUrl,
            folderId: targetFolder,
            createdAt: Date.now(),
            width: img.width, height: img.height,
          };
          setImages(prev => { const next = [item, ...prev]; saveImages(next); return next; });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }, [activeFolder, folders]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Folder ops ───────────────────────────────────────────────────────────────

  const createFolder = () => {
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    const folder: Folder = { id: uid(), name: `Папка ${folders.length + 1}`, color, createdAt: Date.now() };
    const next = [...folders, folder]; setFolders(next); saveFolders(next);
    setActiveFolder(folder.id);
  };

  const deleteFolder = (id: string) => {
    const next = folders.filter(f => f.id !== id); setFolders(next); saveFolders(next);
    const imgs = images.filter(i => i.folderId !== id); setImages(imgs); saveImages(imgs);
    if (activeFolder === id) setActiveFolder(null);
  };

  const renameFolder = (id: string, name: string) => {
    const next = folders.map(f => f.id === id ? { ...f, name } : f);
    setFolders(next); saveFolders(next);
    setEditFolderId(null);
  };

  const deleteImage = (id: string) => {
    const next = images.filter(i => i.id !== id); setImages(next); saveImages(next);
    if (lightbox?.id === id) setLightbox(null);
  };

  const currentFolder = folders.find(f => f.id === activeFolder);

  return (
    <div className="flex h-full" style={{ background: "var(--c-bg)" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* ── Sidebar ── */}
      <aside className="flex flex-col h-full border-r flex-shrink-0" style={{ width: 220, background: "var(--c-surface)", borderColor: "var(--c-border-sub)" }}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
          <span className="text-[13px] font-600 select-none" style={{ color: "var(--c-text-2)" }}>Галерея</span>
          <button onClick={createFolder} className="w-7 h-7 flex items-center justify-center rounded-xl text-white active:scale-90 transition-all" style={{ background: "var(--c-accent)" }}>
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* All images */}
        <button onClick={() => setActiveFolder(null)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] transition-all"
          style={{ background: activeFolder === null ? "var(--c-elevated)" : "transparent", color: activeFolder === null ? "var(--c-text-1)" : "var(--c-text-3)", borderLeft: activeFolder === null ? "2px solid var(--c-accent)" : "2px solid transparent" }}>
          <Grid size={13} />
          <span>Все фото</span>
          <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{images.length}</span>
        </button>

        <div className="flex-1 overflow-y-auto">
          {folders.map(folder => {
            const count = images.filter(i => i.folderId === folder.id).length;
            const isActive = activeFolder === folder.id;
            return (
              <div key={folder.id} className="group relative">
                {editFolderId === folder.id ? (
                  <div className="flex items-center gap-1 px-3 py-2">
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") renameFolder(folder.id, editName || folder.name); if (e.key === "Escape") setEditFolderId(null); }}
                      className="flex-1 bg-transparent text-[12px] outline-none text-select border-b"
                      style={{ color: "var(--c-text-1)", borderColor: "var(--c-accent)" }} />
                    <button onClick={() => renameFolder(folder.id, editName || folder.name)}
                      style={{ color: "var(--c-accent)", background: "none", border: "none", cursor: "pointer" }}>
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setActiveFolder(folder.id)}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] transition-all"
                    style={{ background: isActive ? "var(--c-elevated)" : "transparent", color: isActive ? "var(--c-text-1)" : "var(--c-text-3)", borderLeft: isActive ? `2px solid ${folder.color}` : "2px solid transparent" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: folder.color, flexShrink: 0, display: "inline-block" }} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{count}</span>
                  </button>
                )}
                {!editFolderId && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                    <button onClick={e => { e.stopPropagation(); setEditFolderId(folder.id); setEditName(folder.name); }}
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
          <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
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
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
          {activeFolder && (
            <button onClick={() => setActiveFolder(null)} style={{ color: "var(--c-text-3)", background: "none", border: "none", cursor: "pointer" }}>
              <ChevronLeft size={18} />
            </button>
          )}
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: currentFolder?.color ?? "var(--c-accent)", flexShrink: 0 }} />
          <h1 className="text-[17px] font-700" style={{ color: "var(--c-text-1)", fontFamily: "'Syne', sans-serif" }}>
            {activeFolder ? (currentFolder?.name ?? "Папка") : "Все фотографии"}
          </h1>
          <span className="text-[12px] font-mono" style={{ color: "var(--c-text-4)" }}>
            {activeImages.length} фото
          </span>
          <div className="ml-auto">
            <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
            <button onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-500 transition-all active:scale-95"
              style={{ background: "var(--c-accent)", color: "#fff" }}>
              <Plus size={13} />Добавить
            </button>
          </div>
        </div>

        {/* Drop zone / grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {dragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "var(--c-accent)18", border: "3px dashed var(--c-accent)", borderRadius: 16, margin: 16 }}>
              <div className="text-center">
                <Upload size={40} style={{ color: "var(--c-accent)", margin: "0 auto" }} />
                <p className="text-[16px] font-600 mt-3" style={{ color: "var(--c-accent)" }}>Отпусти чтобы загрузить</p>
              </div>
            </div>
          )}

          {activeImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
              <div className="w-20 h-20 flex items-center justify-center rounded-3xl" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                <ImageIcon size={32} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
              </div>
              <p className="text-[15px] font-600" style={{ color: "var(--c-text-2)" }}>Нет фотографий</p>
              <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>Перетащи файлы или нажми «Добавить»</p>
            </div>
          ) : (
            <div className="p-6" style={{ columns: "auto", columnWidth: 220, columnGap: 12 }}>
              {activeImages.map(img => (
                <div key={img.id} className="group relative mb-3 break-inside-avoid cursor-zoom-in"
                  style={{ borderRadius: 16, overflow: "hidden", background: "var(--c-surface)" }}
                  onClick={() => setLightbox(img)}>
                  <img src={img.dataUrl} alt={img.name}
                    className="w-full block transition-transform duration-300 group-hover:scale-105"
                    style={{ display: "block" }} />
                  {/* Overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-3"
                    style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6))" }}>
                    <button onClick={e => { e.stopPropagation(); deleteImage(img.id); }}
                      className="self-end w-7 h-7 flex items-center justify-center rounded-xl transition-all"
                      style={{ background: "#f43f5e22", color: "#f43f5e", border: "none", cursor: "pointer" }}>
                      <Trash2 size={12} />
                    </button>
                    <p className="text-[11px] truncate" style={{ color: "#fff", opacity: 0.8 }}>{img.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
          <img src={lightbox.dataUrl} alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12 }} />
          <p className="absolute bottom-4 text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            {lightbox.name} {lightbox.width && `· ${lightbox.width}×${lightbox.height}`}
          </p>
        </div>
      )}
    </div>
  );
};
