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

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-hidden" style={{ position: "relative" }}>
          {activeTab === "notes"    && <Notes isActive />}
          {activeTab === "projects" && <Projects />}
          {activeTab === "tasks"    && <Tasks />}
          {activeTab === "images"   && <Images />}
          {activeTab === "files"    && <Files />}
          {activeTab === "settings" && (
            <div className="flex h-full overflow-hidden">
              <SettingsTab />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
