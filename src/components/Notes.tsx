import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Search, X, FileText, Hash, Check, Loader2 } from "lucide-react";
import { t, useLang } from "../i18n";

interface Note {
  id: string; title: string; content: string; tags: string;
  createdAt: number; updatedAt: number;
}

const STORAGE_KEY = "vss_notes_v2";
function loadNotes(): Note[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function persistNotes(n: Note[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)); } catch {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function relDate(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)    return t("just_now");
  if (s < 60)    return `${s}${t("time_s")} ${t("ago")}`;
  if (s < 3600)  return `${Math.floor(s / 60)}${t("time_m")} ${t("ago")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${t("time_h")} ${t("ago")}`;
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ─── Save badge ───────────────────────────────────────────────────────────────

const SaveBadge: React.FC<{ dirty: boolean; saving: boolean }> = ({ dirty, saving }) => {
  if (saving) return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
      <Loader2 size={10} className="animate-spin" />{t("saving")}
    </span>
  );
  if (!dirty) return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono select-none" style={{ color: "var(--c-accent)" }}>
      <Check size={10} strokeWidth={3} />{t("saved")}
    </span>
  );
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b", display: "inline-block" }} />;
};

// ─── Tag row ─────────────────────────────────────────────────────────────────

const TagRow: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [input, setInput] = useState("");
  const list = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];

  const commit = () => {
    const tag = input.trim().replace(/^#/, "");
    if (!tag || list.includes(tag)) { setInput(""); return; }
    onChange([...list, tag].join(","));
    setInput("");
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
      <Hash size={11} className="flex-shrink-0" style={{ color: "var(--c-text-4)" }} />
      {list.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono"
          style={{ background: "var(--c-accent)18", border: "1px solid var(--c-accent)30", color: "var(--c-accent)" }}
        >
          {tag}
          <button onClick={() => onChange(list.filter(x => x !== tag).join(","))} className="opacity-50 hover:opacity-100 ml-0.5">
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && !input && list.length > 0) onChange(list.slice(0, -1).join(","));
        }}
        onBlur={commit}
        placeholder={list.length === 0 ? t("add_tag") : ""}
        className="bg-transparent text-[11px] outline-none min-w-[70px] text-select"
        style={{ color: "var(--c-text-3)" }}
      />
    </div>
  );
};

// ─── Note list item ───────────────────────────────────────────────────────────

const NoteItem: React.FC<{
  note: Note; active: boolean;
  onSelect: () => void; onDelete: () => void;
}> = ({ note, active, onSelect, onDelete }) => {
  const preview = note.content.replace(/\s+/g, " ").trim().slice(0, 75);
  const tags = note.tags ? note.tags.split(",").filter(t => t.trim()).slice(0, 2) : [];

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col gap-1 px-4 py-3 cursor-pointer border-b transition-all duration-100"
      style={{
        borderColor: "var(--c-border-sub)",
        background: active ? "var(--c-elevated)" : "transparent",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--c-elevated)88"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: "var(--c-accent)" }} />
      )}

      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[12.5px] font-500 leading-snug truncate"
          style={{ color: active ? "var(--c-text-1)" : "var(--c-text-2)" }}
        >
          {note.title || <span className="italic font-400" style={{ color: "var(--c-text-4)" }}>{t("untitled")}</span>}
        </p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
          style={{ color: "var(--c-text-4)" }}
          onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {preview && (
        <p
          className="text-[11px] leading-relaxed"
          style={{
            color: "var(--c-text-3)",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {preview}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex items-center gap-1">
          {tags.map(tag => (
            <span
              key={tag}
              className="text-[9.5px] font-mono px-1.5 py-px rounded-full"
              style={{
                color: "var(--c-accent)",
                background: "var(--c-accent)14",
                border: "1px solid var(--c-accent)25",
              }}
            >
              #{tag.trim()}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>
          {relDate(note.updatedAt)}
        </span>
      </div>
    </div>
  );
};

// ─── Main Notes component ─────────────────────────────────────────────────────

export const Notes: React.FC = () => {
  useLang(); // subscribe to lang changes
  const [notes, setNotes]       = useState<Note[]>(() => loadNotes());
  const [selectedId, setSelId]  = useState<string | null>(() => loadNotes()[0]?.id ?? null);
  const [search, setSearch]     = useState("");
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);

  const titleRef   = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = notes.find(n => n.id === selectedId) ?? null;
  const filtered = search.trim()
    ? notes.filter(n => {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.toLowerCase().includes(q);
      })
    : notes;

  const scheduleSave = useCallback((updated: Note[]) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      persistNotes(updated);
      setTimeout(() => { setSaving(false); setDirty(false); }, 300);
    }, 900);
  }, []);

  const resize = () => {
    const el = contentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffect(() => { resize(); }, [selected?.content]);

  const updateField = (field: keyof Note, value: string) => {
    if (!selectedId) return;
    const updated = notes.map(n => n.id === selectedId ? { ...n, [field]: value, updatedAt: Date.now() } : n);
    setNotes(updated);
    scheduleSave(updated);
  };

  const createNote = () => {
    const note: Note = { id: uid(), title: "", content: "", tags: "", createdAt: Date.now(), updatedAt: Date.now() };
    const next = [note, ...notes];
    setNotes(next);
    setSelId(note.id);
    persistNotes(next);
    setDirty(false);
    setTimeout(() => titleRef.current?.focus(), 40);
  };

  const deleteNote = (id: string) => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    persistNotes(next);
    if (selectedId === id) setSelId(next[0]?.id ?? null);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); createNote(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [notes]);

  const wc = selected
    ? { words: selected.content.trim() ? selected.content.trim().split(/\s+/).length : 0, chars: selected.content.length }
    : null;

  return (
    <div className="flex h-full" style={{ background: "var(--c-bg)" }}>

      {/* ══ Sidebar ══ */}
      <aside
        className="w-[240px] min-w-[240px] flex flex-col h-full border-r"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border-sub)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
          <span className="text-[13px] font-600 select-none" style={{ color: "var(--c-text-2)" }}>{t("notes")}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>{notes.length}</span>
            <button
              onClick={createNote}
              title={`${t("new_note")} (⌘N)`}
              className="flex items-center justify-center w-7 h-7 rounded-xl active:scale-90 text-white transition-all"
              style={{ background: "var(--c-accent)" }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
          >
            <Search size={11} className="flex-shrink-0" style={{ color: "var(--c-text-4)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("search")}
              className="bg-transparent text-[12px] outline-none w-full text-select"
              style={{ color: "var(--c-text-2)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ color: "var(--c-text-4)" }}>
                <X size={11} />
              </button>
            )}
          </div>
          {search && (
            <p className="text-[10px] font-mono mt-1.5 px-1 select-none" style={{ color: "var(--c-text-4)" }}>
              {filtered.length}
            </p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 h-28 select-none px-4">
              <FileText size={20} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
              <span className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
                {search ? t("no_results") : t("no_notes_title")}
              </span>
            </div>
          ) : (
            filtered.map(note => (
              <NoteItem
                key={note.id} note={note}
                active={selectedId === note.id}
                onSelect={() => setSelId(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t" style={{ borderColor: "var(--c-border-sub)" }}>
          <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
            {t("shortcut_hint")}
          </span>
        </div>
      </aside>

      {/* ══ Editor ══ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--c-bg)" }}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
            >
              <FileText size={28} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-600" style={{ color: "var(--c-text-2)" }}>
                {notes.length === 0 ? t("no_notes_title") : t("select_note")}
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>
                {notes.length === 0 ? t("no_notes_hint") : t("select_note_hint")}
              </p>
            </div>
            <button
              onClick={createNote}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-[13px] font-500 transition-all active:scale-95 shadow-lg"
              style={{ background: "var(--c-accent)" }}
            >
              <Plus size={14} strokeWidth={2.5} />{t("new_note")}
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div
              className="flex items-center gap-4 px-6 py-3 border-b flex-shrink-0"
              style={{ borderColor: "var(--c-border-sub)" }}
            >
              <input
                ref={titleRef}
                type="text"
                value={selected.title}
                onChange={e => updateField("title", e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); contentRef.current?.focus(); } }}
                placeholder={t("note_placeholder")}
                className="flex-1 bg-transparent text-[15px] font-600 outline-none text-select min-w-0"
                style={{ color: "var(--c-text-1)" }}
              />
              <SaveBadge dirty={dirty} saving={saving} />
              <button
                onClick={() => deleteNote(selected.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all select-none"
                style={{ color: "var(--c-text-3)", border: "1px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.background = "#f43f5e18"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}
              >
                <Trash2 size={12} />{t("delete")}
              </button>
            </div>

            {/* Tags */}
            <div className="px-6 py-2.5 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
              <TagRow value={selected.tags} onChange={v => updateField("tags", v)} />
            </div>

            {/* Writing area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-[680px] mx-auto px-8 py-8 pb-20">
                <textarea
                  ref={contentRef}
                  value={selected.content}
                  onChange={e => { updateField("content", e.target.value); resize(); }}
                  onInput={resize}
                  placeholder={t("write_placeholder")}
                  className="w-full bg-transparent outline-none resize-none text-select overflow-hidden"
                  style={{
                    fontSize: "15px", lineHeight: "1.85",
                    color: "var(--c-text-2)",
                    caretColor: "var(--c-accent)",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    minHeight: "60vh",
                  }}
                />
              </div>
            </div>

            {/* Status bar */}
            <div
              className="flex items-center justify-between px-6 py-2 border-t flex-shrink-0"
              style={{ borderColor: "var(--c-border-sub)" }}
            >
              {wc && (
                <span className="text-[11px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
                  {wc.words} {t("words")} · {wc.chars} {t("chars")}
                </span>
              )}
              <span className="text-[10px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
                {t("edited")} {relDate(selected.updatedAt)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
