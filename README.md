# Advanced Notebook

Десктопное приложение для структурирования видео, заметок и визуальных схем.

**Стек:** Tauri · React · TypeScript · SQLite · React Flow · Tailwind CSS

---

## Скачать и установить

→ [**Скачать последнюю версию**](https://github.com/Redplus1/advanced-notebook/releases)

### macOS
1. Скачай `.dmg` из Releases
2. Открой → перетащи в **Applications**
3. Запускай через Spotlight (⌘ Пробел) или Launchpad

### Windows
1. Скачай `.msi` из Releases
2. Запусти → Next → Install → Готово
3. Ярлык появится на рабочем столе и в меню Пуск

---

## Возможности

- 📝 **Заметки** — создание, редактирование, теги, автосохранение
- 🎬 **Проекты** — текстовая структура видео по разделам
- 🔵 **Blueprint** — визуальные схемы с блоками и связями
- 🎨 **5 тем** — Ночная, Полночь, Мягкий свет, Розовый, Мята
- 🌍 **Русский / English** интерфейс
- 💾 **SQLite** — данные хранятся локально, не теряются при обновлениях

---

## Собрать из исходников

### macOS — одна команда

```bash
git clone https://github.com/Redplus1/advanced-notebook.git
cd advanced-notebook
bash setup.sh
```

### Windows — одна команда

```
git clone https://github.com/Redplus1/advanced-notebook.git
cd advanced-notebook
```

Правой кнопкой на файл `setup.ps1` → **"Run with PowerShell"**

Скрипт сам проверит все зависимости, установит что нужно и соберёт установщик.

---

## Структура проекта

```
advanced-notebook/
├── src/                        ← React / TypeScript код
│   ├── components/             ← UI компоненты
│   │   ├── Notes.tsx           ← Заметки
│   │   ├── Projects.tsx        ← Проекты
│   │   ├── Blueprint.tsx       ← Схемы (React Flow)
│   │   ├── Settings.tsx        ← Настройки и темы
│   │   └── Sidebar.tsx         ← Навигация
│   ├── hooks/useDb.ts          ← Работа с SQLite
│   ├── i18n.ts                 ← Переводы RU / EN
│   └── index.css               ← Темы (CSS переменные)
├── src-tauri/                  ← Rust / Tauri бэкенд
│   ├── src/lib.rs              ← Настройка приложения
│   ├── icons/                  ← Иконки приложения
│   └── tauri.conf.json         ← Конфигурация сборки
├── setup.sh                    ← Установка одной командой (macOS)
├── setup.ps1                   ← Установка одной командой (Windows)
└── UPDATES.md                  ← Инструкция по обновлению
```

---

## Данные пользователя

База данных хранится автоматически и **не удаляется при обновлениях:**

| ОС | Путь |
|----|------|
| macOS | `~/Library/Application Support/com.advancednotebook.app/` |
| Windows | `%APPDATA%\com.advancednotebook.app\` |

---

## Ссылки

- [Репозиторий](https://github.com/Redplus1/advanced-notebook)
- [Releases](https://github.com/Redplus1/advanced-notebook/releases)
- [Инструкция по обновлению](UPDATES.md)
- [Подробная инструкция сборки](BUILDING.md)
