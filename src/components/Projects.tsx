import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  Plus, Trash2, ChevronLeft, GripVertical, Edit2,
  Check, X, Film, AlignLeft, Loader2, GitBranch, AlertTriangle,
} from "lucide-react";
import { Blueprint, serializeBlueprint, type BPNode, type BPEdge } from "./Blueprint";
import { t, useLang } from "../i18n";
import { readJSON, writeJSON, writeString } from "../lib/storage";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StructureItem {
  id: string;
  text: string;
}
interface Section {
  id: string;
  title: string;
  items: StructureItem[];
}
interface BlueprintData {
  nodes: BPNode[];
  edges: BPEdge[];
}
type ViewMode = "structure" | "blueprint";
interface Project {
  id: string;
  title: string;
  description: string;
  color: string;
  sections: Section[];
  blueprint: BlueprintData;
  createdAt: number;
  updatedAt: number;
}

// ─── Storage ───────────────────────────────────────────────────────────────────

const KEY = "an_projects_v3";

function load(): Project[] {
  const arr = readJSON<Project[]>(KEY, []);
  if (!Array.isArray(arr)) return [];
  // Migrate older records
  return arr.map((p) => ({
    ...p,
    sections:  p.sections ?? [],
    blueprint: {
      nodes: p.blueprint?.nodes ?? [],
      edges: p.blueprint?.edges ?? [],
    },
  }));
}

/**
 * Blueprint photos are stripped to their on-disk path before the project list
 * is written. Keeping the base64 here is what used to push `an_projects_v3`
 * past the localStorage quota after the very first picture, at which point
 * every subsequent write threw and only the last successful snapshot survived.
 * Returns false when the write did not land, so the UI can stop claiming
 * "Сохранено".
 */
function persist(projects: Project[]): boolean {
  const slim = projects.map((p) => ({
    ...p,
    blueprint: serializeBlueprint(p.blueprint.nodes, p.blueprint.edges),
  }));
  return writeJSON(KEY, slim);
}

// The Projects tab unmounts when you switch to another sidebar tab (Notes,
// Tasks, …), so the mode switcher's choice must live outside component
// state or it silently resets to "structure" every time you come back.
const MODE_KEY = "an_projects_mode_v1";
function loadMode(): ViewMode {
  return localStorage.getItem(MODE_KEY) === "blueprint" ? "blueprint" : "structure";
}
function persistMode(m: ViewMode) {
  writeString(MODE_KEY, m);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ─── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  { id: "indigo",  hex: "#6366f1" },
  { id: "violet",  hex: "#8b5cf6" },
  { id: "sky",     hex: "#0ea5e9" },
  { id: "teal",    hex: "#14b8a6" },
  { id: "emerald", hex: "#10b981" },
  { id: "amber",   hex: "#f59e0b" },
  { id: "rose",    hex: "#f43f5e" },
  { id: "zinc",    hex: "#71717a" },
];
const hex = (id: string) => PALETTE.find((c) => c.id === id)?.hex ?? "#6366f1";

const DEFAULT_SECTIONS = (): Section[] => [];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relDate(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)   return t("just_now");
  if (s < 60)   return `${s}${t("time_s")} ${t("ago")}`;
  if (s < 3600)  return `${Math.floor(s / 60)}${t("time_m")} ${t("ago")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${t("time_h")} ${t("ago")}`;
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ─── Save badge ────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";
const SaveBadge: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state === "saving") return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono select-none" style={{ color: "var(--c-text-4)" }}>
      <Loader2 size={10} className="animate-spin" />{t("saving")}
    </span>
  );
  if (state === "saved") return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600/70 select-none">
      <Check size={10} strokeWidth={3} />{t("saved")}
    </span>
  );
  // A failed write used to be invisible — the badge still said "Сохранено"
  // while nothing was reaching disk.
  if (state === "error") return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono select-none" style={{ color: "#f43f5e" }}
      title={t("save_failed_hint")}>
      <AlertTriangle size={10} strokeWidth={2.5} />{t("save_failed")}
    </span>
  );
  return null;
};

// ─── Inline editable field ─────────────────────────────────────────────────────

const InlineEdit: React.FC<{
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}> = ({ value, onSave, placeholder = t("description_placeholder"), className = "", multiline = false, style }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select?.(); }
  }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };
  const cancel = () => { setEditing(false); setDraft(value); };

  const shared = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
      if (e.key === "Escape") cancel();
    },
    className: `rounded-lg px-2.5 py-1 outline-none text-select w-full ${className}`,
      style: { background: "var(--c-elevated)", border: "1px solid var(--c-accent)50", color: "var(--c-text-1)" },
  };

  if (editing) {
    return multiline
      ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} {...shared} rows={2} style={{ resize: "none" }} />
      : <input    ref={ref as React.RefObject<HTMLInputElement>}    {...shared} />;
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`group inline-flex items-center gap-1.5 cursor-text ${className}`}
      style={style}
    >
      <span style={{ color: value ? "var(--c-text-2)" : "var(--c-text-4)", fontStyle: value ? "normal" : "italic" }}>{value || placeholder}</span>
      <Edit2 size={10} className="flex-shrink-0 transition-colors" style={{ color: "var(--c-text-4)", opacity: 0.6 }} />
    </span>
  );
};

// ─── Color picker ──────────────────────────────────────────────────────────────

const ColorPicker: React.FC<{ value: string; onChange: (c: string) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-2 flex-wrap">
    {PALETTE.map((c) => (
      <button
        key={c.id}
        onClick={() => onChange(c.id)}
        title={c.id}
        style={{
          background: c.hex,
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: value === c.id ? `3px solid ${c.hex}` : "2px solid transparent",
          outline: value === c.id ? `2px solid ${c.hex}44` : "none",
          outlineOffset: 2,
          opacity: value === c.id ? 1 : 0.55,
          transform: value === c.id ? "scale(1.15)" : "scale(1)",
          transition: "all 0.15s",
          cursor: "pointer",
        }}
      />
    ))}
  </div>
);

// ─── Structure item row ────────────────────────────────────────────────────────

const ItemRow: React.FC<{
  item: StructureItem;
  onUpdate: (text: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dragging: boolean;
  dropTarget: boolean;
}> = ({ item, onUpdate, onDelete, onDragStart, onDragOver, onDrop, dragging, dropTarget }) => {
  const [editing, setEditing] = useState(!item.text);
  const [draft, setDraft]     = useState(item.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const l = ref.current.value.length;
      ref.current.setSelectionRange(l, l);
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v) onUpdate(v);
    else onDelete();
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={onDrop}
      onDragEnd={() => {}}
      className={[
        "group flex items-start gap-2 px-3 py-2.5 rounded-lg transition-all duration-100",
        dragging  ? "opacity-30 scale-95" : "",
        dropTarget ? "border-t-2 border-indigo-500" : "border-t-2 border-transparent",
      ].join(" ")}
      onMouseEnter={e => e.currentTarget.style.background="var(--c-elevated)"}
      onMouseLeave={e => e.currentTarget.style.background="transparent"}
    >
      {/* Drag handle */}
      <span className="flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" style={{ color: "var(--c-text-4)" }}>
        <GripVertical size={13} />
      </span>

      {/* Bullet */}
      <span className="flex-shrink-0 mt-2.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--c-text-4)" }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if ((e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey))) { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setEditing(false); setDraft(item.text); }
            }}
            rows={2}
            placeholder={t("type_something")}
            className="w-full rounded-lg px-2.5 py-1.5 text-[13px] outline-none resize-none text-select"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-accent)50", color: "var(--c-text-1)", caretColor: "var(--c-accent)", lineHeight: 1.55 }}
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="text-[13px] leading-relaxed cursor-text transition-colors"
            style={{ color: "var(--c-text-2)", whiteSpace: "pre-wrap" }}
          >
            {item.text || <span className="italic" style={{ color: "var(--c-text-4)" }}>{t("untitled")}</span>}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" style={{ color: "var(--c-text-4)" }}
      >
        <X size={13} />
      </button>
    </div>
  );
};

// ─── Section block ─────────────────────────────────────────────────────────────

const SectionBlock: React.FC<{
  section: Section;
  color: string;
  onUpdateTitle: (t: string) => void;
  onAddItem: () => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onDeleteSection: () => void;
  onMoveItem: (from: number, to: number) => void;
}> = ({ section, color, onUpdateTitle, onAddItem, onUpdateItem, onDeleteItem, onDeleteSection, onMoveItem }) => {
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const handleDeleteSection = () => {
    if (confirmDel) { onDeleteSection(); }
    else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--c-border-sub)" }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: hex(color) }} />
        <InlineEdit
          value={section.title}
          onSave={onUpdateTitle}
          placeholder={t("add_section")}
          className="text-[13px] font-600 flex-1" style={{ color: "var(--c-text-1)" }}
        />
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={onAddItem}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-all" style={{ color: "var(--c-text-3)" }}
          >
            <Plus size={11} />{t("add_item")}          </button>
          <button
            onClick={handleDeleteSection}
            className={[
              "flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all",
              confirmDel
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : "hover:text-red-400 hover:bg-red-400/10",
            ].join(" ")}
          >
            <Trash2 size={11} />
            {confirmDel && <span>{t("sure")}</span>}
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="py-1 px-1">
        {section.items.length === 0 ? (
          <button
            onClick={onAddItem}
            className="w-full flex items-center gap-2 px-5 py-3 text-[12px] rounded-xl transition-all" style={{ color: "var(--c-text-4)" }}
          >
            <Plus size={12} />{t("add_first_item")}
          </button>
        ) : (
          section.items.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              dragging={dragIdx.current === idx}
              dropTarget={overIdx === idx}
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={() => setOverIdx(idx)}
              onDrop={() => {
                if (dragIdx.current !== null && dragIdx.current !== idx) {
                  onMoveItem(dragIdx.current, idx);
                }
                dragIdx.current = null;
                setOverIdx(null);
              }}
              onUpdate={(text) => onUpdateItem(item.id, text)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Project card ──────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onDelete }) => {
  const [confirmDel, setConfirmDel] = useState(false);
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDel) { onDelete(); }
    else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); }
  };

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col gap-3 p-5 rounded-2xl cursor-pointer transition-all duration-150" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }} onMouseEnter={e => e.currentTarget.style.background="var(--c-elevated)"} onMouseLeave={e => e.currentTarget.style.background="var(--c-surface)"}
    >
      {/* Top color bar */}
      <div className="absolute top-0 left-5 right-5 h-px rounded-full" style={{ background: hex(project.color) }} />

      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: hex(project.color) }} />
          <h3 className="text-[14px] font-600 leading-snug truncate" style={{ color: "var(--c-text-1)" }}>
            {project.title || <span className="italic font-400" style={{ color: "var(--c-text-4)" }}>{t("untitled")}</span>}
          </h3>
        </div>
        <button
          onClick={handleDelete}
          className={[
            "flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-all",
            confirmDel
              ? "bg-red-500/15 text-red-400 border border-red-500/30 !opacity-100"
              : "hover:text-red-400 hover:bg-red-400/10",
          ].join(" ")}
        >
          <Trash2 size={11} />
          {confirmDel && t("sure")}
        </button>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "var(--c-text-3)" }}>{project.description}</p>
      )}

      {/* Date */}
      <div className="flex items-center justify-end mt-1">
        <span className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>{relDate(project.updatedAt)}</span>
      </div>
    </div>
  );
};

// ─── Mode switcher tab ─────────────────────────────────────────────────────────

const ModeTab: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-500 transition-all duration-150"
    style={{
      background: active ? "var(--c-elevated)" : "transparent",
      color: active ? "var(--c-text-1)" : "var(--c-text-3)",
      border: active ? "1px solid var(--c-border)" : "1px solid transparent",
    }}
  >
    {icon}
    {label}
  </button>
);

// The exact same switcher is used in two places: the projects list header
// (picks which view a click on a card opens into) and inside an open
// project (switches the view you're currently looking at) — one shared
// component, one shared `mode` state, so they never disagree.
const ModeSwitcher: React.FC<{ mode: ViewMode; onChange: (m: ViewMode) => void }> = ({ mode, onChange }) => (
  <div className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
    <ModeTab active={mode === "structure"} onClick={() => onChange("structure")} icon={<AlignLeft size={12} />} label={t("mode_structure")} />
    <ModeTab active={mode === "blueprint"} onClick={() => onChange("blueprint")} icon={<GitBranch size={12} />} label={t("mode_blueprint")} />
  </div>
);

// ─── Main Projects component ────────────────────────────────────────────────────

export const Projects: React.FC = () => {
  useLang();
  const [projects, setProjects]   = useState<Project[]>(() => load());
  const [openId, setOpenId]       = useState<string | null>(null);
  const [mode, setModeState]      = useState<ViewMode>(loadMode);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    persistMode(m);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open      = projects.find((p) => p.id === openId) ?? null;

  // Mirror of `projects` that is readable synchronously. Mutations used to
  // compute the next list *inside* a setState updater and persist from there —
  // a side effect in what must be a pure function, and impossible to flush on
  // demand. With the mirror the next list exists before React is told about it,
  // so it can be written to disk immediately when needed.
  const projectsRef = useRef(projects);
  // Holds a list that has been changed but not yet written, so unmount and
  // window-close handlers know whether there is anything to flush.
  const pendingRef  = useRef<Project[] | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const toSave = pendingRef.current;
    if (!toSave) return;
    pendingRef.current = null;
    const ok = persist(toSave);
    setSaveState(ok ? "saving" : "error");
    if (!ok) return;
    setTimeout(() => {
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    }, 250);
  }, []);

  const applyProjects = useCallback((next: Project[], immediate = false) => {
    projectsRef.current = next;
    pendingRef.current  = next;
    setProjects(next);
    if (immediate) { flushSave(); return; }
    setSaveState((s) => (s === "error" ? s : "idle"));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 600);
  }, [flushSave]);

  const mutate = useCallback((fn: (prev: Project[]) => Project[], immediate = false) => {
    applyProjects(fn(projectsRef.current), immediate);
  }, [applyProjects]);

  const touch = useCallback((id: string, changes: Partial<Project>, immediate = false) => {
    mutate((prev) =>
      prev.map((p) => p.id === id ? { ...p, ...changes, updatedAt: Date.now() } : p),
      immediate
    );
  }, [mutate]);

  // Leaving the tab unmounts this component and closing the window kills the
  // page outright; either one inside the 600 ms debounce window used to lose
  // the edit. Both now write through first.
  useEffect(() => {
    const onBeforeUnload = () => flushSave();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  // Opens a project straight into whichever view (structure/blueprint) is
  // currently picked — the same `mode` switcher shown both in the projects
  // list header and inside the open project (see ModeTab below).
  const openProject = useCallback((id: string) => {
    setOpenId(id);
  }, []);

  // ── Project CRUD ──
  const createProject = () => {
    const p: Project = {
      id: uid(), title: "", description: "", color: "indigo",
      sections: DEFAULT_SECTIONS(),
      blueprint: { nodes: [], edges: [] },
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    applyProjects([p, ...projectsRef.current], true);
    setOpenId(p.id);
    setMode("structure");
  };

  const deleteProject = (id: string) => {
    applyProjects(projectsRef.current.filter((p) => p.id !== id), true);
    if (openId === id) setOpenId(null);
  };

  // ── Section CRUD ──
  const addSection = (projectId: string) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: [...p.sections, { id: uid(), title: t("add_section"), items: [] }],
      })
    );

  const updateSection = (projectId: string, sectionId: string, changes: Partial<Section>) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.map((s) => s.id === sectionId ? { ...s, ...changes } : s),
      })
    );

  const deleteSection = (projectId: string, sectionId: string) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.filter((s) => s.id !== sectionId),
      })
    );

  // ── Item CRUD ──
  const addItem = (projectId: string, sectionId: string) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.map((s) => s.id !== sectionId ? s : {
          ...s, items: [...s.items, { id: uid(), text: "" }],
        }),
      })
    );

  const updateItem = (projectId: string, sectionId: string, itemId: string, text: string) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.map((s) => s.id !== sectionId ? s : {
          ...s, items: s.items.map((i) => i.id === itemId ? { ...i, text } : i),
        }),
      })
    );

  const deleteItem = (projectId: string, sectionId: string, itemId: string) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.map((s) => s.id !== sectionId ? s : {
          ...s, items: s.items.filter((i) => i.id !== itemId),
        }),
      })
    );

  const moveItem = (projectId: string, sectionId: string, from: number, to: number) =>
    mutate((prev) =>
      prev.map((p) => p.id !== projectId ? p : {
        ...p, updatedAt: Date.now(),
        sections: p.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const items = [...s.items];
          const [moved] = items.splice(from, 1);
          items.splice(to, 0, moved);
          return { ...s, items };
        }),
      })
    );

  // ── Blueprint save ──
  // `immediate` arrives when the canvas is unmounting (mode switch, "Назад",
  // tab change) and its pending edit would otherwise die with it.
  const saveBlueprintData = useCallback((nodes: BPNode[], edges: BPEdge[], immediate = false) => {
    if (!openId) return;
    touch(openId, { blueprint: { nodes, edges } }, immediate);
  }, [openId, touch]);

  // ══════════════════════════════════════════════════════════════════
  // PROJECT DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════

  if (open) {
    return (
      <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)", background: "var(--c-surface)" }}>
          <button
            onClick={() => setOpenId(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-500 transition-all duration-150 active:scale-95"
            style={{ color: "var(--c-text-3)", border: "1px solid transparent" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--c-elevated)";
              e.currentTarget.style.color = "var(--c-text-1)";
              e.currentTarget.style.border = "1px solid var(--c-border)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--c-text-3)";
              e.currentTarget.style.border = "1px solid transparent";
            }}
          >
            <ChevronLeft size={14} />
            <span>{t("back")}</span>
          </button>

          <span style={{ color: "var(--c-border)" }}>·</span>

          {/* Color dot + title */}
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: hex(open.color) }} />
          <div className="flex-1 min-w-0">
            <InlineEdit
              value={open.title}
              onSave={(v) => touch(open.id, { title: v })}
              placeholder={t("project_placeholder")}
              className="text-[14px] font-600"
            />
          </div>

          <SaveBadge state={saveState} />

          {/* Mode switcher */}
          <ModeSwitcher mode={mode} onChange={setMode} />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden">

          {/* ── Text Structure mode ── */}
          {mode === "structure" && (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <div className="max-w-[760px] mx-auto px-6 py-6 pb-24">

                {/* Project meta card */}
                <div className="flex flex-col gap-4 p-5 rounded-2xl mb-8" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                  <div>
                    <label className="text-[10px] font-600 uppercase tracking-widest mb-2 block select-none" style={{ color: "var(--c-text-3)" }}>{t("description_label")}</label>
                    <InlineEdit
                      value={open.description}
                      onSave={(v) => touch(open.id, { description: v })}
                      placeholder={t("description_placeholder")}
                      className="text-[13px]"
                      multiline
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-600 uppercase tracking-widest mb-2 block select-none" style={{ color: "var(--c-text-3)" }}>{t("color_label")}</label>
                    <ColorPicker
                      value={open.color}
                      onChange={(c) => touch(open.id, { color: c })}
                    />
                  </div>
                </div>

                {/* Sections header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlignLeft size={13} style={{ color: "var(--c-text-4)" }} />
                    <span className="text-[13px] font-600 select-none" style={{ color: "var(--c-text-2)" }}>{t("sections_label")}</span>
                    <span className="text-[10px] font-mono text-zinc-700 select-none">
                      {open.sections.length} section{open.sections.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => addSection(open.id)}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-all" style={{ color: "var(--c-text-3)" }}
                  >
                    <Plus size={12} />{t("add_section")}
                  </button>
                </div>

                {/* Sections */}
                {open.sections.length === 0 ? (
                  <button
                    onClick={() => addSection(open.id)}
                    className="w-full flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border-2 border-dashed transition-all" style={{ borderColor: "var(--c-border)", color: "var(--c-text-4)" }} onMouseEnter={e => { e.currentTarget.style.borderColor="var(--c-accent)40"; e.currentTarget.style.color="var(--c-text-3)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor="var(--c-border)"; e.currentTarget.style.color="var(--c-text-4)"; }}
                  >
                    <AlignLeft size={28} strokeWidth={1} />
                    <span className="text-[13px]">{t("no_sections")}</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    {open.sections.map((section) => (
                      <SectionBlock
                        key={section.id}
                        section={section}
                        color={open.color}
                        onUpdateTitle={(t) => updateSection(open.id, section.id, { title: t })}
                        onAddItem={() => addItem(open.id, section.id)}
                        onUpdateItem={(iid, text) => updateItem(open.id, section.id, iid, text)}
                        onDeleteItem={(iid) => deleteItem(open.id, section.id, iid)}
                        onDeleteSection={() => deleteSection(open.id, section.id)}
                        onMoveItem={(f, t) => moveItem(open.id, section.id, f, t)}
                      />
                    ))}
                    <button
                      onClick={() => addSection(open.id)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed transition-all text-[12px]" style={{ borderColor: "var(--c-border-sub)", color: "var(--c-text-4)" }} onMouseEnter={e => { e.currentTarget.style.borderColor="var(--c-accent)40"; e.currentTarget.style.color="var(--c-text-3)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor="var(--c-border-sub)"; e.currentTarget.style.color="var(--c-text-4)"; }}
                    >
                      <Plus size={12} />{t("add_section")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Blueprint mode ── */}
          {mode === "blueprint" && (
            <div className="h-full w-full">
              <Blueprint
                key={open.id}
                projectId={open.id}
                initialNodes={open.blueprint.nodes}
                initialEdges={open.blueprint.edges}
                onChange={saveBlueprintData}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // PROJECTS LIST VIEW
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden" style={{ background: "var(--c-bg)" }}>
      <div className="max-w-[900px] mx-auto px-6 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[20px] font-700 tracking-tight select-none" style={{ color: "var(--c-text-1)" }}>{t("projects")}</h1>
            <p className="text-[12px] mt-0.5 select-none" style={{ color: "var(--c-text-3)" }}>
              {projects.length === 0
                ? t("no_projects_title")
                : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Which view clicking a project card opens into */}
            <ModeSwitcher mode={mode} onChange={setMode} />
            <button
              onClick={createProject}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-500 transition-all active:scale-95" style={{ background: "var(--c-accent)", boxShadow: "0 4px 14px var(--c-accent)40" }} onMouseEnter={e => e.currentTarget.style.opacity="0.9"} onMouseLeave={e => e.currentTarget.style.opacity="1"}
            >
              <Plus size={14} strokeWidth={2.5} />{t("new_project")}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-24">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
              <Film size={32} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-600" style={{ color: "var(--c-text-2)" }}>{t("no_projects_title")}</p>
              <p className="text-[13px] mt-1.5 leading-relaxed max-w-[260px] mx-auto" style={{ color: "var(--c-text-3)" }}>
                {t("no_projects_hint")}
              </p>
            </div>
            <button
              onClick={createProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-500 transition-all active:scale-95" style={{ background: "var(--c-accent)", boxShadow: "0 4px 14px var(--c-accent)40" }}
            >
              <Plus size={14} strokeWidth={2.5} />{t("create_first")}
            </button>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => openProject(p.id)}
                onDelete={() => deleteProject(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
