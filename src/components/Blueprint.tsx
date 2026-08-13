import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import ReactFlow, {
  Background, Controls, Handle, Position, MarkerType,
  BackgroundVariant, ConnectionMode, NodeResizer, addEdge,
  useNodesState, useEdgesState, useReactFlow, useStore,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getBezierPath,
  type Connection, type Edge, type Node, type NodeProps, type EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, GitBranch, Trash2, X, Paperclip, Image as ImageIcon, ChevronUp, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { invoke } from "@tauri-apps/api/tauri";
import { t, useLang, useTheme, isLightTheme } from "../i18n";
import { readJSON, writeJSON } from "../lib/storage";

// Read border width directly from localStorage (avoids circular import)
function readBorderWidth(): number {
  return Number(localStorage.getItem("vss_border_width") ?? "3");
}

// Same trick for the connecting-line style set in Settings. "square" keeps
// the sharp-elbow step path; "round" switches to an actual smooth bezier
// curve — a step path with a rounded corner still reads as "square" next to
// the (always-bezier) line you see while dragging a new connection, so
// rounding the corner isn't enough to match that look.
type LineShape = "round" | "square";
function readLineShape(): LineShape {
  return (localStorage.getItem("vss_line_shape") as LineShape) ?? "round";
}

// ─── Color palettes ────────────────────────────────────────────────────────────

const PALETTE_DARK = [
  { id: "zinc",    bg: "#26262b", border: "#71717a", text: "#e4e4e8" },
  { id: "indigo",  bg: "#25235a", border: "#818cf8", text: "#e0e7ff" },
  { id: "sky",     bg: "#0a3a5c", border: "#38bdf8", text: "#e0f2fe" },
  { id: "emerald", bg: "#083d20", border: "#34d399", text: "#d1fae5" },
  { id: "amber",   bg: "#582200", border: "#fbbf24", text: "#fef3c7" },
  { id: "rose",    bg: "#5e0a24", border: "#fb7185", text: "#ffe4e6" },
  { id: "violet",  bg: "#3b1878", border: "#a78bfa", text: "#ede9fe" },
  { id: "teal",    bg: "#063b38", border: "#2dd4bf", text: "#ccfbf1" },
] as const;

const PALETTE_LIGHT = [
  { id: "zinc",    bg: "#e8e6e0", border: "#6b7280", text: "#1f2937" },
  { id: "indigo",  bg: "#dde3ff", border: "#4f46e5", text: "#1e1b4b" },
  { id: "sky",     bg: "#d8f0fd", border: "#0284c7", text: "#0c4a6e" },
  { id: "emerald", bg: "#d1fae5", border: "#059669", text: "#064e3b" },
  { id: "amber",   bg: "#fde68a", border: "#b45309", text: "#78350f" },
  { id: "rose",    bg: "#fecdd3", border: "#be123c", text: "#881337" },
  { id: "violet",  bg: "#e9d5ff", border: "#6d28d9", text: "#4c1d95" },
  { id: "teal",    bg: "#99f6e4", border: "#0f766e", text: "#134e4a" },
] as const;

type ColorId = typeof PALETTE_DARK[number]["id"];

function getPalette(theme: string) {
  return isLightTheme(theme) ? PALETTE_LIGHT : PALETTE_DARK;
}
function getColor(id: string, theme: string) {
  const palette = getPalette(theme) as typeof PALETTE_DARK | typeof PALETTE_LIGHT;
  return (palette as unknown as Array<{id:string;bg:string;border:string;text:string}>).find(p => p.id === id) ?? palette[0];
}

export interface BlockData { label: string; colorId: string; fontSize?: number; }
export interface ImageBlockData { name: string; thumbUrl: string; filePath: string; }
export interface FileBlockData { name: string; filePath: string; }
export type BPNodeData = BlockData | ImageBlockData | FileBlockData;
export type BPNode = Node<BPNodeData>;
export type BPEdge = Edge;
interface BPAttachment {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  thumbUrl: string;
  x: number;
  y: number;
  w: number;
}

const BP_ATTACH_KEY = "an_blueprint_attachments_v1";

function loadBPAttachments(): Record<string, BPAttachment[]> {
  return readJSON<Record<string, BPAttachment[]>>(BP_ATTACH_KEY, {});
}

function saveBPAttachments(a: Record<string, BPAttachment[]>) {
  writeJSON(BP_ATTACH_KEY, a);
}

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// ─── Blueprint persistence ─────────────────────────────────────────────────────
//
// An imageBlock's `thumbUrl` is a base64 data-url of the whole photo. Writing
// that into the project record meant a single 2 MB picture became ~2.7 MB of
// JSON in localStorage, and the origin quota (~5 MB) was blown after the first
// one — every later setItem threw and the failure was swallowed, so the canvas
// froze at whatever had last been written. The photo bytes already live on disk
// under AppData/attachments (see `save_attachment`), so the persisted node only
// needs its `filePath`; the data-url is rebuilt from disk on the next launch.

function mimeFor(name: string): string {
  const ext = fileExt(name);
  if (ext === "png")  return "image/png";
  if (ext === "gif")  return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg")  return "image/svg+xml";
  if (ext === "bmp")  return "image/bmp";
  return "image/jpeg";
}

function bytesToDataUrl(bytes: number[], name: string): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  // Chunked so a large picture doesn't blow the argument limit of String.fromCharCode.
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return `data:${mimeFor(name)};base64,${btoa(binary)}`;
}

function dataUrlToBytes(dataUrl: string): number[] {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Data-urls resolved this session, keyed by disk path. Switching tabs unmounts
// the canvas, so without this every visit re-reads every photo from disk.
const thumbCache = new Map<string, string>();

function isImageNode(n: BPNode): boolean {
  return n.type === "imageBlock";
}

/**
 * The exact shape that gets written to storage: no base64, and none of the
 * transient interaction flags React Flow hangs off a node (`selected`,
 * `dragging`, `resizing`, measured `width`/`height`). Dropping those also means
 * merely clicking a block no longer counts as an edit worth saving.
 */
export function serializeBlueprint(nodes: BPNode[], edges: BPEdge[]): { nodes: BPNode[]; edges: BPEdge[] } {
  return {
    nodes: nodes.map(n => {
      let data = n.data;
      if (isImageNode(n)) {
        const d = n.data as ImageBlockData;
        // Only safe to drop the data-url when the bytes are actually on disk.
        if (d.filePath) data = { ...d, thumbUrl: "" };
      }
      const out: BPNode = { id: n.id, type: n.type, position: n.position, data };
      if (n.style)  out.style  = n.style;
      if (n.zIndex !== undefined) out.zIndex = n.zIndex;
      return out;
    }),
    edges: edges.map(e => {
      const out: BPEdge = { id: e.id, source: e.source, target: e.target };
      if (e.sourceHandle) out.sourceHandle = e.sourceHandle;
      if (e.targetHandle) out.targetHandle = e.targetHandle;
      if (e.type)         out.type         = e.type;
      if (e.markerEnd)    out.markerEnd    = e.markerEnd;
      if (e.style)        out.style        = e.style;
      return out;
    }),
  };
}

/**
 * Rebuilds the displayable `thumbUrl` of every image node from disk, and
 * rescues legacy nodes whose bytes only ever existed as base64 in localStorage
 * by writing them out to disk now. Returns just the node data that changed, so
 * the caller can merge it without clobbering blocks added while this ran.
 */
export async function hydrateBlueprintNodes(
  projectId: string,
  nodes: BPNode[]
): Promise<Map<string, ImageBlockData>> {
  const patches = new Map<string, ImageBlockData>();

  await Promise.all(nodes.filter(isImageNode).map(async n => {
    const d = n.data as ImageBlockData;

    if (d.filePath && d.thumbUrl) { thumbCache.set(d.filePath, d.thumbUrl); return; }

    // Normal case: bytes on disk, data-url dropped at save time — read it back.
    if (d.filePath) {
      const cached = thumbCache.get(d.filePath);
      if (cached) { patches.set(n.id, { ...d, thumbUrl: cached }); return; }
      try {
        const bytes = await invoke<number[]>("read_attachment", { path: d.filePath });
        const thumbUrl = bytesToDataUrl(bytes, d.name);
        thumbCache.set(d.filePath, thumbUrl);
        patches.set(n.id, { ...d, thumbUrl });
      } catch (err) {
        console.error("[Blueprint] read_attachment failed for", d.filePath, err);
      }
      return;
    }

    // Legacy case: base64 in storage, nothing on disk — move it to disk so it
    // stops counting against the quota.
    if (d.thumbUrl.startsWith("data:")) {
      try {
        const filePath = await invoke<string>("save_attachment", {
          noteId: `blueprint_${projectId}`,
          fileName: d.name,
          data: dataUrlToBytes(d.thumbUrl),
        });
        thumbCache.set(filePath, d.thumbUrl);
        patches.set(n.id, { ...d, filePath });
      } catch (err) {
        console.error("[Blueprint] could not migrate inline photo to disk:", err);
      }
    }
  }));

  return patches;
}

// Fit an image's natural size into a reasonable initial block size while
// preserving its real aspect ratio, so it's never stretched or cropped.
const IMAGE_MAX_DIM = 320;
const IMAGE_MIN_DIM = 100;

function fitImageSize(naturalW: number, naturalH: number): { width: number; height: number } {
  if (!naturalW || !naturalH) return { width: 220, height: 160 };
  const aspect = naturalW / naturalH;
  let width = naturalW;
  let height = naturalH;

  if (width > IMAGE_MAX_DIM || height > IMAGE_MAX_DIM) {
    if (aspect >= 1) { width = IMAGE_MAX_DIM; height = Math.round(IMAGE_MAX_DIM / aspect); }
    else { height = IMAGE_MAX_DIM; width = Math.round(IMAGE_MAX_DIM * aspect); }
  }
  if (width < IMAGE_MIN_DIM && height < IMAGE_MIN_DIM) {
    if (aspect >= 1) { width = IMAGE_MIN_DIM; height = Math.round(IMAGE_MIN_DIM / aspect); }
    else { height = IMAGE_MIN_DIM; width = Math.round(IMAGE_MIN_DIM * aspect); }
  }

  return { width: Math.max(Math.round(width), IMAGE_MIN_DIM), height: Math.max(Math.round(height), 80) };
}

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(fitImageSize(img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve({ width: 220, height: 160 });
    img.src = url;
  });
}

function fileEmoji(name: string) {
  const ext = fileExt(name);
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx"].includes(ext)) return "📗";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
  if (["mp3", "wav"].includes(ext)) return "🎵";
  return "📄";
}

// ─── VideoBlock ────────────────────────────────────────────────────────────────

const HSTYLE: React.CSSProperties = { width: 10, height: 10, zIndex: 10 };

// Text blocks default to this font size. The size is no longer derived from
// the block's dimensions — the user sets it directly with the up/down
// stepper in the block's floating toolbar (see the JSX below).
const TEXT_DEFAULT_FONT = 13;
const TEXT_MIN_FONT = 9;
const TEXT_MAX_FONT = 40;
const TEXT_FONT_STEP = 1;
const TEXT_DEFAULT_HEIGHT = 90;

const VideoBlock: React.FC<NodeProps<BlockData>> = ({ id, data, selected }) => {
  useLang();
  const theme   = useTheme();
  const [editing,     setEditing]     = useState(false);
  const [draft,       setDraft]       = useState(data.label);
  const [showPalette, setShowPalette] = useState(false);
  const [borderWidth, setBorderWidth] = useState(readBorderWidth);
  const { setNodes }  = useReactFlow();
  const textRef       = useRef<HTMLTextAreaElement>(null);
  const paletteRef    = useRef<HTMLDivElement>(null);
  const contentRef    = useRef<HTMLDivElement>(null);

  // True while the user is actively dragging a NodeResizer handle. Auto-grow
  // must stay out of the way during that gesture — otherwise a live height
  // bump can fight the drag and it reads as "I can't resize this thing
  // horizontally, it just keeps stretching down".
  const isResizing = useStore(
    useCallback(s => !!s.nodeInternals.get(id)?.resizing, [id])
  );

  const fontSize = data.fontSize ?? TEXT_DEFAULT_FONT;

  // Listen to border width changes from Settings
  useEffect(() => {
    const h = (e: Event) => setBorderWidth((e as CustomEvent<number>).detail);
    window.addEventListener("vss-border-width", h);
    return () => window.removeEventListener("vss-border-width", h);
  }, []);

  useEffect(() => { if (editing && textRef.current) { textRef.current.focus(); textRef.current.select(); } }, [editing]);
  useEffect(() => { if (!editing) setDraft(data.label); }, [data.label, editing]);

  useEffect(() => {
    if (!showPalette) return;
    const h = (e: MouseEvent) => { if (!paletteRef.current?.contains(e.target as unknown as globalThis.Node)) setShowPalette(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPalette]);

  // Auto-grow: if the text no longer fits the block's current height, grow
  // the block just enough to fit it (never shrink automatically). Dragging a
  // corner handle still resizes width and height freely — this only kicks in
  // when content genuinely overflows what's there.
  //
  // While editing, overflow must be measured on the textarea itself
  // (scrollHeight vs its own clientHeight). Measuring the wrapper div
  // instead is wrong: a height:100% textarea's rendered box always reports
  // as fully filling the wrapper regardless of text length, so the wrapper
  // never "overflows" from real content — but it also never grows, or worse,
  // if the textarea's box-sizing adds its own padding on top of that 100%,
  // the wrapper looks like it overflows on *every* run, and the block
  // ratchets taller and taller on every keystroke/observer tick.
  useLayoutEffect(() => {
    if (isResizing) return; // manual drag always wins while it's happening
    const el = editing ? textRef.current : contentRef.current;
    if (!el) return;
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow > 1) {
      setNodes(ns => ns.map(n => {
        if (n.id !== id) return n;
        const curH = typeof n.style?.height === "number" ? n.style.height : TEXT_DEFAULT_HEIGHT;
        return { ...n, style: { ...n.style, height: Math.ceil(curH + overflow) } };
      }));
    }
  }, [draft, data.label, fontSize, editing, id, setNodes, isResizing]);

  const commit = useCallback(() => {
    const val = draft.trim() || t("block_default");
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
    setEditing(false);
  }, [draft, id, setNodes]);

  const setColor = useCallback((colorId: ColorId) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, colorId } } : n));
    setShowPalette(false);
  }, [id, setNodes]);

  const adjustFont = useCallback((delta: number) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== id) return n;
      const cur = (n.data as BlockData).fontSize ?? TEXT_DEFAULT_FONT;
      const next = Math.min(TEXT_MAX_FONT, Math.max(TEXT_MIN_FONT, cur + delta));
      return { ...n, data: { ...n.data, fontSize: next } };
    }));
  }, [id, setNodes]);

  const c = getColor(data.colorId, theme);
  const light = isLightTheme(theme);

  return (
    <>
      <NodeResizer
        isVisible={selected} minWidth={140} minHeight={36}
        color="var(--c-accent)"
        handleStyle={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-accent)", border: "2px solid #fff" }}
        lineStyle={{ borderColor: "rgba(99,102,241,0.4)", borderStyle: "dashed" }}
      />

      <Handle type="source" position={Position.Top}    id="top"    style={{ ...HSTYLE, top:    -5 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...HSTYLE, bottom: -5 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ ...HSTYLE, left:   -5 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ ...HSTYLE, right:  -5 }} />

      {/* Floating hint above block */}
      {selected && !editing && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          whiteSpace: "nowrap", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
          color: "var(--c-accent)", background: light ? "#fff" : "#18181b",
          border: "1px solid var(--c-accent)44", borderRadius: 20,
          padding: "3px 10px", pointerEvents: "none", userSelect: "none", zIndex: 100,
        }}>
          {t("node_hint")}
        </div>
      )}

      {/* Block body */}
      <div style={{
        width: "100%", height: "100%",
        background: c.bg,
        borderRadius: 12,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        /* Left stripe via border, uniform thin border on other sides */
        border: selected
          ? `2px solid var(--c-accent)`
          : `1px solid ${c.border}50`,
        borderLeftWidth: selected ? 2 : Math.max(1, borderWidth),
        borderLeftColor: selected ? "var(--c-accent)" : c.border,
        boxShadow: selected
          ? `0 8px 28px rgba(0,0,0,${light ? 0.12 : 0.5})`
          : `0 2px 10px rgba(0,0,0,${light ? 0.06 : 0.25})`,
        transition: "border-color 0.15s, box-shadow 0.15s, border-width 0.15s",
      }}>
        {/* Content — text stays pinned top-left as normal. Font size is set
            manually via the stepper in the floating toolbar below, not
            derived from the block's size. */}
        <div ref={contentRef} style={{ flex: 1, minHeight: 0, padding: "6px 10px", overflow: "hidden" }}>
          {editing ? (
            <textarea
              ref={textRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setEditing(false); setDraft(data.label); }
              }}
              className="nodrag nowheel text-select"
              style={{
                width: "100%", height: "100%", boxSizing: "border-box",
                background: light ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.35)",
                border: `1px solid ${c.border}50`,
                borderRadius: 6, padding: "4px 6px", outline: "none", resize: "none",
                color: c.text, fontSize, lineHeight: 1.6,
                caretColor: "var(--c-accent)",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            />
          ) : (
            <p onDoubleClick={() => setEditing(true)} style={{
              margin: 0, color: c.text, fontSize, lineHeight: 1.65,
              cursor: "default", whiteSpace: "pre-wrap",
              wordBreak: "break-word", userSelect: "none", overflow: "hidden",
            }}>
              {data.label || (
                <span style={{ color: light ? `${c.text}88` : `${c.text}55`, fontStyle: "italic", fontSize: 11 }}>
                  {t("dbl_to_edit")}
                </span>
              )}
            </p>
          )}
        </div>

      </div>

      {/* Toolbar — a floating overlay, not part of the block's layout, so
          opening it never pushes the block taller or leaves empty space. */}
      {selected && (
        <div className="nodrag" style={{ position: "absolute", top: 6, right: 6, zIndex: 20, display: "flex", gap: 4 }}>
          {/* Manual font size stepper */}
          <div className="nodrag" style={{
            display: "flex", flexDirection: "column", borderRadius: 5, overflow: "hidden",
            border: `1px solid ${light ? "#e0ddd8" : "#3f3f46"}`,
            background: light ? "#fff" : "#1a1a1f",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}>
            <button
              onClick={() => adjustFont(TEXT_FONT_STEP)}
              className="nodrag" title={`${t("font_size_btn")} +`}
              disabled={fontSize >= TEXT_MAX_FONT}
              style={{
                width: 16, height: 13, display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", background: "transparent", padding: 0,
                color: light ? "#3f3f46" : "#e4e4e8",
                cursor: fontSize >= TEXT_MAX_FONT ? "default" : "pointer",
                opacity: fontSize >= TEXT_MAX_FONT ? 0.35 : 1,
              }}
            >
              <ChevronUp size={11} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => adjustFont(-TEXT_FONT_STEP)}
              className="nodrag" title={`${t("font_size_btn")} -`}
              disabled={fontSize <= TEXT_MIN_FONT}
              style={{
                width: 16, height: 13, display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", borderTop: `1px solid ${light ? "#e0ddd8" : "#3f3f46"}`, background: "transparent", padding: 0,
                color: light ? "#3f3f46" : "#e4e4e8",
                cursor: fontSize <= TEXT_MIN_FONT ? "default" : "pointer",
                opacity: fontSize <= TEXT_MIN_FONT ? 0.35 : 1,
              }}
            >
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
          </div>

          {/* Color picker */}
          <div ref={paletteRef} className="nodrag" style={{ position: "relative" }}>
            <button
              onClick={() => setShowPalette(v => !v)}
              className="nodrag"
              title={t("color_btn")}
              style={{
                width: 16, height: 16, borderRadius: "50%", padding: 0,
                background: c.border,
                border: light ? "2px solid #ffffffcc" : "2px solid #18181bcc",
                boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                cursor: "pointer",
              }}
            />

            {showPalette && (
              <div className="nodrag" style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                display: "flex", gap: 6, padding: "8px 10px",
                background: light ? "#fff" : "#1a1a1f",
                border: `1px solid ${light ? "#e0ddd8" : "#3f3f46"}`,
                borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 200,
              }}>
                {getPalette(theme).map((p: any) => (
                  <button
                    key={p.id} onClick={() => setColor(p.id as ColorId)}
                    className="nodrag" title={p.id}
                    style={{
                      width: 18, height: 18, borderRadius: "50%", background: p.border,
                      border: data.colorId === p.id ? "2px solid var(--c-text-1)" : "2px solid transparent",
                      cursor: "pointer", transform: data.colorId === p.id ? "scale(1.25)" : "scale(1)",
                      transition: "transform 0.1s", flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ─── ImageBlock ────────────────────────────────────────────────────────────────

const ImageBlock: React.FC<NodeProps<ImageBlockData>> = ({ data, selected }) => {
  useLang();
  const theme = useTheme();
  const light = isLightTheme(theme);

  return (
    <>
      <NodeResizer
        isVisible={selected} minWidth={100} minHeight={80} keepAspectRatio
        color="var(--c-accent)"
        handleStyle={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-accent)", border: "2px solid #fff" }}
        lineStyle={{ borderColor: "rgba(99,102,241,0.4)", borderStyle: "dashed" }}
      />

      <Handle type="source" position={Position.Top}    id="top"    style={{ ...HSTYLE, top:    -5 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...HSTYLE, bottom: -5 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ ...HSTYLE, left:   -5 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ ...HSTYLE, right:  -5 }} />

      <div
        onDoubleClick={() => window.dispatchEvent(new CustomEvent("an-bp-lightbox", { detail: data.thumbUrl }))}
        title={t("bp_dbl_open_photo")}
        style={{
          width: "100%", height: "100%", borderRadius: 12, overflow: "hidden",
          border: selected ? "2px solid var(--c-accent)" : "1px solid var(--c-border)",
          boxShadow: selected
            ? `0 8px 28px rgba(0,0,0,${light ? 0.12 : 0.5})`
            : `0 2px 10px rgba(0,0,0,${light ? 0.06 : 0.25})`,
          background: "var(--c-surface)", cursor: "zoom-in",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <img
          src={data.thumbUrl}
          alt={data.name}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
        />
      </div>
    </>
  );
};

// ─── FileBlock ─────────────────────────────────────────────────────────────────

const FileBlock: React.FC<NodeProps<FileBlockData>> = ({ data, selected }) => {
  useLang();
  const theme = useTheme();
  const c = getColor("zinc", theme);

  const openFile = useCallback(async () => {
    if (!data.filePath) return;
    try { await invoke("open_file_native", { path: data.filePath }); } catch {}
  }, [data.filePath]);

  return (
    <>
      <NodeResizer
        isVisible={selected} minWidth={140} minHeight={56}
        color="var(--c-accent)"
        handleStyle={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-accent)", border: "2px solid #fff" }}
        lineStyle={{ borderColor: "rgba(99,102,241,0.4)", borderStyle: "dashed" }}
      />

      <Handle type="source" position={Position.Top}    id="top"    style={{ ...HSTYLE, top:    -5 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...HSTYLE, bottom: -5 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ ...HSTYLE, left:   -5 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ ...HSTYLE, right:  -5 }} />

      <div
        onDoubleClick={openFile}
        title={t("bp_dbl_open_file")}
        style={{
          width: "100%", height: "100%", borderRadius: 12, overflow: "hidden",
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: c.bg,
          border: selected ? "2px solid var(--c-accent)" : `1px solid ${c.border}50`,
          boxShadow: selected
            ? `0 8px 28px rgba(0,0,0,${isLightTheme(theme) ? 0.12 : 0.5})`
            : `0 2px 10px rgba(0,0,0,${isLightTheme(theme) ? 0.06 : 0.25})`,
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <span style={{ fontSize: 26, flexShrink: 0 }}>{fileEmoji(data.name)}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 500, color: c.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {data.name}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: `${c.text}88` }}>
            {fileExt(data.name).toUpperCase()}
          </p>
        </div>
      </div>
    </>
  );
};

const nodeTypes = { videoBlock: VideoBlock, imageBlock: ImageBlock, fileBlock: FileBlock };

// ─── Deletable edge ────────────────────────────────────────────────────────────

const DeletableEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected, markerEnd, style,
}) => {
  const { setEdges } = useReactFlow();
  const [lineShape, setLineShape] = useState<LineShape>(readLineShape);

  // Listen for the corner-style change from Settings
  useEffect(() => {
    const h = (e: Event) => setLineShape((e as CustomEvent<LineShape>).detail);
    window.addEventListener("vss-line-shape", h);
    return () => window.removeEventListener("vss-line-shape", h);
  }, []);

  const [edgePath, labelX, labelY] = lineShape === "round"
    ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    : getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 0 });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              zIndex: 50,
            }}
          >
            <button
              onClick={() => setEdges(es => es.filter(e => e.id !== id))}
              style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid #fff",
                color: "#fff",
                fontSize: 13, lineHeight: 1,
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                padding: 0,
              }}
              title={t("delete")}
            >
              <X size={11} strokeWidth={3} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = { deletable: DeletableEdge };
const defaultEdgeOptions = {
  type: "deletable" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#71717a" },
  style: { stroke: "#71717a", strokeWidth: 1.5 },
};

// ─── Blueprint component ────────────────────────────────────────────────────────

interface BlueprintProps {
  projectId: string;
  initialNodes: BPNode[];
  initialEdges: BPEdge[];
  /** `immediate` skips the parent's own debounce — used when the canvas is going away. */
  onChange: (nodes: BPNode[], edges: BPEdge[], immediate?: boolean) => void;
}

export const Blueprint: React.FC<BlueprintProps> = ({ projectId, initialNodes, initialEdges, onChange }) => {
  useLang();
  const [nodes, setNodes, onNodesChange] = useNodesState<BPNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for double-click-to-preview events dispatched by ImageBlock nodes
  useEffect(() => {
    const h = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (url) setLightboxUrl(url);
    };
    window.addEventListener("an-bp-lightbox", h);
    return () => window.removeEventListener("an-bp-lightbox", h);
  }, []);

  // One-time migration: older versions stored photos/files as a separate
  // localStorage overlay instead of real blueprint nodes — pull them in
  // so they gain zoom/pan/resize/connect behaviour like any other block.
  useEffect(() => {
    const legacy = loadBPAttachments();
    const legacyForProject = legacy[projectId];
    if (!legacyForProject || legacyForProject.length === 0) return;

    const migrated: BPNode[] = legacyForProject.map(att => {
      const isImg = !!att.thumbUrl;
      return isImg
        ? {
            id: `node_${att.id}`,
            type: "imageBlock",
            position: { x: att.x, y: att.y },
            data: { name: att.name, thumbUrl: att.thumbUrl, filePath: att.filePath },
            style: { width: att.w, height: Math.round(att.w * 0.7) },
          }
        : {
            id: `node_${att.id}`,
            type: "fileBlock",
            position: { x: att.x, y: att.y },
            data: { name: att.name, filePath: att.filePath },
            style: { width: Math.max(att.w, 160), height: 64 },
          };
    });

    setNodes(ns => [...ns, ...migrated]);

    // Correct the placeholder aspect ratio used above once the real image
    // dimensions are known, so migrated photos aren't stretched/cropped.
    legacyForProject.filter(att => !!att.thumbUrl).forEach(att => {
      loadImageSize(att.thumbUrl).then(({ width, height }) => {
        setNodes(ns => ns.map(n => n.id === `node_${att.id}` ? { ...n, style: { ...n.style, width, height } } : n));
      });
    });

    const rest = { ...legacy };
    delete rest[projectId];
    saveBPAttachments(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Rebuild every photo's data-url from disk. Nodes are patched by id rather
  // than wholesale so anything the user drops onto the canvas while this is in
  // flight survives.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const patches = await hydrateBlueprintNodes(projectId, initialNodes);
      if (cancelled || patches.size === 0) return;
      setNodes(ns => ns.map(n => {
        const patch = patches.get(n.id);
        return patch ? { ...n, data: patch } : n;
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Latest graph, readable from the unmount cleanup without re-subscribing it.
  const latestRef     = useRef({ nodes: initialNodes, edges: initialEdges });
  const lastSavedRef  = useRef<string | null>(null);

  const commit = useCallback((immediate: boolean) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const snap = serializeBlueprint(latestRef.current.nodes, latestRef.current.edges);
    const serialized = JSON.stringify(snap);
    // Selecting, dragging and rehydrating a photo all leave the persisted shape
    // untouched — no point writing (and no point bumping the project's
    // "updated" stamp) for those.
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    onChangeRef.current(snap.nodes, snap.edges, immediate);
  }, []);

  useEffect(() => {
    latestRef.current = { nodes, edges };
    if (lastSavedRef.current === null) {
      // Baseline from what we were handed, so the first real edit registers.
      lastSavedRef.current = JSON.stringify(serializeBlueprint(nodes, edges));
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => commit(false), 700);
  }, [nodes, edges, commit]);

  // Switching to Structure mode, hitting "Назад" or changing sidebar tab
  // unmounts this canvas. The pending debounce used to be cancelled here, which
  // silently threw away up to a second of work — flush it through instead.
  useEffect(() => () => commit(true), [commit]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({
      ...params, type: "deletable",
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--c-text-4)" },
      style: { stroke: "var(--c-text-4)", strokeWidth: 1.5 },
    }, eds)),
    [setEdges]
  );

  const addNode = useCallback(() => {
    setNodes(ns => [...ns, {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: "videoBlock",
      position: { x: 140 + Math.random() * 320, y: 80 + Math.random() * 220 },
      data: { label: "", colorId: "zinc" },
      style: { width: 180, height: 90 },
    }]);
  }, [setNodes]);

  // Removing a photo/file block must also remove its bytes from
  // AppData/attachments — otherwise every deleted picture stays on disk
  // forever as an orphan the user has no way to see or clean up.
  //
  // A path is only deleted once no block still points at it. Two blocks can
  // legitimately share one file: `save_attachment` names the file after the
  // original filename, so adding the same picture twice to one blueprint
  // yields the same path, and deleting one of the two must not pull the file
  // out from under the other.
  const removeNodeFiles = useCallback((removed: BPNode[], remaining: BPNode[]) => {
    const pathOf = (n: BPNode) => (n.data as { filePath?: string }).filePath;
    const stillReferenced = new Set(remaining.map(pathOf).filter(Boolean));

    const orphaned = new Set<string>();
    for (const n of removed) {
      const p = pathOf(n);
      if (p && !stillReferenced.has(p)) orphaned.add(p);
    }

    orphaned.forEach(path => {
      thumbCache.delete(path);
      invoke("delete_attachment", { path }).catch(err => {
        // A file that is already gone is not worth bothering the user about.
        console.error("[Blueprint] delete_attachment failed for", path, err);
      });
    });
  }, []);

  const deleteSelected = useCallback(() => {
    const current   = latestRef.current.nodes;
    const removed   = current.filter(n => n.selected);
    if (removed.length === 0) { setEdges(es => es.filter(e => !e.selected)); return; }
    const remaining = current.filter(n => !n.selected);
    removeNodeFiles(removed, remaining);
    setNodes(remaining);
    setEdges(es => es.filter(e => !e.selected));
  }, [setNodes, setEdges, removeNodeFiles]);

  // Delete/Backspace removes nodes inside React Flow itself, which never goes
  // through `deleteSelected` — this is the same cleanup for that route.
  const onNodesDelete = useCallback((deleted: BPNode[]) => {
    const deletedIds = new Set(deleted.map(n => n.id));
    removeNodeFiles(deleted, latestRef.current.nodes.filter(n => !deletedIds.has(n.id)));
  }, [removeNodeFiles]);

  // Layering: node.zIndex (not style.zIndex) is what React Flow actually
  // uses for stacking order, so bumping the selected node's zIndex above
  // the current max — or below the current min — moves it in front of or
  // behind every other block without touching anyone else's value.
  const bringToFront = useCallback(() => {
    setNodes(ns => {
      const maxZ = Math.max(0, ...ns.map(n => n.zIndex ?? 0));
      return ns.map(n => n.selected ? { ...n, zIndex: maxZ + 1 } : n);
    });
  }, [setNodes]);

  const sendToBack = useCallback(() => {
    setNodes(ns => {
      const minZ = Math.min(0, ...ns.map(n => n.zIndex ?? 0));
      return ns.map(n => n.selected ? { ...n, zIndex: minZ - 1 } : n);
    });
  }, [setNodes]);

  // Photos/files are added as real ReactFlow nodes, so they pan, zoom,
  // resize, select, delete, and connect via arrows exactly like a block.
  const addAttachment = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const isImg = file.type.startsWith("image/");
      const nodeId = `node_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const position = { x: 140 + Math.random() * 320, y: 80 + Math.random() * 220 };
      const reader = new FileReader();
      reader.onload = async ev => {
        let filePath = "";
        try {
          const buf = await file.arrayBuffer();
          filePath = await invoke<string>("save_attachment", {
            noteId: `blueprint_${projectId}`, fileName: file.name,
            data: Array.from(new Uint8Array(buf)),
          });
        } catch (err) {
          // Without a disk copy the photo has to ride along inside the project
          // JSON, which is exactly what overruns the storage quota — so say so.
          console.error("[Blueprint] save_attachment failed for", file.name, err);
        }

        if (isImg) {
          const thumbUrl = String(ev.target?.result ?? "");
          if (filePath) thumbCache.set(filePath, thumbUrl);
          const { width, height } = await loadImageSize(thumbUrl);
          setNodes(ns => [...ns, {
            id: nodeId, type: "imageBlock", position,
            data: { name: file.name, thumbUrl, filePath },
            style: { width, height },
          }]);
        } else {
          setNodes(ns => [...ns, {
            id: nodeId, type: "fileBlock", position,
            data: { name: file.name, filePath },
            style: { width: 200, height: 64 },
          }]);
        }
      };
      if (isImg) reader.readAsDataURL(file);
      else reader.onload({ target: { result: "" } } as ProgressEvent<FileReader>);
    }
  }, [projectId, setNodes]);

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={addNode}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[12px] font-500 transition-all duration-150 shadow-lg backdrop-blur-sm"
          style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-1)"; e.currentTarget.style.borderColor = "var(--c-accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-2)"; e.currentTarget.style.borderColor = "var(--c-border)"; }}
        >
          <Plus size={13} strokeWidth={2.5} /> {t("add_block")}
        </button>
        <button
          onClick={deleteSelected}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] transition-all duration-150 shadow-lg backdrop-blur-sm"
          style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-4)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.borderColor = "#f43f5e44"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-4)"; e.currentTarget.style.borderColor = "var(--c-border)"; }}
        >
          <Trash2 size={12} />
        </button>
        <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => addAttachment(e.target.files)}
        />

        <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => addAttachment(e.target.files)}
        />

        <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] transition-all shadow-lg backdrop-blur-sm"
            style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}
        >
            <ImageIcon size={12} /> {t("bp_add_photo")}
        </button>

        <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] transition-all shadow-lg backdrop-blur-sm"
            style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}
        >
            <Paperclip size={12} /> {t("bp_add_file")}
        </button>

        <div className="flex items-center rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm"
          style={{ border: "1px solid var(--c-border)" }}>
          <button
              onClick={bringToFront}
              title={t("bp_bring_front")}
              className="flex items-center px-2.5 py-2 transition-all duration-150"
              style={{ background: "var(--c-card)", color: "var(--c-text-3)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-1)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; }}
          >
              <ArrowUp size={13} />
          </button>
          <button
              onClick={sendToBack}
              title={t("bp_send_back")}
              className="flex items-center px-2.5 py-2 transition-all duration-150"
              style={{ background: "var(--c-card)", color: "var(--c-text-3)", borderLeft: "1px solid var(--c-border)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-1)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; }}
          >
              <ArrowDown size={13} />
          </button>
        </div>

        <div className="hidden lg:flex px-3 py-2 rounded-2xl text-[10px] font-mono gap-2 select-none backdrop-blur-sm"
          style={{ background: "var(--c-card)cc", border: "1px solid var(--c-border-sub)", color: "var(--c-text-4)" }}>
          <span>{t("bp_hint_connect")}</span>
          <span>·</span>
          <span>{t("bp_hint_resize")}</span>
          <span>·</span>
          <span>{t("bp_hint_del")}</span>
        </div>
      </div>

      {/* Save state is already shown once, next to the mode switcher in the
          project header — no need to duplicate it here inside the canvas. */}

      {/* Empty hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
            <GitBranch size={28} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-500" style={{ color: "var(--c-text-3)" }}>{t("empty_bp")}</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--c-text-4)" }}>{t("empty_bp_hint")}</p>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        fitView={initialNodes.length > 0}
        fitViewOptions={{ padding: 0.4 }}
        deleteKeyCode={["Delete", "Backspace"]}
        minZoom={0.15} maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        elevateNodesOnSelect={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--c-rf-dot, #1c1c1f)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {lightboxUrl && (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.88)" }}
            onClick={() => setLightboxUrl(null)}
        >
            <button
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-2xl"
                style={{
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                }}
            >
                <X size={20} />
            </button>

            <img
                src={lightboxUrl}
                style={{
                    maxWidth: "92vw",
                    maxHeight: "92vh",
                    objectFit: "contain",
                    borderRadius: 12,
                }}
            />
        </div>
      )}
    </div>
  );
};
