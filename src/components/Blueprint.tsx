import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background, Controls, Handle, Position, MarkerType,
  BackgroundVariant, ConnectionMode, NodeResizer, addEdge,
  useNodesState, useEdgesState, useReactFlow,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
  type Connection, type Edge, type Node, type NodeProps, type EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, Check, Loader2, GitBranch, Trash2, X } from "lucide-react";
import { t, useLang, useTheme, isLightTheme } from "../i18n";

// Read border width directly from localStorage (avoids circular import)
function readBorderWidth(): number {
  return Number(localStorage.getItem("vss_border_width") ?? "3");
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

export interface BlockData { label: string; colorId: string; }
export type BPNode = Node<BlockData>;
export type BPEdge = Edge;

// ─── VideoBlock ────────────────────────────────────────────────────────────────

const HSTYLE: React.CSSProperties = { width: 10, height: 10, zIndex: 10 };

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

  const commit = useCallback(() => {
    const val = draft.trim() || t("block_default");
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
    setEditing(false);
  }, [draft, id, setNodes]);

  const setColor = useCallback((colorId: ColorId) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, colorId } } : n));
    setShowPalette(false);
  }, [id, setNodes]);

  const c = getColor(data.colorId, theme);
  const light = isLightTheme(theme);

  return (
    <>
      <NodeResizer
        isVisible={selected} minWidth={140} minHeight={64}
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
        {/* Content */}
        <div style={{ flex: 1, padding: "10px 12px 8px", overflow: "hidden" }}>
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
                width: "100%", height: "100%",
                background: light ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.35)",
                border: `1px solid ${c.border}50`,
                borderRadius: 6, padding: "6px 8px", outline: "none", resize: "none",
                color: c.text, fontSize: 13, lineHeight: 1.6,
                caretColor: "var(--c-accent)",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            />
          ) : (
            <p onDoubleClick={() => setEditing(true)} style={{
              margin: 0, color: c.text, fontSize: 13, lineHeight: 1.65,
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

        {/* Bottom toolbar */}
        {selected && !editing && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 8px",
            borderTop: `1px solid ${c.border}30`,
            background: light ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.2)",
            flexShrink: 0, position: "relative",
          }}>
            <div ref={paletteRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowPalette(v => !v)}
                className="nodrag"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "2px 8px", borderRadius: 6,
                  border: `1px solid ${c.border}40`,
                  background: light ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.25)",
                  cursor: "pointer", color: c.text, fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.border, display: "inline-block", flexShrink: 0 }} />
                {t("color_btn")}
              </button>

              {showPalette && (
                <div className="nodrag" style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: 0,
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
            <span style={{ marginLeft: "auto", color: light ? `${c.text}55` : `${c.text}33`, fontSize: 9, fontFamily: "monospace", userSelect: "none" }}>
              dbl · del
            </span>
          </div>
        )}
      </div>
    </>
  );
};

const nodeTypes = { videoBlock: VideoBlock };

// ─── Deletable edge ────────────────────────────────────────────────────────────

const DeletableEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected, markerEnd, style,
}) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

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
  initialNodes: BPNode[];
  initialEdges: BPEdge[];
  onChange: (nodes: BPNode[], edges: BPEdge[]) => void;
}

export const Blueprint: React.FC<BlueprintProps> = ({ initialNodes, initialEdges, onChange }) => {
  useLang();
  const [nodes, setNodes, onNodesChange] = useNodesState<BlockData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipFirst   = useRef(true);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saving");
      onChangeRef.current(nodes, edges);
      setTimeout(() => { setSaveState("saved"); setTimeout(() => setSaveState("idle"), 2000); }, 250);
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [nodes, edges]);

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

  const deleteSelected = useCallback(() => {
    setNodes(ns => ns.filter(n => !n.selected));
    setEdges(es => es.filter(e => !e.selected));
  }, [setNodes, setEdges]);

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
        <div className="hidden lg:flex px-3 py-2 rounded-2xl text-[10px] font-mono gap-2 select-none backdrop-blur-sm"
          style={{ background: "var(--c-card)cc", border: "1px solid var(--c-border-sub)", color: "var(--c-text-4)" }}>
          <span>{t("bp_hint_connect")}</span>
          <span>·</span>
          <span>{t("bp_hint_resize")}</span>
          <span>·</span>
          <span>{t("bp_hint_del")}</span>
        </div>
      </div>

      {/* Save indicator */}
      <div className="absolute top-4 right-4 z-10">
        {saveState === "saving" && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-xl backdrop-blur-sm"
            style={{ background: "var(--c-card)ee", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
            <Loader2 size={10} className="animate-spin" />{t("saving")}
          </span>
        )}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-xl backdrop-blur-sm"
            style={{ background: "var(--c-card)ee", border: "1px solid var(--c-border)", color: "#10b981" }}>
            <Check size={10} strokeWidth={3} />{t("saved")}
          </span>
        )}
      </div>

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
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--c-rf-dot, #1c1c1f)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
