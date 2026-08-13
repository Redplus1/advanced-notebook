import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Plus, Trash2, Image as ImageIcon, X, Grid, ChevronLeft, Upload, Edit2, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/tauri";
import { useLang } from "../i18n";
import { readJSON, writeJSON } from "../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageItem {
  id: string;
  name: string;
  /** Path on disk (AppData/attachments/…). The actual image lives here, NOT in localStorage. */
  filePath: string;
  /** Resolved URL for <img src> — held in memory only, never persisted to localStorage. */
  dataUrl?: string;
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

function loadImages(): ImageItem[] { return readJSON<ImageItem[]>(IMGS_KEY, []); }
// Persist METADATA ONLY. The image itself lives on disk (filePath). Stripping the heavy
// base64 dataUrl is what prevents the localStorage quota overflow that silently dropped photos.
function saveImages(i: ImageItem[]) {
  const slim = i.map(img => img.filePath ? { ...img, dataUrl: undefined } : img);
  writeJSON(IMGS_KEY, slim);
}
function loadFolders(): Folder[] { return readJSON<Folder[]>(FOLDERS_KEY, []); }
function saveFolders(f: Folder[]) { writeJSON(FOLDERS_KEY, f); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// ─── Disk <-> data-url helpers ──────────────────────────────────────────────────

function mimeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png")  return "image/png";
  if (ext === "gif")  return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg")  return "image/svg+xml";
  if (ext === "bmp")  return "image/bmp";
  return "image/jpeg";
}
function bytesToDataUrl(bytes: number[], name: string): string {
  const arr = new Uint8Array(bytes); let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return `data:${mimeFor(name)};base64,${btoa(binary)}`;
}
function dataUrlToBytes(dataUrl: string): number[] {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const FOLDER_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

// Resolved data-urls survive tab switches (the component unmounts/remounts), so returning
// to the Photos tab shows already-loaded pictures instantly instead of re-reading from disk.
const urlCache = new Map<string, string>();

// Hydrate freshly-loaded metadata with any data-url we already resolved this session.
function hydrate(list: ImageItem[]): ImageItem[] {
  return list.map(img =>
    img.dataUrl ? img
    : img.filePath && urlCache.has(img.filePath) ? { ...img, dataUrl: urlCache.get(img.filePath) }
    : img
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const Images: React.FC = () => {
  useLang();
  const [images,  setImages]  = useState<ImageItem[]>(() => hydrate(loadImages()));
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ImageItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeImages = useMemo(() =>
    activeFolder ? images.filter(i => i.folderId === activeFolder) : images,
    [images, activeFolder]
  );

  // Per-folder image counts — computed once, not inside the map
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const img of images) {
      counts[img.folderId] = (counts[img.folderId] ?? 0) + 1;
    }
    return counts;
  }, [images]);

  // ── Load from disk + migrate legacy base64 images ──────────────────────────────
  // On mount, resolve every image's <img src> from its on-disk file. Legacy items that
  // were stored as base64 in localStorage (and could be silently dropped on quota
  // overflow) are migrated onto disk once, then their base64 is freed from localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = hydrate(loadImages());
      if (list.length === 0) return;
      let changed = false;

      const resolved = await Promise.all(list.map(async img => {
        // Already has a usable URL in memory (incl. cache hits from a previous visit).
        if (img.dataUrl && img.filePath) return img;

        // Legacy item: base64 in localStorage but never written to disk → migrate it.
        if (img.dataUrl && !img.filePath) {
          try {
            const filePath = await invoke<string>("save_attachment", {
              noteId: "images_" + (img.folderId || "root"),
              fileName: img.name,
              subDir: img.id,
              data: dataUrlToBytes(img.dataUrl),
            });
            changed = true;
            if (img.dataUrl) urlCache.set(filePath, img.dataUrl);
            return { ...img, filePath };
          } catch { return img; }
        }

        // Normal item: read the picture back from disk into memory for display.
        if (img.filePath) {
          try {
            const bytes = await invoke<number[]>("read_attachment", { path: img.filePath });
            const dataUrl = bytesToDataUrl(bytes, img.name);
            urlCache.set(img.filePath, dataUrl);
            return { ...img, dataUrl };
          } catch { return img; }
        }
        return img;
      }));

      if (cancelled) return;
      setImages(resolved);
      // Re-persist so migrated items drop their base64 from localStorage for good.
      if (changed) saveImages(resolved);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Same rule as the Files tab: an upload belongs to the folder you are
    // actually looking at, and to no folder at all when you are in "Все фото".
    // Falling back to `folders[0]` filed the photo into the first folder
    // instead, so it showed up both under "Все фото" and inside a folder the
    // user never opened — which reads as the gallery duplicating the photo.
    const targetFolder = activeFolder ?? "";

    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      // Generated up front so it can name the photo's own folder on disk.
      const itemId = uid();
      const reader = new FileReader();
      reader.onload = async e => {
        const dataUrl = e.target?.result as string;
        // Persist the image bytes to disk (AppData/attachments) so it survives reloads
        // and never inflates localStorage. Metadata-only goes to localStorage.
        let filePath = "";
        try {
          const buf = await file.arrayBuffer();
          filePath = await invoke<string>("save_attachment", {
            noteId: "images_" + (targetFolder || "root"),
            fileName: file.name,
            // Own folder per photo: two different pictures with the same
            // filename used to overwrite each other in the same gallery folder.
            subDir: itemId,
            data: Array.from(new Uint8Array(buf)),
          });
        } catch (err) { console.error("[Images] save_attachment failed:", err); }

        if (filePath) urlCache.set(filePath, dataUrl);
        const img = new window.Image();
        img.onload = () => {
          const item: ImageItem = {
            id: itemId, name: file.name, filePath, dataUrl,
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
  }, [activeFolder]);

  // A drag only counts as an import when it carries real files from outside the
  // app. Dragging a photo around inside the gallery also lands here, and
  // Chromium hands the dragged <img> over as a file — so the gallery re-imported
  // the picture the user was merely moving, and a duplicate appeared. Photos are
  // no longer draggable (see the grid below), and this is the second guard.
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (!e.dataTransfer.types.includes("Files")) return;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }, []);

  // ── Folder ops ───────────────────────────────────────────────────────────────

  const createFolder = () => {
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    const folder: Folder = { id: uid(), name: `Папка ${folders.length + 1}`, color, createdAt: Date.now() };
    const next = [...folders, folder]; setFolders(next); saveFolders(next);
    setActiveFolder(folder.id);
  };

  const deleteFolder = (id: string) => {
    const next = folders.filter(f => f.id !== id); setFolders(next); saveFolders(next);
    // Remove the folder's images from disk too, so nothing is orphaned in AppData.
    images.filter(i => i.folderId === id).forEach(i => {
      if (i.filePath) { urlCache.delete(i.filePath); invoke("delete_attachment", { path: i.filePath }).catch(() => {}); }
    });
    const imgs = images.filter(i => i.folderId !== id); setImages(imgs); saveImages(imgs);
    if (activeFolder === id) setActiveFolder(null);
  };

  const renameFolder = (id: string, name: string) => {
    const next = folders.map(f => f.id === id ? { ...f, name } : f);
    setFolders(next); saveFolders(next);
    setEditFolderId(null);
  };

  const deleteImage = (id: string) => {
    const target = images.find(i => i.id === id);
    if (target?.filePath) { urlCache.delete(target.filePath); invoke("delete_attachment", { path: target.filePath }).catch(() => {}); }
    const next = images.filter(i => i.id !== id); setImages(next); saveImages(next);
    if (lightbox?.id === id) setLightbox(null);
  };

  const currentFolder = folders.find(f => f.id === activeFolder);

  return (
    <div className="flex h-full" style={{ background: "var(--c-bg)" }}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* One shared picker for both upload buttons. There used to be two inputs
          carrying the same ref, so the ref only ever pointed at the last one.
          Clearing the value afterwards lets the same file be picked twice in a
          row — otherwise onChange never fires the second time. */}
      <input
        ref={inputRef} type="file" multiple accept="image/*" className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
      />
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
            const count = folderCounts[folder.id] ?? 0;
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
                  onClick={() => img.dataUrl && setLightbox(img)}>
                  {img.dataUrl ? (
                    <img src={img.dataUrl} alt=""
                      draggable={false}
                      onDragStart={e => e.preventDefault()}
                      className="w-full block transition-transform duration-300 group-hover:scale-105"
                      style={{ display: "block" }} />
                  ) : (
                    // Skeleton while the picture loads from disk — keeps the slot's size
                    // (no layout jump) and never shows the raw file name.
                    <div className="w-full flex items-center justify-center animate-pulse"
                      style={{
                        aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : "4 / 3",
                        background: "var(--c-elevated)",
                      }}>
                      <ImageIcon size={24} strokeWidth={1.5} style={{ color: "var(--c-text-4)", opacity: 0.4 }} />
                    </div>
                  )}
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
            draggable={false}
            onDragStart={e => e.preventDefault()}
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
