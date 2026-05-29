import React, { useState } from "react";
import { FileText, Film, Settings, BookOpen, CheckSquare, Image, FolderOpen } from "lucide-react";
import { t, useLang } from "../i18n";
import type { Tab } from "../types";

// ─── NavButton — own hover state so styles reset on active change ─────────────

const NavButton: React.FC<{
  id: Tab;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => {
  const [hovered, setHovered] = useState(false);

  const bg    = active ? "var(--c-accent)" : hovered ? "var(--c-elevated)" : "transparent";
  const color = active ? "#fff"            : hovered ? "var(--c-text-1)"   : "var(--c-text-3)";
  const border= active ? "1px solid transparent" : hovered ? "1px solid var(--c-border)" : "1px solid transparent";
  const shadow= active ? "0 2px 10px var(--c-accent)40" : "none";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left w-full text-[13px] font-500 transition-all duration-150 active:scale-95"
      style={{ background: bg, color, border, boxShadow: shadow }}
    >
      <span style={{ color: active ? "#fff" : hovered ? "var(--c-text-2)" : "var(--c-text-4)" }}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.6)" }} />
      )}
    </button>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps { activeTab: Tab; onTabChange: (tab: Tab) => void; }

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  useLang();


  const items: { id: Tab; key: "notes" | "projects" | "tasks" | "images" | "files" | "settings"; icon: React.ReactNode }[] = [
    { id: "notes",    key: "notes",    icon: <FileText    size={14} strokeWidth={1.8} /> },
    { id: "projects", key: "projects", icon: <Film        size={14} strokeWidth={1.8} /> },
    { id: "tasks",    key: "tasks",    icon: <CheckSquare size={14} strokeWidth={1.8} /> },
    { id: "files",    key: "files",    icon: <FolderOpen size={14} strokeWidth={1.8} /> },
    { id: "images",   key: "images",   icon: <Image      size={14} strokeWidth={1.8} /> },
    { id: "settings", key: "settings", icon: <Settings    size={14} strokeWidth={1.8} /> },
  ];

  return (
    <aside
      className="flex flex-col w-[200px] min-w-[200px] h-full border-r"
      style={{ background: "var(--c-surface)", borderColor: "var(--c-border-sub)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-5 border-b drag flex-shrink-0"
        style={{ borderColor: "var(--c-border-sub)" }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-2xl flex-shrink-0"
          style={{ background: "var(--c-accent)", boxShadow: "0 2px 8px var(--c-accent)50" }}
        >
          <BookOpen size={14} style={{ color: "#fff" }} strokeWidth={2} />
        </div>
        <div>
          <div style={{ color: "var(--c-text-1)", fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>
            {t("app_name")}
          </div>
          <div style={{ color: "var(--c-text-4)", fontSize: 9, letterSpacing: "0.14em", lineHeight: 1, marginTop: 3, textTransform: "uppercase" }}>
            {t("app_sub")}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1 no-drag">
        <div className="px-2 pb-2 pt-1">
          <span style={{ color: "var(--c-text-4)", fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {t("workspace")}
          </span>
        </div>

        {items.map(item => (
          <NavButton
            key={item.id}
            id={item.id}
            active={activeTab === item.id}
            icon={item.icon}
            label={t(item.key)}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      <div
        className="px-4 py-3 border-t no-drag flex-shrink-0"
        style={{ borderColor: "var(--c-border-sub)" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>v1.4.0</div></div>
      </div>
    </aside>
  );
};
