import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Notes } from "./components/Notes";
import { Projects } from "./components/Projects";
import { Tasks } from "./components/Tasks";
import { Files } from "./components/Files";
import { Images } from "./components/Images";
import { SettingsTab, getSavedTheme, applyTheme } from "./components/Settings";
import { useLang } from "./i18n";
import type { Tab } from "./types";

// Lazy-mount + keep-alive:
// A tab mounts on first visit, then stays mounted (CSS display toggle).
// This avoids mounting ALL heavy components (esp. ReactFlow) at startup,
// while still preserving Notes state after the first visit.
const TabPane: React.FC<{ active: boolean; mounted: boolean; children: React.ReactNode }> = ({ active, mounted, children }) => {
  if (!mounted) return null;
  return (
    <div style={{
      display: active ? "flex" : "none",
      position: "absolute", inset: 0,
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
};

const App: React.FC = () => {
  useLang();
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  // Track which tabs have been visited — only those are mounted
  const [mounted, setMounted] = useState<Set<Tab>>(new Set<Tab>(["notes"]));

  useEffect(() => { applyTheme(getSavedTheme()); }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMounted(prev => prev.has(tab) ? prev : new Set([...prev, tab]));
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-none"
      style={{ background: "var(--c-bg)", color: "var(--c-text-2)" }}
    >
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 h-full overflow-hidden" style={{ position: "relative" }}>
        <TabPane active={activeTab === "notes"}    mounted={mounted.has("notes")}>
          <Notes isActive={activeTab === "notes"} />
        </TabPane>
        <TabPane active={activeTab === "projects"} mounted={mounted.has("projects")}>
          <Projects />
        </TabPane>
        <TabPane active={activeTab === "tasks"}    mounted={mounted.has("tasks")}>
          <Tasks />
        </TabPane>
        <TabPane active={activeTab === "images"}   mounted={mounted.has("images")}>
          <Images />
        </TabPane>
        <TabPane active={activeTab === "files"}    mounted={mounted.has("files")}>
          <Files />
        </TabPane>
        <TabPane active={activeTab === "settings"} mounted={mounted.has("settings")}>
          <SettingsTab />
        </TabPane>
      </main>
    </div>
  );
};

export default App;
