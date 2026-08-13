import React, { useState } from "react";
import { Check, Moon, Sun, Flower, Leaf, Monitor } from "lucide-react";
import { t, useLang, changeLang, getLang, type Lang } from "../i18n";
import { writeString } from "../lib/storage";

export type ThemeId = "dark" | "midnight" | "soft-light" | "pastel-rose" | "pastel-mint";

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  writeString("vss_theme", id);
  window.dispatchEvent(new CustomEvent("vss-theme", { detail: id }));
}
export function getSavedTheme(): ThemeId {
  return (localStorage.getItem("vss_theme") as ThemeId) ?? "dark";
}
export function getBorderWidth(): number {
  return Number(localStorage.getItem("vss_border_width") ?? "3");
}

// Corner style of the lines connecting blocks (not the connection dots).
// Blueprint.tsx reads this itself (readLineShape) and listens for the event
// to redraw open edges live, the same way it reacts to border-width changes.
export type LineShape = "round" | "square";
export function applyLineShape(shape: LineShape) {
  writeString("vss_line_shape", shape);
  window.dispatchEvent(new CustomEvent("vss-line-shape", { detail: shape }));
}
export function getLineShape(): LineShape {
  return (localStorage.getItem("vss_line_shape") as LineShape) ?? "round";
}

// ─── Theme definitions ─────────────────────────────────────────────────────────

interface ThemeDef {
  id: ThemeId; nameKey: string; descKey: string; icon: React.ReactNode;
  preview: { bg: string; surface: string; border: string; text1: string; text2: string; accent: string };
}
const THEMES: ThemeDef[] = [
  { id: "dark",        nameKey: "t_dark",     descKey: "t_dark_d",     icon: <Moon    size={14} />, preview: { bg: "#0a0a0b", surface: "#18181b", border: "#27272a", text1: "#f4f4f5", text2: "#71717a", accent: "#6366f1" } },
  { id: "midnight",    nameKey: "t_midnight", descKey: "t_midnight_d", icon: <Monitor size={14} />, preview: { bg: "#07091a", surface: "#151a38", border: "#1e2850", text1: "#e8efff", text2: "#5870b8", accent: "#7b8fff" } },
  { id: "soft-light",  nameKey: "t_light",    descKey: "t_light_d",    icon: <Sun     size={14} />, preview: { bg: "#f6f4ef", surface: "#e5e2da", border: "#c8c5bc", text1: "#18161a", text2: "#6a6866", accent: "#5558d8" } },
  { id: "pastel-rose", nameKey: "t_rose",     descKey: "t_rose_d",     icon: <Flower  size={14} />, preview: { bg: "#fef6f9", surface: "#f0e0ea", border: "#d4b8ce", text1: "#261420", text2: "#8a6080", accent: "#c85890" } },
  { id: "pastel-mint", nameKey: "t_mint",     descKey: "t_mint_d",     icon: <Leaf    size={14} />, preview: { bg: "#f2faf8", surface: "#d8ede8", border: "#a8d0c8", text1: "#102820", text2: "#508878", accent: "#1f7a68" } },
];

// ─── Theme card ────────────────────────────────────────────────────────────────

const ThemeCard: React.FC<{ theme: ThemeDef; active: boolean; onClick: () => void }> = ({ theme: th, active, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col gap-3 p-4 rounded-2xl text-left w-full transition-all duration-150 active:scale-95"
    style={{
      background: th.preview.bg,
      border: active ? `2px solid ${th.preview.accent}` : `2px solid ${th.preview.border}`,
      boxShadow: active ? `0 4px 16px ${th.preview.accent}28` : "none",
    }}
  >
    {active && (
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: th.preview.accent }}>
        <Check size={11} className="text-white" strokeWidth={3} />
      </div>
    )}
    {/* Preview */}
    <div className="w-full h-12 rounded-xl overflow-hidden" style={{ border: `1px solid ${th.preview.border}`, background: th.preview.bg }}>
      <div className="h-full" style={{ width: "28%", float: "left", background: th.preview.surface, borderRight: `1px solid ${th.preview.border}` }}>
        {[0,1,2].map(i => (
          <div key={i} className="mx-2 mt-1.5 rounded" style={{ height: 4, background: i === 0 ? th.preview.accent : th.preview.border, opacity: i === 0 ? 0.85 : 0.5, width: i === 0 ? "60%" : `${45 - i * 8}%` }} />
        ))}
      </div>
      <div className="overflow-hidden" style={{ marginLeft: "28%" }}>
        {[0,1,2].map(i => (
          <div key={i} className="mx-3 mt-1.5 rounded" style={{ height: 4, background: i === 0 ? th.preview.text1 : th.preview.text2, opacity: i === 0 ? 0.75 : 0.3, width: i === 0 ? "55%" : `${65 - i * 12}%` }} />
        ))}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span style={{ color: th.preview.accent }}>{th.icon}</span>
      <div>
        <p className="text-[12px] font-600 leading-snug" style={{ color: th.preview.text1 }}>{t(th.nameKey as any)}</p>
        <p className="text-[10px] mt-0.5" style={{ color: th.preview.text2 }}>{t(th.descKey as any)}</p>
      </div>
    </div>
  </button>
);

// ─── Language toggle ───────────────────────────────────────────────────────────

const LangToggle: React.FC<{ value: Lang; onChange: (l: Lang) => void }> = ({ value, onChange }) => (
  <div
    className="flex items-center rounded-2xl p-1 gap-1"
    style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
  >
    {(["ru", "en"] as Lang[]).map(lang => (
      <button
        key={lang}
        onClick={() => onChange(lang)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-500 transition-all duration-150 active:scale-95"
        style={{
          background: value === lang ? "var(--c-accent)" : "transparent",
          color: value === lang ? "#fff" : "var(--c-text-3)",
          boxShadow: value === lang ? "0 2px 8px var(--c-accent)40" : "none",
        }}
      >
        <span style={{ fontSize: 16 }}>{lang === "ru" ? "🇷🇺" : "🇬🇧"}</span>
        {lang === "ru" ? "Русский" : "English"}
        {value === lang && <Check size={12} strokeWidth={3} />}
      </button>
    ))}
  </div>
);

// ─── Border width slider ────────────────────────────────────────────────────────

const BorderSlider: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-4">
    {/* Preview blocks */}
    <div className="flex items-center gap-2 flex-shrink-0">
      {[0, 2, 4, 6].map(w => (
        <div
          key={w}
          onClick={() => onChange(w)}
          className="cursor-pointer rounded-xl transition-all duration-150 active:scale-90"
          style={{
            width: 36, height: 28,
            background: "var(--c-elevated)",
            boxShadow: value === w
              ? `0 0 0 2px var(--c-accent)`
              : `0 0 0 1px var(--c-border)`,
            borderLeft: w > 0 ? `${w}px solid var(--c-accent)` : "none",
            opacity: value === w ? 1 : 0.6,
            transform: value === w ? "scale(1.08)" : "scale(1)",
          }}
        />
      ))}
    </div>
    {/* Slider */}
    <div className="flex-1">
      <input
        type="range"
        min={0} max={8} step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--c-accent)" }}
      />
      <div className="flex justify-between text-[10px] font-mono mt-1" style={{ color: "var(--c-text-4)" }}>
        <span>0</span>
        <span style={{ color: "var(--c-accent)" }}>{value}px</span>
        <span>8</span>
      </div>
    </div>
  </div>
);

// ─── Connecting-line shape picker ───────────────────────────────────────────────
// Previews the two edge styles Blueprint actually draws: a sharp right-angle
// elbow ("square") vs. a smooth bezier curve ("round") — matching what you
// see in the canvas, not just a rounded corner on the same elbow shape.

const LineShapePreview: React.FC<{ shape: LineShape; color: string }> = ({ shape, color }) => (
  <svg width="34" height="24" viewBox="0 0 34 24" fill="none">
    {shape === "square" ? (
      <path d="M5 20 L5 8 L29 8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M5 20 C5 8 5 8 29 8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    )}
    <circle cx="5" cy="20" r="2.5" fill={color} />
    <circle cx="29" cy="8" r="2.5" fill={color} />
  </svg>
);

const LINE_SHAPES: { id: LineShape; labelKey: string }[] = [
  { id: "round",  labelKey: "line_round" },
  { id: "square", labelKey: "line_square" },
];

const LineShapePicker: React.FC<{ value: LineShape; onChange: (s: LineShape) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-3">
    {LINE_SHAPES.map(s => (
      <button
        key={s.id}
        onClick={() => onChange(s.id)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 active:scale-95"
        style={{
          background: "var(--c-elevated)",
          boxShadow: value === s.id ? `0 0 0 2px var(--c-accent)` : `0 0 0 1px var(--c-border)`,
          opacity: value === s.id ? 1 : 0.7,
        }}
      >
        <LineShapePreview shape={s.id} color={value === s.id ? "var(--c-accent)" : "var(--c-text-4)"} />
        <span className="text-[12px] font-500" style={{ color: value === s.id ? "var(--c-text-1)" : "var(--c-text-3)" }}>
          {t(s.labelKey as any)}
        </span>
        {value === s.id && <Check size={12} strokeWidth={3} style={{ color: "var(--c-accent)" }} />}
      </button>
    ))}
  </div>
);

// ─── Settings component ────────────────────────────────────────────────────────

export const SettingsTab: React.FC = () => {
  useLang();
  const [theme,     setTheme]     = useState<ThemeId>(getSavedTheme);
  const [lang,      setLangState] = useState<Lang>(getLang);
  const [borderW,   setBorderW]   = useState<number>(getBorderWidth);
  const [lineShape, setLineShape] = useState<LineShape>(getLineShape);
  const [saved,     setSaved]     = useState(false);

  const handleTheme = (id: ThemeId) => { applyTheme(id); setTheme(id); };

  const handleLang = (l: Lang) => { changeLang(l); setLangState(l); };

  const handleBorderW = (n: number) => {
    setBorderW(n);
    writeString("vss_border_width", String(n));
    window.dispatchEvent(new CustomEvent("vss-border-width", { detail: n }));
  };

  const handleLineShape = (s: LineShape) => {
    setLineShape(s);
    applyLineShape(s);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden" style={{ background: "var(--c-bg)" }}>
      <div className="max-w-[600px] mx-auto px-6 py-8 pb-24">

        {/* Header */}
        <div className="mb-8">
          <h1 style={{ color: "var(--c-text-1)", fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            {t("settings_title")}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--c-text-3)" }}>{t("settings_sub")}</p>
        </div>

        {/* Appearance */}
        <Section title={t("appearance")} hint={t("appearance_hint")}>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {THEMES.map(th => (
              <ThemeCard key={th.id} theme={th} active={theme === th.id} onClick={() => handleTheme(th.id)} />
            ))}
          </div>
        </Section>

        {/* Language */}
        <Section title={t("lang_label")} hint={t("lang_hint")}>
          <LangToggle value={lang} onChange={handleLang} />
        </Section>

        {/* Blueprint */}
        <Section title="Blueprint" hint={t("border_width_hint")}>
          <div className="rounded-2xl p-5 flex flex-col gap-6" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
            <div>
              <p className="text-[13px] font-500 mb-4" style={{ color: "var(--c-text-2)" }}>{t("border_width")}</p>
              <BorderSlider value={borderW} onChange={handleBorderW} />
            </div>
            <div>
              <p className="text-[13px] font-500 mb-1" style={{ color: "var(--c-text-2)" }}>{t("line_shape")}</p>
              <p className="text-[11px] mb-4" style={{ color: "var(--c-text-4)" }}>{t("line_shape_hint")}</p>
              <LineShapePicker value={lineShape} onChange={handleLineShape} />
            </div>
          </div>
        </Section>

        {/* About */}
        <Section title={t("about_label")} hint="">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
            {[
              ["App", "Advanced Notebook"],
              ["Version", "1.6.1"],
              ["Stack", "Tauri · React · TypeScript · SQLite · React Flow"],
            ].map(([k, v], i) => (
              <div key={k} className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                <span className="text-[12px]" style={{ color: "var(--c-text-3)" }}>{k}</span>
                <span className="text-[12px] font-mono" style={{ color: "var(--c-text-2)" }}>{v}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Save */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-[13px] font-500 transition-all active:scale-95"
            style={{ background: "var(--c-accent)", boxShadow: "0 4px 16px var(--c-accent)44" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            {t("save_btn")}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: "var(--c-accent)" }}>
              <Check size={13} strokeWidth={3} />{t("saved")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="mb-8">
    <div className="mb-3">
      <h2 className="text-[11px] font-600 tracking-widest uppercase" style={{ color: "var(--c-text-3)" }}>{title}</h2>
      {hint && <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-4)" }}>{hint}</p>}
    </div>
    {children}
  </div>
);
