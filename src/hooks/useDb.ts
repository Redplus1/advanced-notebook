/**
 * useDb.ts — SQLite + localStorage fallback
 *
 * In Tauri production builds the database is stored in:
 *   Windows : %APPDATA%\com.advancednotebook.app\advanced-notebook.db
 *   macOS   : ~/Library/Application Support/com.advancednotebook.app/advanced-notebook.db
 *   Linux   : ~/.local/share/com.advancednotebook.app/advanced-notebook.db
 *
 * In browser / dev mode falls back to localStorage automatically.
 */

import { readJSON, writeJSON, writeString } from "../lib/storage";

// ─── Tauri detection ───────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof (window as any).__TAURI__ !== "undefined";
}

// ─── DB singleton ──────────────────────────────────────────────────────────────

let _db: any = null;
let _initialising = false;
let _queue: Array<() => void> = [];

async function getDb(): Promise<any | null> {
  if (!isTauri()) return null;
  if (_db) return _db;

  if (_initialising) {
    // Wait for existing init
    await new Promise<void>(resolve => _queue.push(resolve));
    return _db;
  }

  _initialising = true;
  try {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    // Tauri stores the file under $APPDATA automatically
    _db = await Database.load("sqlite:advanced-notebook.db");
    await _initSchema(_db);
  } catch (err) {
    console.error("[DB] Failed to initialise SQLite:", err);
    _db = null;
  } finally {
    _initialising = false;
    _queue.forEach(r => r());
    _queue = [];
  }
  return _db;
}

async function _initSchema(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL DEFAULT '',
      content     TEXT    NOT NULL DEFAULT '',
      tags        TEXT    NOT NULL DEFAULT '',
      project_id  INTEGER,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL DEFAULT '',
      description TEXT    NOT NULL DEFAULT '',
      status      TEXT    NOT NULL DEFAULT 'planning',
      video_url   TEXT    NOT NULL DEFAULT '',
      color       TEXT    NOT NULL DEFAULT 'indigo',
      sections    TEXT    NOT NULL DEFAULT '[]',
      blueprint   TEXT    NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

function lsGet<T>(key: string, def: T): T {
  return readJSON<T>(key, def);
}
function lsSet(key: string, val: unknown) {
  writeJSON(key, val);
}

// ─── Notes CRUD ───────────────────────────────────────────────────────────────

export interface DBNote {
  id: number;
  title: string;
  content: string;
  tags: string;
  project_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function dbGetNotes(): Promise<DBNote[]> {
  const db = await getDb();
  if (db) return (db.select("SELECT * FROM notes ORDER BY updated_at DESC") as Promise<DBNote[]>);
  return lsGet<DBNote[]>("vss_notes_sql", []);
}

export async function dbSaveNote(note: Partial<DBNote> & { title: string }): Promise<DBNote> {
  const db   = await getDb();
  const now  = new Date().toISOString();
  if (db) {
    if (note.id) {
      await db.execute(
        `UPDATE notes SET title=?,content=?,tags=?,project_id=?,updated_at=? WHERE id=?`,
        [note.title, note.content ?? "", note.tags ?? "", note.project_id ?? null, now, note.id]
      );
      const rows = (await db.select("SELECT * FROM notes WHERE id=?", [note.id])) as DBNote[];
      return rows[0];
    }
    const res = await db.execute(
      `INSERT INTO notes(title,content,tags,project_id,created_at,updated_at) VALUES(?,?,?,?,?,?)`,
      [note.title, note.content ?? "", note.tags ?? "", note.project_id ?? null, now, now]
    );
    const rows = (await db.select("SELECT * FROM notes WHERE id=?", [res.lastInsertId])) as DBNote[];
    return rows[0];
  }
  // localStorage fallback
  const list = lsGet<DBNote[]>("vss_notes_sql", []);
  if (note.id) {
    const idx = list.findIndex(n => n.id === note.id);
    const updated = { ...list[idx], ...note, updated_at: now };
    list[idx] = updated;
    lsSet("vss_notes_sql", list);
    return updated;
  }
  const created: DBNote = { id: Date.now(), title: note.title, content: note.content ?? "", tags: note.tags ?? "", project_id: note.project_id ?? null, created_at: now, updated_at: now };
  list.unshift(created);
  lsSet("vss_notes_sql", list);
  return created;
}

export async function dbDeleteNote(id: number): Promise<void> {
  const db = await getDb();
  if (db) { await db.execute("DELETE FROM notes WHERE id=?", [id]); return; }
  lsSet("vss_notes_sql", lsGet<DBNote[]>("vss_notes_sql", []).filter(n => n.id !== id));
}

// ─── Settings CRUD ────────────────────────────────────────────────────────────

export async function dbGetSetting(key: string, def: string): Promise<string> {
  const db = await getDb();
  if (db) {
    const rows = (await db.select("SELECT value FROM settings WHERE key=?", [key])) as {value: string}[];
    return rows.length > 0 ? rows[0].value : def;
  }
  return localStorage.getItem(`vss_setting_${key}`) ?? def;
}

export async function dbSetSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.execute(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [key, value]
    );
    return;
  }
  writeString(`vss_setting_${key}`, value);
}

// ─── Autosave hook ────────────────────────────────────────────────────────────

import { useRef, useCallback } from "react";

export function useAutosave<T>(
  saveFn: (data: T) => Promise<void>,
  delayMs = 1000
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((data: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveFn(data), delayMs);
  }, [saveFn, delayMs]);
}
