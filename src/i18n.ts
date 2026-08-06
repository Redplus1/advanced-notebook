import { useState, useEffect } from "react";

export type Lang = "en" | "ru";
export const LANG_KEY = "an_lang";

// ─── Module-level state ────────────────────────────────────────────────────────
let _lang: Lang = (localStorage.getItem(LANG_KEY) as Lang) ?? "ru";
const _listeners = new Set<() => void>();

export const getLang = (): Lang => _lang;

export const changeLang = (lang: Lang): void => {
  _lang = lang;
  localStorage.setItem(LANG_KEY, lang);
  _listeners.forEach((fn) => fn());
};

export const useLang = (): Lang => {
  const [lang, setLang] = useState<Lang>(_lang);
  useEffect(() => {
    const update = () => setLang(_lang);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);
  return lang;
};

// ─── Translations ──────────────────────────────────────────────────────────────

const T = {
  en: {
    // Nav
    notes: "Notes",
    projects: "Projects",
    settings: "Settings",
    tasks: "Tasks",
    images: "Images",
    files: "Files",
    workspace: "Workspace",
    app_name: "Advanced",
    app_sub: "Notebook",

    // Notes
    new_note: "New Note",
    search: "Search…",
    no_notes_title: "No notes yet",
    no_notes_hint: "Press + to create your first note",
    select_note: "Select a note",
    select_note_hint: "Or create a new one",
    note_placeholder: "Note title…",
    write_placeholder: "Start writing…",
    add_tag: "Add tag…",
    words: "words",
    chars: "chars",
    edited: "edited",
    delete: "Delete",
    saving: "Saving…",
    saved: "Saved",
    no_results: "Nothing found",
    untitled: "Untitled",
    shortcut_hint: "⌘N  new note",
    just_now: "just now",
    ago: "ago",
    time_s: "s",
    time_m: "m",
    time_h: "h",
    time_d: "d",
    block_default: "Block",
    project_placeholder: "Project title…",
    border_width: "Block border width",
    border_width_hint: "Left stripe thickness in Blueprint blocks (0 = hidden)",

    // Projects
    new_project: "New Project",
    no_projects_title: "No projects yet",
    no_projects_hint: "Create a project to organise it with sections and a visual blueprint",
    create_first: "Create first project",
    description_label: "Description",
    description_placeholder: "Add a description…",
    color_label: "Color",
    back: "Projects",
    mode_structure: "Structure",
    mode_blueprint: "Blueprint",
    sections_label: "Text Structure",
    add_section: "Add section",
    add_item: "Add",
    result_count: "results",
    no_sections: "No sections — click to add one",
    add_first_item: "Add first item…",
    type_something: "Type something…",
    sure: "Sure?",
    section_1: "Intro",
    section_2: "Main",
    section_3: "Outro",

    // Blueprint
    add_block: "Add Block",
    empty_bp: "Empty blueprint",
    empty_bp_hint: "Click \"Add Block\" to start building",
    bp_hint_connect: "Drag handle to connect",
    bp_hint_resize: "Drag corner to resize",
    bp_hint_del: "Del to remove",
    node_hint: "double-click to edit · Del to remove",
    color_btn: "Color",
    dbl_to_edit: "Double-click to edit",
    bp_add_photo: "Photo",
    bp_add_file: "File",
    bp_dbl_open_photo: "Double-click to open photo",
    bp_dbl_open_file: "Double-click to open file",

    // Settings
    settings_title: "Settings",
    settings_sub: "Personalise your Advanced Notebook workspace.",
    appearance: "Appearance",
    appearance_hint: "Choose your workspace theme",
    editor_label: "Editor",
    editor_hint: "Writing preferences",
    autosave_label: "Autosave delay",
    autosave_hint: "Pause after typing stops before saving",
    lang_label: "Language",
    lang_hint: "Interface language",
    about_label: "About",
    save_btn: "Save settings",
    fast: "Fast",
    default_speed: "Default",
    slow: "Slow",

    // Themes
    t_dark: "Night",
    t_dark_d: "Classic dark workspace",
    t_midnight: "Midnight",
    t_midnight_d: "Deep blue atmosphere",
    t_light: "Soft Light",
    t_light_d: "Warm off-white, easy on eyes",
    t_rose: "Rose Petal",
    t_rose_d: "Soft pink tones",
    t_mint: "Fresh Mint",
    t_mint_d: "Calm green tones",
  },

  ru: {
    // Nav
    notes: "Заметки",
    projects: "Проекты",
    settings: "Настройки",
    tasks: "Задачи",
    images: "Фото",
    files: "Файлы",
    workspace: "Рабочее пространство",
    app_name: "Advanced",
    app_sub: "Notebook",

    // Notes
    new_note: "Новая заметка",
    search: "Поиск…",
    no_notes_title: "Заметок нет",
    no_notes_hint: "Нажмите + чтобы создать первую заметку",
    select_note: "Выберите заметку",
    select_note_hint: "Или создайте новую",
    note_placeholder: "Название заметки…",
    write_placeholder: "Начните писать…",
    add_tag: "Добавить тег…",
    words: "слов",
    chars: "символов",
    edited: "изменено",
    delete: "Удалить",
    saving: "Сохранение…",
    saved: "Сохранено",
    no_results: "Ничего не найдено",
    untitled: "Без названия",
    shortcut_hint: "⌘N  новая заметка",
    just_now: "только что",
    ago: "назад",
    time_s: "с",
    time_m: "м",
    time_h: "ч",
    time_d: "д",
    block_default: "Блок",
    project_placeholder: "Название проекта…",
    border_width: "Ширина обводки блоков",
    border_width_hint: "Толщина цветной полоски в блоках Blueprint (0 = скрыть)",

    // Projects
    new_project: "Новый проект",
    no_projects_title: "Проектов нет",
    no_projects_hint: "Создайте проект, чтобы организовать его с разделами и схемой",
    create_first: "Создать первый проект",
    description_label: "Описание",
    description_placeholder: "Добавить описание…",
    color_label: "Цвет",
    back: "Проекты",
    mode_structure: "Структура",
    mode_blueprint: "Схема",
    sections_label: "Текстовая структура",
    add_section: "Добавить раздел",
    add_item: "Добавить",
    result_count: "рез.",
    no_sections: "Разделов нет — нажмите чтобы добавить",
    add_first_item: "Добавить первый пункт…",
    type_something: "Введите текст…",
    sure: "Точно?",
    section_1: "Начало",
    section_2: "Основа",
    section_3: "Финал",

    // Blueprint
    add_block: "Добавить блок",
    empty_bp: "Схема пуста",
    empty_bp_hint: "Нажмите «Добавить блок» чтобы начать",
    bp_hint_connect: "Тяни за точку для связи",
    bp_hint_resize: "Тяни угол для масштаба",
    bp_hint_del: "Del для удаления",
    node_hint: "двойной клик · Del для удаления",
    color_btn: "Цвет",
    dbl_to_edit: "Двойной клик для редактирования",
    bp_add_photo: "Фото",
    bp_add_file: "Файл",
    bp_dbl_open_photo: "Двойной клик — открыть фото",
    bp_dbl_open_file: "Двойной клик — открыть файл",

    // Settings
    settings_title: "Настройки",
    settings_sub: "Настройте своё рабочее пространство Advanced Notebook.",
    appearance: "Оформление",
    appearance_hint: "Выберите тему оформления",
    editor_label: "Редактор",
    editor_hint: "Параметры написания",
    autosave_label: "Задержка автосохранения",
    autosave_hint: "Пауза после остановки ввода перед сохранением",
    lang_label: "Язык интерфейса",
    lang_hint: "Язык всех надписей в приложении",
    about_label: "О программе",
    save_btn: "Сохранить настройки",
    fast: "Быстро",
    default_speed: "По умолчанию",
    slow: "Медленно",

    // Themes
    t_dark: "Ночная",
    t_dark_d: "Классическая тёмная",
    t_midnight: "Полночь",
    t_midnight_d: "Глубокий синий",
    t_light: "Мягкий свет",
    t_light_d: "Тёплый, не слепит",
    t_rose: "Розовый",
    t_rose_d: "Мягкие розовые тона",
    t_mint: "Мята",
    t_mint_d: "Спокойные зелёные тона",
  },
} as const;

export type TKey = keyof typeof T.en;

// ─── Theme hook ────────────────────────────────────────────────────────────────

export function useTheme(): string {
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute("data-theme") ?? "dark"
  );
  useEffect(() => {
    const h = (e: Event) => setTheme((e as CustomEvent<string>).detail);
    window.addEventListener("vss-theme", h);
    return () => window.removeEventListener("vss-theme", h);
  }, []);
  return theme;
}

export const isLightTheme = (theme: string): boolean =>
  theme === "soft-light" || theme === "pastel-rose" || theme === "pastel-mint";

export const t = (key: TKey): string => T[_lang][key] ?? T.en[key] ?? key;
