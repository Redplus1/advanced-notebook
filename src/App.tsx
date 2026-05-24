import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Notes } from "./components/Notes";
import { Projects } from "./components/Projects";
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
        {/* Content — no top tab strip */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "notes"    && <Notes />}
          {activeTab === "projects" && <Projects />}
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
