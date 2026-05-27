# Инструкция по обновлению

---

## Скачать проект заново (если удалил)

```bash
# macOS
git clone https://github.com/Redplus1/advanced-notebook.git
cd advanced-notebook
npm install

# Windows — в командной строке
git clone https://github.com/Redplus1/advanced-notebook.git
cd advanced-notebook
npm install
```

---

## Внёс правки → залить в GitHub

```bash
cd ~/Documents/advanced-notebook

git add .
git commit -m "Описание что изменил"
git push
```

Три команды — и изменения на GitHub.

---

## Обновить версию приложения

Поменяй цифру в двух файлах:

**`src-tauri/tauri.conf.json`:**
```json
"package": {
    "productName": "Advanced Notebook",
    "version": "1.1.0"
}
```

**`package.json`:**
```json
"version": "1.1.0"
```

---

## Пересобрать установщик

### macOS

```bash
cd ~/Documents/advanced-notebook
npm run build:macos-arm
```

Готовое приложение:
```
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Advanced Notebook.app
```

Сделать DMG:
```bash
cd "src-tauri/target/aarch64-apple-darwin/release/bundle/macos"

create-dmg \
  --volname "Advanced Notebook" \
  --window-size 660 400 \
  --icon-size 128 \
  --app-drop-link 480 200 \
  "Advanced-Notebook-1.1.0.dmg" \
  "Advanced Notebook.app"
```

### Windows

Запусти `setup.ps1` — он соберёт всё автоматически.

Или вручную в командной строке:
```
cd C:\Users\ИМЯ\Documents\advanced-notebook
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi
```

Если MSI не появился — ищи портативный .exe:
```
src-tauri\target\x86_64-pc-windows-msvc\release\advanced-notebook.exe
```
Его можно запускать напрямую без установки.

---

## Установить новую версию

### macOS
```bash
# Удалить старую
sudo rm -rf "/Applications/Advanced Notebook.app"

# Установить новую
cp -r "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Advanced Notebook.app" /Applications/
```

### Windows
Просто запусти новый `.msi` — он сам заменит старую версию. Данные сохранятся.

---

## Выложить в GitHub Releases

```bash
# Установить GitHub CLI (один раз)
brew install gh
gh auth login

# Создать релиз с файлами
gh release create v1.1.0 \
  --repo Redplus1/advanced-notebook \
  --title "Advanced Notebook 1.1.0" \
  --notes "Что нового в этой версии" \
  "путь/до/Advanced-Notebook-1.1.0.dmg"
```

Или через сайт GitHub:
1. Открой github.com/Redplus1/advanced-notebook
2. **Releases → Draft a new release**
3. Tag: `v1.1.0`, Title: `Advanced Notebook 1.1.0`
4. Прикрепи `.dmg` и/или `.msi`
5. **Publish release**

---

## Шпаргалка

| Действие | Команда |
|----------|---------|
| Скачать проект | `git clone https://github.com/Redplus1/advanced-notebook.git` |
| Установить зависимости | `npm install` |
| Запустить dev режим | `npm run tauri:dev` |
| Залить в GitHub | `git add . && git commit -m "..." && git push` |
| Собрать macOS | `npm run build:macos-arm` |
| Собрать Windows | `npm run tauri build -- --bundles msi` |
| Установить на Mac | `cp -r "...Advanced Notebook.app" /Applications/` |
