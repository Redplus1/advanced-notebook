import React, { memo } from "react";
import { FileText, Film, Settings, BookOpen, CheckSquare, Image, FolderOpen } from "lucide-react";
import { t, useLang } from "../i18n";
import type { Tab } from "../types";

// Items defined outside — no re-creation on render
const NAV_ITEMS: { id: Tab; key: "notes" | "projects" | "tasks" | "images" | "files" | "settings"; icon: React.ReactNode }[] = [
  { id: "notes",    key: "notes",    icon: <FileText    size={14} strokeWidth={1.8} /> },
  { id: "projects", key: "projects", icon: <Film        size={14} strokeWidth={1.8} /> },
  { id: "tasks",    key: "tasks",    icon: <CheckSquare size={14} strokeWidth={1.8} /> },
  { id: "files",    key: "files",    icon: <FolderOpen  size={14} strokeWidth={1.8} /> },
  { id: "images",   key: "images",   icon: <Image       size={14} strokeWidth={1.8} /> },
  { id: "settings", key: "settings", icon: <Settings    size={14} strokeWidth={1.8} /> },
];

// Pure CSS hover — no React state, zero re-renders on hover
const NavButton: React.FC<{ id: Tab; active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> =
  ({ active, icon, label, onClick }) => (
    <button
      onClick={onClick}
      className={`nav-btn flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left w-full text-[13px] font-500 transition-all duration-150 active:scale-95 ${active ? "nav-btn--active" : ""}`}
    >
      <span className="nav-btn-icon">{icon}</span>
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.6)" }} />}
    </button>
  );

interface SidebarProps { activeTab: Tab; onTabChange: (tab: Tab) => void; }

export const Sidebar: React.FC<SidebarProps> = memo(({ activeTab, onTabChange }) => {
  useLang();
  return (
    <aside className="flex flex-col w-[200px] min-w-[200px] h-full border-r"
      style={{ background: "var(--c-surface)", borderColor: "var(--c-border-sub)" }}>
      <div className="flex items-center gap-2.5 px-4 py-5 border-b drag flex-shrink-0"
        style={{ borderColor: "var(--c-border-sub)" }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-2xl flex-shrink-0"
          style={{ background: "var(--c-accent)", boxShadow: "0 2px 8px var(--c-accent)50" }}>
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
      <nav className="flex flex-col gap-1 p-3 flex-1 no-drag">
        <div className="px-2 pb-2 pt-1">
          <span style={{ color: "var(--c-text-4)", fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {t("workspace")}
          </span>
        </div>
        {NAV_ITEMS.map(item => (
          <NavButton key={item.id} id={item.id} active={activeTab === item.id}
            icon={item.icon} label={t(item.key)} onClick={() => onTabChange(item.id)} />
        ))}
      </nav>
      <div className="px-4 py-3 border-t no-drag flex-shrink-0" style={{ borderColor: "var(--c-border-sub)" }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono" style={{ color: "var(--c-text-4)" }}>v1.5.0</div>
        </div>
      </div>
    </aside>
  );
});
