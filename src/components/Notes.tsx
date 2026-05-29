import React, { useState, useEffect, useRef, useCallback, useMemo, memo, useDeferredValue } from "react";
import { Plus, Trash2, Search, X, FileText, Hash, Check, Loader2, Highlighter, Type, Paperclip, Image as ImageIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/tauri";
import { t, useLang } from "../i18n";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Note { id: string; title: string; content: string; tags: string; createdAt: number; updatedAt: number; }
interface HighlightRange { start: number; end: number; color: string; }
interface FormatRange { start: number; end: number; format: "bold" | "italic" | "bold-italic"; }

// ─── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "an_notes_v2";
const ATTACH_KEY  = "an_note_attachments_v1";

interface Attachment { id: string; noteId: string; name: string; filePath: string; thumbUrl: string; x: number; y: number; w: number; }
function loadAttachments(): Record<string, Attachment[]> { try { return JSON.parse(localStorage.getItem(ATTACH_KEY) ?? "{}"); } catch { return {}; } }
function saveAttachments(a: Record<string, Attachment[]>) { try { localStorage.setItem(ATTACH_KEY, JSON.stringify(a)); } catch {} }

function bytesToDataUrl(bytes: number[], mimeType = "image/jpeg"): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  arr.forEach(b => binary += String.fromCharCode(b));
  return `data:${mimeType};base64,${btoa(binary)}`;
}
function bytesToUrl(bytes: number[], name = ""): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const imageExts = ["jpg","jpeg","png","gif","webp","svg","bmp","heic"];
  if (imageExts.includes(ext)) {
    const mime = ext === "svg" ? "image/svg+xml" : ext === "gif" ? "image/gif" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return bytesToDataUrl(bytes, mime);
  }
  return "";
}

const HL_KEY  = "an_highlights_v1";
const FMT_KEY = "an_formats_v1";

function loadNotes(): Note[] { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveNotes(n: Note[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)); } catch {} }
function loadHL(): Record<string, HighlightRange[]> { try { const r = localStorage.getItem(HL_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function saveHL(h: Record<string, HighlightRange[]>) { try { localStorage.setItem(HL_KEY, JSON.stringify(h)); } catch {} }
function loadFmt(): Record<string, FormatRange[]> { try { const r = localStorage.getItem(FMT_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function saveFmt(f: Record<string, FormatRange[]>) { try { localStorage.setItem(FMT_KEY, JSON.stringify(f)); } catch {} }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// Stable empty arrays — prevent useMemo from firing when there's no data
const EMPTY_HL: HighlightRange[] = [];
const EMPTY_FMT: FormatRange[] = [];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relDate(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return t("just_now");
  if (s < 60) return `${s}${t("time_s")} ${t("ago")}`;
  if (s < 3600) return `${Math.floor(s / 60)}${t("time_m")} ${t("ago")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${t("time_h")} ${t("ago")}`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ─── Highlight colors ──────────────────────────────────────────────────────────

const COLORS = [
  { id: "yellow", label: "Жёлтый" }, { id: "green", label: "Зелёный" },
  { id: "blue", label: "Синий" },    { id: "pink", label: "Розовый" },
  { id: "orange", label: "Оранжевый" }, { id: "purple", label: "Фиолетовый" },
] as const;
type HColor = typeof COLORS[number]["id"];
const hBg   = (id: string) => `var(--hl-${id}-bg)`;
const hText = (id: string) => `var(--hl-${id}-text)`;
const hDot  = (id: string) => `var(--hl-${id}-dot)`;

const WIDTH_PRESETS = [600, 720, 900];
const WIDTH_LABELS  = ["Compact", "Normal", "Wide"];

// ─── renderWithFormats ─────────────────────────────────────────────────────────

function renderWithFormats(text: string, hls: HighlightRange[], fmts: FormatRange[]): React.ReactNode[] {
  if (!hls.length && !fmts.length) return [<span key="t" style={{ whiteSpace: "pre-wrap" }}>{text}</span>];
  type Ann = { hl?: string; bold?: boolean; italic?: boolean };
  const ann: Ann[] = Array.from({ length: text.length }, () => ({}));
  for (const r of hls) {
    if (r.start >= text.length) continue;
    for (let i = r.start; i < Math.min(r.end, text.length); i++) ann[i] = { ...ann[i], hl: r.color };
  }
  for (const r of fmts) {
    if (r.start >= text.length) continue;
    for (let i = r.start; i < Math.min(r.end, text.length); i++) {
      if (r.format === "bold" || r.format === "bold-italic") ann[i] = { ...ann[i], bold: true };
      if (r.format === "italic" || r.format === "bold-italic") ann[i] = { ...ann[i], italic: true };
    }
  }
  const nodes: React.ReactNode[] = [];
  let key = 0, i = 0;
  while (i < text.length) {
    const a = ann[i]; let j = i + 1;
    while (j < text.length) { const b = ann[j]; if (b.hl === a.hl && b.bold === a.bold && b.italic === a.italic) j++; else break; }
    const chunk = text.slice(i, j);
    const style: React.CSSProperties = {
      whiteSpace: "pre-wrap",
      ...(a.hl ? { background: hBg(a.hl), color: hText(a.hl), borderRadius: 3, padding: "1px 3px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : {}),
      ...(a.bold ? { fontWeight: 700 } : {}),
      ...(a.italic ? { fontStyle: "italic" } : {}),
    };
    nodes.push(a.hl ? <mark key={key++} style={style}>{chunk}</mark> : <span key={key++} style={style}>{chunk}</span>);
    i = j;
  }
  return nodes;
}

// ─── Save badge ────────────────────────────────────────────────────────────────

const SaveBadge: React.FC<{ dirty: boolean; saving: boolean }> = ({ dirty, saving }) => {
  const style: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 10, fontFamily: "monospace", userSelect: "none", whiteSpace: "nowrap", width: 60 };
  if (saving) return <span style={{ ...style, color: "var(--c-text-4)" }}><Loader2 size={9} className="animate-spin" />{t("saving")}</span>;
  if (!dirty) return <span style={{ ...style, color: "var(--c-accent)" }}><Check size={9} strokeWidth={3} />{t("saved")}</span>;
  return <span style={{ ...style }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} /></span>;
};

// ─── TagRow ────────────────────────────────────────────────────────────────────

const TagRow: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [input, setInput] = useState("");
  const list = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const commit = () => {
    const tag = input.trim().replace(/^#/, "");
    if (!tag || list.includes(tag)) { setInput(""); return; }
    onChange([...list, tag].join(",")); setInput("");
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
      <Hash size={11} style={{ color: "var(--c-text-4)", flexShrink: 0 }} />
      {list.map(tag => (
        <span key={tag} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", background: "var(--c-accent)18", border: "1px solid var(--c-accent)30", color: "var(--c-accent)" }}>
          {tag}<button onClick={() => onChange(list.filter(x => x !== tag).join(","))} style={{ opacity: 0.5, cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit" }}><X size={9} /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); commit(); } if (e.key === "Backspace" && !input && list.length > 0) onChange(list.slice(0, -1).join(",")); }}
        onBlur={commit} placeholder={list.length === 0 ? t("add_tag") : ""}
        className="bg-transparent text-[11px] outline-none min-w-[70px] text-select" style={{ color: "var(--c-text-3)" }} />
    </div>
  );
};

// ─── NoteItem — stable callbacks via id, not inline closures ────────────────────

const NoteItem = memo<{ note: Note; active: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void }>(
  ({ note, active, onSelect, onDelete }) => {
    const preview = note.content.replace(/\s+/g, " ").trim().slice(0, 75);
    const tags = note.tags ? note.tags.split(",").filter(s => s.trim()).slice(0, 2) : [];
    return (
      <div onClick={() => onSelect(note.id)} className="group relative flex flex-col gap-1 px-4 py-3 cursor-pointer border-b transition-all duration-100"
        style={{ borderColor: "var(--c-border-sub)", background: active ? "var(--c-elevated)" : "transparent" }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--c-elevated)88"; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
        {active && <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: "var(--c-accent)" }} />}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12.5px] font-500 leading-snug truncate" style={{ color: active ? "var(--c-text-1)" : "var(--c-text-2)" }}>
            {note.title || <span className="italic font-400" style={{ color: "var(--c-text-4)" }}>{t("untitled")}</span>}
          </p>
          <button onClick={e => { e.stopPropagation(); onDelete(note.id); }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
            style={{ color: "var(--c-text-4)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>
            <Trash2 size={11} />
          </button>
        </div>
        {preview && <p className="text-[11px] leading-relaxed" style={{ color: "var(--c-text-3)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview}</p>}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            {tags.map(tag => <span key={tag} className="text-[9.5px] font-mono px-1.5 py-px rounded-full" style={{ color: "var(--c-accent)", background: "var(--c-accent)14", border: "1px solid var(--c-accent)25" }}>#{tag.trim()}</span>)}
          </div>
          <span className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{relDate(note.updatedAt)}</span>
        </div>
      </div>
    );
  }
);

// ─── NotesSidebarPanel — memoized: never re-renders while user is typing ────────

const NotesSidebarPanel = memo<{
  width: number;
  noteCount: number;
  search: string;
  filtered: Note[];
  selectedId: string | null;
  onSearch: React.Dispatch<React.SetStateAction<string>>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}>(({ width, noteCount, search, filtered, selectedId, onSearch, onSelect, onDelete, onCreate }) => (
  <aside className="flex flex-col h-full border-r"
    style={{ width, minWidth: 160, maxWidth: 400, background: "var(--c-surface)", borderColor: "var(--c-border-sub)", flexShrink: 0 }}>
    <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
      <span className="text-[13px] font-600 select-none" style={{ color: "var(--c-text-2)" }}>{t("notes")}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>{noteCount}</span>
        <button onClick={onCreate} className="flex items-center justify-center w-7 h-7 rounded-xl active:scale-90 text-white transition-all" style={{ background: "var(--c-accent)" }}>
          <Plus size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
    <div className="p-3 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
        <Search size={11} style={{ color: "var(--c-text-4)", flexShrink: 0 }} />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t("search")}
          className="bg-transparent text-[12px] outline-none w-full text-select" style={{ color: "var(--c-text-2)" }} />
        {search && <button onClick={() => onSearch("")} style={{ color: "var(--c-text-4)", background: "none", border: "none", cursor: "pointer" }}><X size={11} /></button>}
      </div>
    </div>
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-28 select-none px-4">
          <FileText size={20} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
          <span className="text-[11px]" style={{ color: "var(--c-text-3)" }}>{search ? t("no_results") : t("no_notes_title")}</span>
        </div>
      ) : filtered.map(note => (
        <NoteItem key={note.id} note={note} active={selectedId === note.id}
          onSelect={onSelect} onDelete={onDelete} />
      ))}
    </div>
    <div className="px-4 py-2.5 border-t" style={{ borderColor: "var(--c-border-sub)" }}>
      <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>⌘N</span>
    </div>
  </aside>
));

// ─── ResizeHandle ──────────────────────────────────────────────────────────────

const ResizeHandle: React.FC<{ onResize: (dx: number) => void }> = ({ onResize }) => {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true; lastX.current = e.clientX; e.preventDefault();
    const onMove = (ev: MouseEvent) => { if (!dragging.current) return; onResize(ev.clientX - lastX.current); lastX.current = ev.clientX; };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  };
  return (
    <div onMouseDown={onMouseDown} className="group flex-shrink-0 w-1 relative" style={{ cursor: "col-resize" }}>
      <div className="absolute inset-0" style={{ background: "var(--c-border-sub)" }} />
      <div className="absolute inset-y-0 -left-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--c-accent)30" }} />
    </div>
  );
};

function fileEmoji(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  if (['ppt','pptx'].includes(ext)) return '📊';
  if (['zip','rar','7z'].includes(ext)) return '🗜️';
  if (['mp4','mov','avi'].includes(ext)) return '🎬';
  if (['mp3','wav','m4a'].includes(ext)) return '🎵';
  return '📎';
}
function fileExt(name: string): string { return name.split('.').pop() ?? ''; }

// ─── Main Notes ────────────────────────────────────────────────────────────────

export const Notes: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  useLang();
  const [notes, setNotes]       = useState<Note[]>(() => loadNotes());
  const [selectedId, setSelId]  = useState<string | null>(() => loadNotes()[0]?.id ?? null);
  const [search, setSearch]     = useState("");
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [highlights, setHL]     = useState<Record<string, HighlightRange[]>>(() => loadHL());
  const [formats, setFmt]       = useState<Record<string, FormatRange[]>>(() => loadFmt());
  const [activeColor, setColor] = useState<HColor>("yellow");
  const [mode, setMode]         = useState<"write" | "read">("write");
  const [sel, setSel]           = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [sidebarW, setSidebarW] = useState(240);
  const [editorMaxW, setEditorW]= useState(720);
  const [editorFocused, setEF]  = useState(false);
  const [titleFocused, setTF]   = useState(false);
  const [attachments, setAttach]= useState<Record<string, Attachment[]>>(() => loadAttachments());
  const attachInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const dragAttach    = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const dragMovedRef  = useRef(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const titleRef   = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for latest values — allow stable callbacks without stale closures
  const selectedIdRef = useRef(selectedId);
  const selRef        = useRef(sel);
  const notesRef      = useRef(notes);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { selRef.current = sel; }, [sel]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // ── Live content: decoupled from notes state — typing is instant ──
  // notes state updates are debounced (300ms) so the whole tree doesn't re-render on keystrokes
  const [liveContent, setLiveContent] = useState<string>(() => loadNotes()[0]?.content ?? "");
  const liveContentRef = useRef(liveContent);
  useEffect(() => { liveContentRef.current = liveContent; }, [liveContent]);

  // Sync live content when switching notes
  useEffect(() => {
    const content = notesRef.current.find(n => n.id === selectedId)?.content ?? "";
    setLiveContent(content);
    liveContentRef.current = content;
  }, [selectedId]);

  // Derive selected note — depends only on selectedId for the memo key
  const selected = useMemo(() => notes.find(n => n.id === selectedId) ?? null, [notes, selectedId]);

  // Memoized search filter
  const filtered = useMemo(() =>
    search.trim() ? notes.filter(n => { const q = search.toLowerCase(); return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.toLowerCase().includes(q); }) : notes,
    [notes, search]
  );

  // Use selected?.id (not selected) as dep — stable during typing, only changes on note switch
  const noteHL  = useMemo(() => (selected ? highlights[selected.id] : undefined) ?? EMPTY_HL, [highlights, selected?.id]);
  const noteFmt = useMemo(() => (selected ? formats[selected.id] : undefined) ?? EMPTY_FMT,   [formats,     selected?.id]);

  // Deferred content — React schedules these computations for idle time.
  // The textarea gets liveContent instantly; heavy work (renderWithFormats, wc regex)
  // runs only when the browser has spare cycles, eliminating keystroke freezes.
  const deferredContent = useDeferredValue(liveContent);

  // Only runs renderWithFormats when there IS actual formatting, and only on idle
  const renderedContent = useMemo(() => {
    if (!noteHL.length && !noteFmt.length) return null;
    if (!deferredContent) return null;
    return renderWithFormats(deferredContent, noteHL, noteFmt);
  }, [deferredContent, noteHL, noteFmt]);

  const noteAttachments = useMemo(() => selected ? (attachments[selected.id] ?? []) : [], [attachments, selected?.id]);

  // Word count — deferred so .split(/\s+/) regex never blocks a keystroke
  const wc = useMemo(() => selected?.id ? {
    words: deferredContent.trim() ? deferredContent.trim().split(/\s+/).length : 0,
    chars: deferredContent.length,
  } : null, [selected?.id, deferredContent]);

  const hasSel = sel.start < sel.end;

  // ── Stable save callback ──
  const scheduleSave = useCallback((updated: Note[]) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { setSaving(true); saveNotes(updated); setTimeout(() => { setSaving(false); setDirty(false); }, 300); }, 900);
  }, []);

  // ── Content updater: liveContent updates instantly, notes state debounced 300ms ──
  // This prevents re-rendering the entire component tree on every keystroke
  const updateContent = useCallback((value: string) => {
    setLiveContent(value);
    const sid = selectedIdRef.current;
    if (!sid) return;
    if (contentSyncTimer.current) clearTimeout(contentSyncTimer.current);
    contentSyncTimer.current = setTimeout(() => {
      setNotes(prev => {
        const updated = prev.map(n => n.id === sid ? { ...n, content: value, updatedAt: Date.now() } : n);
        scheduleSave(updated);
        return updated;
      });
    }, 300);
  }, [scheduleSave]);

  // ── Stable field updater for title/tags (non-content fields) ──
  const updateField = useCallback((field: keyof Note, value: string) => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    setNotes(prev => {
      const updated = prev.map(n => n.id === sid ? { ...n, [field]: value, updatedAt: Date.now() } : n);
      scheduleSave(updated);
      return updated;
    });
  }, [scheduleSave]);

  // ── Stable note creation — no notes in deps ──
  const createNote = useCallback(() => {
    const note: Note = { id: uid(), title: "", content: "", tags: "", createdAt: Date.now(), updatedAt: Date.now() };
    setNotes(prev => { const next = [note, ...prev]; saveNotes(next); return next; });
    setSelId(note.id); setDirty(false); setMode("write");
    setTimeout(() => titleRef.current?.focus(), 40);
  }, []);

  // ── Stable delete — uses functional setState ──
  const deleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      saveNotes(next);
      return next;
    });
    setSelId(prev => prev === id ? (notesRef.current.filter(n => n.id !== id)[0]?.id ?? null) : prev);
  }, []);

  // ── Keyboard shortcuts — attach ONCE, read latest via refs ──
  const applyFmtRef  = useRef<(fmt: "bold" | "italic" | "bold-italic", s?: number, e?: number) => void>(() => {});
  const createNoteRef = useRef(createNote);
  useEffect(() => { createNoteRef.current = createNote; }, [createNote]);

  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return; // ignore when Notes tab is hidden
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); createNoteRef.current(); }
      const s = selRef.current;
      if ((e.metaKey || e.ctrlKey) && e.key === "b" && s.start < s.end) { e.preventDefault(); applyFmtRef.current("bold"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "i" && s.start < s.end) { e.preventDefault(); applyFmtRef.current("italic"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // attached once, never re-attached

  // Close attach menu on outside click
  useEffect(() => {
    if (!attachMenuOpen) return;
    const close = () => setAttachMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [attachMenuOpen]);

  // Load thumbs for existing attachments on mount
  useEffect(() => {
    const loadThumbs = async () => {
      const { invoke } = await import("@tauri-apps/api/tauri");
      const allAttach = loadAttachments();
      let changed = false;
      for (const noteId of Object.keys(allAttach)) {
        for (const att of allAttach[noteId]) {
          if (!att.thumbUrl && att.filePath) {
            try {
              const bytes = await invoke<number[]>("read_attachment", { path: att.filePath });
              att.thumbUrl = bytesToUrl(bytes, att.name);
              changed = true;
            } catch {}
          }
        }
      }
      if (changed) setAttach({ ...allAttach });
    };
    loadThumbs();
  }, []);

  useEffect(() => {
    const onVoiceNote = () => {
      const updated = loadNotes();
      setNotes(updated);
      if (updated.length > 0 && !selectedIdRef.current) setSelId(updated[0].id);
    };
    window.addEventListener("an-notes-updated", onVoiceNote);
    return () => window.removeEventListener("an-notes-updated", onVoiceNote);
  }, []);

  const applyHL = useCallback((color: HColor, start: number, end: number) => {
    const sid = selectedIdRef.current;
    if (!sid || start >= end) return;
    setHL(prev => {
      const existing = prev[sid] ?? [];
      const result: HighlightRange[] = [];
      for (const r of existing) {
        if (r.end <= start || r.start >= end) { result.push(r); }
        else { if (r.start < start) result.push({ ...r, end: start }); if (r.end > end) result.push({ ...r, start: end }); }
      }
      result.push({ start, end, color });
      result.sort((a, b) => a.start - b.start);
      const next = { ...prev, [sid]: result };
      saveHL(next);
      return next;
    });
  }, []);

  const removeHL = useCallback((start: number, end: number) => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    setHL(prev => {
      const result: HighlightRange[] = [];
      for (const r of prev[sid] ?? []) {
        if (r.end <= start || r.start >= end) { result.push(r); }
        else { if (r.start < start) result.push({ ...r, end: start }); if (r.end > end) result.push({ ...r, start: end }); }
      }
      const next = { ...prev, [sid]: result };
      saveHL(next);
      return next;
    });
  }, []);

  const applyFmt = useCallback((fmt: "bold" | "italic" | "bold-italic", start?: number, end?: number) => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    const s = start ?? selRef.current.start;
    const e = end   ?? selRef.current.end;
    if (s >= e) return;
    setFmt(prev => {
      const existing = prev[sid] ?? [];
      const result: FormatRange[] = [];
      for (const r of existing) {
        if (r.end <= s || r.start >= e) { result.push(r); }
        else { if (r.start < s) result.push({ ...r, end: s }); if (r.end > e) result.push({ ...r, start: e }); }
      }
      result.push({ start: s, end: e, format: fmt });
      result.sort((a, b) => a.start - b.start);
      const next = { ...prev, [sid]: result };
      saveFmt(next);
      return next;
    });
  }, []);

  // Keep ref in sync for keyboard shortcut handler
  useEffect(() => { applyFmtRef.current = applyFmt; }, [applyFmt]);

  const removeFmt = useCallback((start: number, end: number) => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    setFmt(prev => {
      const result: FormatRange[] = [];
      for (const r of prev[sid] ?? []) {
        if (r.end <= start || r.start >= end) { result.push(r); }
        else { if (r.start < start) result.push({ ...r, end: start }); if (r.end > end) result.push({ ...r, start: end }); }
      }
      const next = { ...prev, [sid]: result };
      saveFmt(next);
      return next;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    const ta = contentRef.current;
    if (!ta) return;
    let start = Math.max(0, ta.selectionStart ?? 0);
    let end   = Math.max(0, ta.selectionEnd   ?? 0);
    if (start < end) {
      const text = ta.value;
      const W = /[\p{L}\p{N}]/u;
      while (start > 0 && W.test(text[start - 1] ?? "")) start--;
      while (end < text.length && W.test(text[end] ?? "")) end++;
      ta.setSelectionRange(start, end);
    }
    setSel({ start, end });
  }, []);

  const openFile = useCallback(async (att: Attachment) => {
    const imgExts = ["jpg","jpeg","png","gif","webp","svg","bmp","heic","avif"];
    const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
    const isImg = imgExts.includes(ext) || (att.thumbUrl?.startsWith("data:image") ?? false);
    if (isImg && att.thumbUrl) { setLightboxUrl(att.thumbUrl); return; }
    if (!att.filePath) return;
    try { await invoke("open_file_native", { path: att.filePath }); } catch {}
  }, []);

  const addAttachment = useCallback((noteId: string, files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const thumbUrl = ev.target?.result as string ?? "";
          let filePath = "";
          try {
            const { invoke } = await import("@tauri-apps/api/tauri");
            const buf = await file.arrayBuffer();
            filePath = await invoke<string>("save_attachment", { noteId, fileName: file.name, data: Array.from(new Uint8Array(buf)) });
          } catch {}
          const a: Attachment = { id, noteId, name: file.name, filePath, thumbUrl, x: 20, y: 20, w: 240 };
          setAttach(prev => { const next = { ...prev, [noteId]: [...(prev[noteId]??[]), a] }; saveAttachments(next); return next; });
        };
        reader.readAsDataURL(file);
      } else {
        (async () => {
          let filePath = "";
          try {
            const { invoke } = await import("@tauri-apps/api/tauri");
            const buf = await file.arrayBuffer();
            filePath = await invoke<string>("save_attachment", { noteId, fileName: file.name, data: Array.from(new Uint8Array(buf)) });
          } catch {}
          const a: Attachment = { id, noteId, name: file.name, filePath, thumbUrl: "", x: 20, y: 20, w: 240 };
          setAttach(prev => { const next = { ...prev, [noteId]: [...(prev[noteId]??[]), a] }; saveAttachments(next); return next; });
        })();
      }
    }
  }, []);

  const removeAttachment = useCallback(async (noteId: string, id: string) => {
    const att = (attachments[noteId]??[]).find(a => a.id === id);
    if (att?.filePath) {
      try { const { invoke } = await import("@tauri-apps/api/tauri"); await invoke("delete_attachment", { path: att.filePath }); } catch {}
    }
    setAttach(prev => { const next = { ...prev, [noteId]: (prev[noteId]??[]).filter(a => a.id !== id) }; saveAttachments(next); return next; });
  }, [attachments]);

  const moveAttachment = useCallback((noteId: string, id: string, x: number, y: number) => {
    setAttach(prev => { const next = { ...prev, [noteId]: (prev[noteId]??[]).map(a => a.id === id ? { ...a, x, y } : a) }; saveAttachments(next); return next; });
  }, []);

  const resizeAttachment = useCallback((noteId: string, id: string, w: number) => {
    setAttach(prev => { const next = { ...prev, [noteId]: (prev[noteId]??[]).map(a => a.id === id ? { ...a, w } : a) }; saveAttachments(next); return next; });
  }, []);

  // Stable callbacks for NoteItem — don't change between renders
  const handleSelectNote = useCallback((id: string) => {
    // Flush any pending content update before switching notes
    if (contentSyncTimer.current) {
      clearTimeout(contentSyncTimer.current);
      contentSyncTimer.current = null;
      const sid = selectedIdRef.current;
      const val = liveContentRef.current;
      if (sid) {
        setNotes(prev => {
          const updated = prev.map(n => n.id === sid ? { ...n, content: val, updatedAt: Date.now() } : n);
          saveNotes(updated);
          return updated;
        });
      }
    }
    setSelId(id); setMode("write"); setSel({ start: 0, end: 0 });
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    deleteNote(id);
  }, [deleteNote]);

  return (
    <div className="flex h-full" style={{ background: "var(--c-bg)" }}>

      {/* Sidebar — memoized, never re-renders during typing */}
      <NotesSidebarPanel
        width={sidebarW}
        noteCount={notes.length}
        search={search}
        filtered={filtered}
        selectedId={selectedId}
        onSearch={setSearch}
        onSelect={handleSelectNote}
        onDelete={handleDeleteNote}
        onCreate={createNote}
      />

      <ResizeHandle onResize={dx => setSidebarW(w => Math.max(160, Math.min(400, w + dx)))} />

      {/* Editor */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--c-bg)" }}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
              <FileText size={28} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-600" style={{ color: "var(--c-text-2)" }}>{notes.length === 0 ? t("no_notes_title") : t("select_note")}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>{notes.length === 0 ? t("no_notes_hint") : t("select_note_hint")}</p>
            </div>
            <button onClick={createNote} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-[13px] font-500 transition-all active:scale-95 shadow-lg" style={{ background: "var(--c-accent)" }}>
              <Plus size={14} strokeWidth={2.5} />{t("new_note")}
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-6 py-2.5 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
              <div className="flex-1 min-w-0" style={{ borderRadius: 10, padding: "2px 8px", transition: "box-shadow 0.18s", boxShadow: titleFocused ? "0 0 0 2px var(--c-accent), 0 0 0 5px var(--c-accent-focus-ring)" : "0 0 0 1px transparent" }}>
                <input ref={titleRef} type="text" value={selected.title}
                  onChange={e => updateField("title", e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); contentRef.current?.focus(); } }}
                  onFocus={() => setTF(true)} onBlur={() => setTF(false)}
                  placeholder={t("note_placeholder")}
                  className="w-full bg-transparent text-[15px] font-600 outline-none text-select" style={{ color: "var(--c-text-1)" }} />
              </div>
              <div className="flex items-center gap-0.5 rounded-xl p-1 flex-shrink-0" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                {(["write", "read"] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setSel({ start: 0, end: 0 }); setTimeout(() => contentRef.current?.focus(), 20); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-500 transition-all"
                    style={{ background: mode === m ? "var(--c-accent)" : "transparent", color: mode === m ? "#fff" : "var(--c-text-3)" }}>
                    {m === "write" ? <><Type size={11} />Редактор</> : <><Highlighter size={11} />Маркер</>}
                  </button>
                ))}
              </div>
              <div className="hidden md:flex items-center gap-0.5 rounded-xl p-1 flex-shrink-0" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                {WIDTH_PRESETS.map((w, i) => (
                  <button key={i} onClick={() => setEditorW(w)} className="px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all"
                    style={{ background: editorMaxW === w ? "var(--c-accent)" : "transparent", color: editorMaxW === w ? "#fff" : "var(--c-text-4)" }}>
                    {WIDTH_LABELS[i]}
                  </button>
                ))}
              </div>
              <SaveBadge dirty={dirty} saving={saving} />
              <input ref={attachInputRef} type="file" multiple className="hidden" onChange={e => addAttachment(selected.id, e.target.files)} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addAttachment(selected.id, e.target.files)} />
              <div style={{ position: "relative" }}>
                <button onClick={() => setAttachMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all select-none flex-shrink-0"
                  style={{ color: "var(--c-text-3)", border: "1px solid transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--c-accent)"; e.currentTarget.style.background = "var(--c-accent)15"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}>
                  <Paperclip size={12} />Прикрепить
                </button>
                {attachMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 rounded-2xl overflow-hidden z-50"
                    style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 160 }}>
                    <button onClick={() => { setAttachMenuOpen(false); attachInputRef.current?.click(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] transition-all"
                      style={{ color: "var(--c-text-2)", background: "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--c-card)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <ImageIcon size={13} style={{ color: "var(--c-accent)" }} />Фотографии
                    </button>
                    <button onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] transition-all"
                      style={{ color: "var(--c-text-2)", background: "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--c-card)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <Paperclip size={13} style={{ color: "#f59e0b" }} />Файлы
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => deleteNote(selected.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all select-none flex-shrink-0"
                style={{ color: "var(--c-text-3)", border: "1px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.background = "#f43f5e18"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}>
                <Trash2 size={12} />{t("delete")}
              </button>
            </div>

            {/* Tags */}
            <div className="px-6 py-2.5 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
              <TagRow value={selected.tags} onChange={v => updateField("tags", v)} />
            </div>

            {/* Marker toolbar */}
            {mode === "read" && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)", background: "var(--c-elevated)" }}>
                <div className="flex items-center gap-1.5">
                  {COLORS.map(c => {
                    const isActive = activeColor === c.id;
                    return (
                      <button key={c.id} onClick={() => setColor(c.id as HColor)} title={c.label}
                        style={{ width: 22, height: 22, borderRadius: "50%", background: hDot(c.id), border: isActive ? "3px solid var(--c-text-1)" : "2px solid transparent", outline: isActive ? "2px solid var(--c-accent)55" : "none", outlineOffset: 2, transform: isActive ? "scale(1.2)" : "scale(1)", transition: "all 0.12s", cursor: "pointer", boxShadow: `0 1px 4px ${hDot(c.id)}88` }} />
                    );
                  })}
                </div>
                <span style={{ width: 1, height: 18, background: "var(--c-border)", display: "inline-block", margin: "0 2px" }} />
                {(["bold", "italic", "bold-italic"] as const).map(fmt => (
                  <button key={fmt} onClick={() => { if (hasSel) applyFmt(fmt, sel.start, sel.end); }}
                    title={fmt === "bold" ? "Жирный ⌘B" : fmt === "italic" ? "Курсив ⌘I" : "Жирный курсив"}
                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
                    style={{ fontWeight: fmt !== "italic" ? 700 : 400, fontStyle: fmt !== "bold" ? "italic" : "normal", fontFamily: "serif", fontSize: 13, color: hasSel ? "var(--c-text-2)" : "var(--c-text-4)", background: "transparent", border: "1px solid var(--c-border)", cursor: hasSel ? "pointer" : "default" }}
                    onMouseEnter={e => { if (hasSel) { e.currentTarget.style.background = "var(--c-card)"; e.currentTarget.style.color = "var(--c-text-1)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = hasSel ? "var(--c-text-2)" : "var(--c-text-4)"; }}>
                    {fmt === "bold" ? "B" : fmt === "italic" ? "I" : "BI"}
                  </button>
                ))}
                <button onClick={() => { if (hasSel) applyHL(activeColor, sel.start, sel.end); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-500 transition-all"
                  style={{ background: hasSel ? hDot(activeColor) : "var(--c-border)", color: hasSel ? "#fff" : "var(--c-text-4)", border: "none", cursor: hasSel ? "pointer" : "default" }}>
                  <Highlighter size={11} />Выделить
                </button>
                <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
                  {hasSel ? `${sel.end - sel.start} симв.` : "Кликни на слово"}
                </span>
                {hasSel && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {noteFmt.length > 0 && (
                      <button onClick={() => removeFmt(sel.start, sel.end)} className="text-[11px] px-2 py-1 rounded-lg transition-all" style={{ color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>
                        Убрать форматирование
                      </button>
                    )}
                    {noteHL.length > 0 && (
                      <button onClick={() => removeHL(sel.start, sel.end)} className="text-[11px] px-2 py-1 rounded-lg transition-all" style={{ color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>
                        Убрать маркер
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto px-8 py-8 pb-24" style={{ maxWidth: editorMaxW }}>

                {/* ── Write mode ── */}
                {mode === "write" && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "relative", borderRadius: 16, transition: "box-shadow 0.2s", boxShadow: editorFocused ? "0 0 0 2px var(--c-accent), 0 0 0 5px var(--c-accent-focus-ring)" : "0 0 0 1px var(--c-border-sub)" }}>
                      {renderedContent ? (
                        <>
                          <div style={{ fontSize: 16, lineHeight: 1.9, fontFamily: "'IBM Plex Sans', sans-serif", padding: "16px 20px", minHeight: "70vh", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--c-text-2)", borderRadius: 14 }}>
                            {renderedContent}
                          </div>
                          <textarea ref={contentRef} value={liveContent}
                            onChange={e => updateContent(e.target.value)}
                            onFocus={() => setEF(true)}
                            onBlur={e => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as globalThis.Node)) setEF(false); }}
                            onMouseUp={handleMouseUp}
                            className="resize-none text-select"
                            style={{ position: "absolute", inset: 0, fontSize: 16, lineHeight: 1.9, fontFamily: "'IBM Plex Sans', sans-serif", padding: "16px 20px", color: "transparent", WebkitTextFillColor: "transparent", caretColor: "var(--c-accent)", background: "transparent", border: "none", outline: "none", borderRadius: 14, resize: "none", overflow: "hidden", cursor: "text" }}
                          />
                        </>
                      ) : (
                        <textarea ref={contentRef} value={liveContent}
                          onChange={e => updateContent(e.target.value)}
                          onFocus={() => setEF(true)}
                          onBlur={e => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as globalThis.Node)) setEF(false); }}
                          onMouseUp={handleMouseUp}
                          placeholder={t("write_placeholder")}
                          className="w-full resize-none text-select overflow-hidden"
                          style={{ fontSize: 16, lineHeight: 1.9, fontFamily: "'IBM Plex Sans', sans-serif", padding: "16px 20px", color: "var(--c-text-2)", caretColor: "var(--c-accent)", background: "transparent", border: "none", outline: "none", borderRadius: 14, minHeight: "70vh", display: "block" }}
                        />
                      )}
                    </div>

                    {noteAttachments.map(att => {
                      const isImage = att.thumbUrl && (att.thumbUrl.startsWith("data:image") || att.thumbUrl.startsWith("blob:"));
                      return (
                        <div key={att.id}
                          style={{ position: "absolute", left: att.x, top: att.y, width: att.w, zIndex: 10, userSelect: "none" }}
                          draggable={false} onDragStart={e => e.preventDefault()}
                          onMouseDown={e => {
                            if ((e.target as HTMLElement).dataset.resize) return;
                            e.preventDefault(); e.stopPropagation();
                            const el = e.currentTarget as HTMLElement;
                            const startX = e.clientX, startY = e.clientY;
                            const origX = att.x, origY = att.y;
                            let moved = false, lastX = origX, lastY = origY;
                            dragMovedRef.current = false;
                            dragAttach.current = { id: att.id, startX, startY, origX, origY };
                            document.body.style.cursor = "grabbing";
                            const onMove = (ev: MouseEvent) => {
                              if (!dragAttach.current) return;
                              const dx = ev.clientX - startX, dy = ev.clientY - startY;
                              if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { moved = true; dragMovedRef.current = true; }
                              if (!moved) return;
                              lastX = Math.max(0, origX + dx); lastY = Math.max(0, origY + dy);
                              el.style.transform = `translate(${dx}px, ${dy}px)`;
                            };
                            const onUp = () => {
                              if (moved) { el.style.transform = ""; moveAttachment(selected.id, att.id, lastX, lastY); }
                              dragAttach.current = null; dragMovedRef.current = false;
                              document.body.style.cursor = "";
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        >
                          <div className="group relative" style={{ width: "100%", borderRadius: 12, overflow: "visible", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid var(--c-border)", cursor: "grab", background: "var(--c-surface)" }}>
                            {isImage ? (
                              <div style={{ borderRadius: 12, overflow: "hidden", cursor: "zoom-in" }}
                                onClick={e => e.stopPropagation()}
                                onDoubleClick={e => { e.stopPropagation(); openFile(att); }}>
                                <img src={att.thumbUrl} alt={att.name} style={{ width: "100%", display: "block", borderRadius: 12 }} />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ minWidth: 160, cursor: "pointer" }}
                                onClick={e => e.stopPropagation()}
                                onDoubleClick={e => { e.stopPropagation(); openFile(att); }}>
                                <span style={{ fontSize: 24 }}>{fileEmoji(att.name)}</span>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-500 truncate" style={{ color: "var(--c-text-1)", maxWidth: att.w - 60 }}>{att.name}</p>
                                  <p className="text-[10px]" style={{ color: "var(--c-text-4)" }}>{fileExt(att.name).toUpperCase()}</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute -top-2.5 -right-2.5 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                              <button onClick={e => { e.stopPropagation(); removeAttachment(selected.id, att.id); }}
                                style={{ width: 22, height: 22, borderRadius: "50%", background: "#f43f5e", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <X size={10} />
                              </button>
                            </div>
                            {isImage && (
                              <div data-resize="true" className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ position: "absolute", bottom: -6, right: -6, width: 14, height: 14, borderRadius: "50%", background: "var(--c-accent)", cursor: "se-resize", border: "2px solid white", zIndex: 20 }}
                                onMouseDown={e => {
                                  e.preventDefault(); e.stopPropagation();
                                  const card = e.currentTarget.closest(".group") as HTMLElement;
                                  if (!card) return;
                                  const startX = e.clientX, startW = att.w;
                                  let lastW = startW;
                                  const onMove = (ev: MouseEvent) => { lastW = Math.max(80, Math.min(800, startW + ev.clientX - startX)); card.style.width = `${lastW}px`; };
                                  const onUp = () => { card.style.width = ""; resizeAttachment(selected.id, att.id, lastW); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                                  window.addEventListener("mousemove", onMove);
                                  window.addEventListener("mouseup", onUp, { once: true });
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Lightbox */}
                {lightboxUrl && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.88)" }} onClick={() => setLightboxUrl(null)}>
                    <button onClick={() => setLightboxUrl(null)}
                      className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer" }}>
                      <X size={20} />
                    </button>
                    <img src={lightboxUrl} onClick={e => e.stopPropagation()}
                      style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12 }} />
                  </div>
                )}

                {/* ── Marker mode ── */}
                {mode === "read" && (
                  <div style={{ position: "relative", borderRadius: 16, boxShadow: "0 0 0 1px var(--c-border-sub)" }}>
                    <div style={{ fontSize: 16, lineHeight: 1.9, fontFamily: "'IBM Plex Sans', sans-serif", padding: "16px 20px", minHeight: "70vh", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--c-text-2)", borderRadius: 14 }}>
                      {renderedContent
                        ?? (liveContent
                          ? <span style={{ whiteSpace: "pre-wrap" }}>{liveContent}</span>
                          : <span style={{ color: "var(--c-text-4)", fontStyle: "italic" }}>{t("write_placeholder")}</span>
                        )
                      }
                    </div>
                    <textarea ref={contentRef} value={liveContent} readOnly
                      onMouseUp={handleMouseUp} onClick={handleMouseUp}
                      className="marker-select"
                      style={{ position: "absolute", inset: 0, cursor: "text", resize: "none", border: "none", outline: "none", padding: "16px 20px", fontSize: 16, lineHeight: 1.9, fontFamily: "'IBM Plex Sans', sans-serif", background: "transparent", WebkitTextFillColor: "transparent", caretColor: "transparent" }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-2 border-t flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
              {wc && (
                <span className="text-[11px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
                  {wc.words} {t("words")} · {wc.chars} {t("chars")}
                  {noteHL.length > 0 && <span style={{ color: "var(--c-accent)" }}> · {noteHL.length} маркеров</span>}
                </span>
              )}
              <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>{t("edited")} {relDate(selected.updatedAt)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
