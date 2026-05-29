import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { Notes } from "./components/Notes";
import { Projects } from "./components/Projects";
import { Tasks } from "./components/Tasks";
import { Files } from "./components/Files";
import { Images } from "./components/Images";
import { SettingsTab, getSavedTheme, applyTheme } from "./components/Settings";
import { useLang } from "./i18n";
import type { Tab } from "./types";

// Keep ALL tabs mounted — CSS display toggle preserves their state.
// This prevents Notes from re-reading localStorage & reinitializing
// every time you switch tabs and come back.
const TabPane: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{
    display: active ? "flex" : "none",
    flex: 1,
    height: "100%",
    overflow: "hidden",
    flexDirection: "column",
    position: active ? "relative" : "absolute",
    width: "100%",
  }}>
    {children}
  </div>
);

const App: React.FC = () => {
  useLang();
  const [activeTab, setActiveTab] = useState<Tab>("notes");

  useEffect(() => { applyTheme(getSavedTheme()); }, []);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-none"
      style={{ background: "var(--c-bg)", color: "var(--c-text-2)" }}
    >
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 flex flex-col h-full overflow-hidden" style={{ position: "relative" }}>
        <TabPane active={activeTab === "notes"}>
          <Notes isActive={activeTab === "notes"} />
        </TabPane>
        <TabPane active={activeTab === "projects"}>
          <Projects />
        </TabPane>
        <TabPane active={activeTab === "tasks"}>
          <Tasks />
        </TabPane>
        <TabPane active={activeTab === "images"}>
          <Images />
        </TabPane>
        <TabPane active={activeTab === "files"}>
          <Files />
        </TabPane>
        <TabPane active={activeTab === "settings"}>
          <SettingsTab />
        </TabPane>
      </main>
    </div>
  );
};

export default App;
