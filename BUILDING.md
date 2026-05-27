# Advanced Notebook — Сборка из исходников

---

## Быстрый старт (рекомендуется)

### macOS
```bash
git clone https://github.com/Redplus1/advanced-notebook.git
cd /Users/Sofa/Documents/advanced-notebook
bash setup.sh
```

### Windows
```
git clone https://github.com/Redplus1/advanced-notebook.git
cd advanced-notebook
```
Правой кнопкой на `setup.ps1` → **"Run with PowerShell"**

Скрипты сами проверят зависимости и запустят приложение.

---

## Ручная установка

### Шаг 1 — Node.js

Скачай LTS с [nodejs.org](https://nodejs.org) и установи.

Проверь:
```bash
node --version   # должно быть v18 или выше
```

### Шаг 2 — Rust

**macOS / Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**Windows:**
Скачай и запусти [rustup-init.exe](https://win.rustup.rs/x86_64), нажми **1**.

Проверь:
```bash
cargo --version
```

### Шаг 3 — Системные зависимости

**macOS:**
```bash
xcode-select --install
```

**Windows:**
1. Скачай [Visual C++ Build Tools](https://aka.ms/vs/17/release/vs_BuildTools.exe)
2. Поставь галочку **"Desktop development with C++"**
3. Нажми Install (~5 ГБ, ~20 минут)
4. Перезагрузи компьютер

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libwebkit2gtk-4.0-dev build-essential libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### Шаг 4 — Установить зависимости проекта

```bash
npm install
```

---

## Запуск в режиме разработки

```bash
npm run tauri:dev
```

Первый запуск — 3-7 минут (Rust компилирует). Последующие — быстро.

---

## Производственная сборка

### macOS (Apple Silicon — M1/M2/M3)
```bash
npm run build:macos-arm
```

### macOS (Intel)
```bash
npm run build:macos-x86
```

### macOS (Universal — работает везде)
```bash
# Сначала добавь Intel target
rustup target add x86_64-apple-darwin
npm run build:macos
```

### Windows
```
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi
```

---

## Где найти готовые файлы

### macOS
```
src-tauri/target/aarch64-apple-darwin/release/bundle/
├── macos/
│   └── Advanced Notebook.app       ← приложение
└── dmg/
    └── Advanced Notebook_1.0.0.dmg ← установщик (если есть create-dmg)
```

### Windows
```
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\
├── msi\
│   └── Advanced Notebook_1.0.0_x64_en-US.msi   ← установщик
└── nsis\
    └── Advanced Notebook_1.0.0_x64-setup.exe    ← установщик
```

Если папки `bundle` нет — используй портативный вариант:
```
src-tauri\target\x86_64-pc-windows-msvc\release\advanced-notebook.exe
```
Этот `.exe` запускается без установки — просто скопируй куда удобно.

---

## Сделать DMG вручную (macOS)

```bash
# Установить create-dmg (один раз)
brew install create-dmg

# Создать DMG
cd "src-tauri/target/aarch64-apple-darwin/release/bundle/macos"

create-dmg \
  --volname "Advanced Notebook" \
  --window-size 660 400 \
  --icon-size 128 \
  --app-drop-link 480 200 \
  "Advanced-Notebook-1.0.0.dmg" \
  "Advanced Notebook.app"
```

---

## Данные пользователя

База данных SQLite хранится отдельно от приложения и **не удаляется при обновлениях:**

| ОС | Путь |
|----|------|
| macOS | `~/Library/Application Support/com.advancednotebook.app/` |
| Windows | `%APPDATA%\com.advancednotebook.app\` |

---

## Иконки

Для пересборки иконок (macOS):
```bash
bash scripts/fix-icons.sh
```

---

## Частые ошибки

**`link.exe not found` (Windows)**
→ Установи Visual C++ Build Tools (см. Шаг 3)

**`SSL connect error` (Windows)**
→ Отключи антивирус на время сборки, или используй VPN

**`error running bundle_dmg.sh` (macOS)**
→ Установи `brew install create-dmg` или собери без DMG:
```bash
npm run tauri build -- --target aarch64-apple-darwin --bundles app
```

**`tauri.conf.json error: plugins was unexpected`**
→ Запусти:
```bash
python3 -c "
import json
with open('src-tauri/tauri.conf.json') as f: c = json.load(f)
c['tauri'].pop('plugins', None)
with open('src-tauri/tauri.conf.json', 'w') as f: json.dump(c, f, indent=2)
"
```
