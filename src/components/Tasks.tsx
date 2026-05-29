import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Check, ChevronLeft, ChevronRight, Calendar, Trash2, RotateCcw } from "lucide-react";
import { t, useLang } from "../i18n";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface DayData {
  date: string; // "YYYY-MM-DD"
  tasks: Task[];
  important?: boolean;
}

// ─── Storage ───────────────────────────────────────────────────────────────────

const KEY = "an_tasks_v1";
function load(): Record<string, DayData> {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function save(d: Record<string, DayData>) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function today() { return toDateStr(new Date()); }

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const todayStr = today();
  const yesterdayStr = addDays(todayStr, -1);
  if (dateStr === todayStr) return "Сегодня";
  if (dateStr === yesterdayStr) return "Вчера";
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getWeekDays(anchor: string): string[] {
  const d = new Date(anchor + "T12:00:00");
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return toDateStr(dd);
  });
}

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// ─── TaskItem ──────────────────────────────────────────────────────────────────

const TaskItem: React.FC<{
  task: Task;
  isToday: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
}> = ({ task, isToday, onToggle, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.style.height = "auto";
      taRef.current.style.height = taRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim()) onEdit(draft.trim());
    else setDraft(task.text);
  };

  return (
    <div
      className="group flex items-start gap-3 px-4 py-3 rounded-2xl transition-all"
      style={{ background: "var(--c-surface)", border: `1px solid ${task.done ? "var(--c-border-sub)" : "var(--c-border)"}`, opacity: task.done ? 0.65 : 1 }}
    >
      {/* Circle checkbox */}
      <button
        onClick={onToggle}
        disabled={!isToday}
        className="flex-shrink-0 mt-0.5 transition-all active:scale-90"
        style={{
          width: 20, height: 20, borderRadius: "50%",
          border: task.done ? "none" : "2px solid var(--c-border)",
          background: task.done ? "var(--c-accent)" : "transparent",
          cursor: isToday ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={e => { if (isToday && !task.done) e.currentTarget.style.borderColor = "var(--c-accent)"; }}
        onMouseLeave={e => { if (isToday && !task.done) e.currentTarget.style.borderColor = "var(--c-border)"; }}
      >
        {task.done && <Check size={11} style={{ color: "#fff" }} strokeWidth={3} />}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Escape") { setEditing(false); setDraft(task.text); } if ((e.key === "Enter" && e.metaKey) || (e.key === "Enter" && e.shiftKey)) commit(); }}
            className="w-full bg-transparent outline-none resize-none text-select"
            style={{ fontSize: 13, lineHeight: 1.6, color: "var(--c-text-1)", caretColor: "var(--c-accent)" }}
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            style={{
              fontSize: 13, lineHeight: 1.6,
              color: task.done ? "var(--c-text-3)" : "var(--c-text-1)",
              textDecoration: task.done ? "line-through" : "none",
              cursor: isToday ? "text" : "default",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {task.text}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
          onClick={onDelete}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
          style={{ color: "var(--c-text-4)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}
        >
          <Trash2 size={12} />
        </button>
    </div>
  );
};

// ─── AddTask ───────────────────────────────────────────────────────────────────

const AddTask: React.FC<{ onAdd: (text: string) => void }> = ({ onAdd }) => {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && taRef.current) {
      taRef.current.focus();
      taRef.current.style.height = "auto";
    }
  }, [open]);

  const commit = () => {
    const t2 = text.trim();
    if (t2) { onAdd(t2); setText(""); }
    setOpen(false);
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2.5 w-full px-4 py-3 rounded-2xl transition-all active:scale-95"
      style={{ border: "2px dashed var(--c-border)", color: "var(--c-text-3)", background: "transparent" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--c-accent)60"; e.currentTarget.style.color = "var(--c-text-2)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--c-border)"; e.currentTarget.style.color = "var(--c-text-3)"; }}
    >
      <Plus size={14} strokeWidth={2} />
      <span className="text-[13px]">Новая задача</span>
    </button>
  );

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--c-surface)", border: "2px solid var(--c-accent)", boxShadow: "0 0 0 4px var(--c-accent-focus-ring)" }}>
      <textarea
        ref={taRef}
        value={text}
        onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
        onKeyDown={e => { if ((e.key === "Enter" && e.metaKey) || (e.key === "Enter" && e.shiftKey)) commit(); if (e.key === "Escape") { setOpen(false); setText(""); } }}
        placeholder="Опиши задачу… (⌘Enter или Shift+Enter — добавить, Enter — новая строка)"
        rows={2}
        className="w-full bg-transparent outline-none resize-none text-select"
        style={{ fontSize: 13, lineHeight: 1.6, color: "var(--c-text-1)", caretColor: "var(--c-accent)" }}
      />
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={() => { setOpen(false); setText(""); }}
          className="px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={{ color: "var(--c-text-3)", background: "transparent" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--c-elevated)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          Отмена
        </button>
        <button onClick={commit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-500 text-white transition-all active:scale-95"
          style={{ background: "var(--c-accent)" }}>
          <Plus size={12} />Добавить
        </button>
      </div>
    </div>
  );
};

// ─── DayView ───────────────────────────────────────────────────────────────────

const DayView: React.FC<{
  dateStr: string;
  data: DayData | undefined;
  isToday: boolean;
  onUpdate: (data: DayData) => void;
}> = ({ dateStr, data, isToday, onUpdate }) => {
  const tasks = data?.tasks ?? [];
  const done = tasks.filter(t2 => t2.done).length;

  const mutate = (newTasks: Task[]) => onUpdate({ date: dateStr, tasks: newTasks });

  const addTask = (text: string) => {
    mutate([...tasks, { id: uid(), text, done: false, createdAt: Date.now() }]);
  };

  const toggle = (id: string) => {
    mutate(tasks.map(t2 => t2.id === id ? { ...t2, done: !t2.done } : t2));
  };

  const del = (id: string) => { mutate(tasks.filter(t2 => t2.id !== id)); };

  const edit = (id: string, text: string) => {
    mutate(tasks.map(t2 => t2.id === id ? { ...t2, text } : t2));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Progress */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c-border)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`, background: "var(--c-accent)" }} />
          </div>
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "var(--c-text-4)" }}>
            {done}/{tasks.length}
          </span>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 && !isToday && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <RotateCcw size={24} strokeWidth={1} style={{ color: "var(--c-text-4)" }} />
          <p className="text-[13px]" style={{ color: "var(--c-text-3)" }}>Нет задач за этот день</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} isToday={isToday}
            onToggle={() => toggle(task.id)}
            onDelete={() => del(task.id)}
            onEdit={text => edit(task.id, text)}
          />
        ))}
      </div>

      <AddTask onAdd={addTask} />
    </div>
  );
};

// ─── Main Tasks component ──────────────────────────────────────────────────────

export const Tasks: React.FC = () => {
  useLang();
  const [allData, setAllData] = useState<Record<string, DayData>>(() => load());
  const [selectedDate, setSelectedDate] = useState(today());
  const [weekAnchor, setWeekAnchor] = useState(today());

  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
  const isToday = selectedDate === today();

  const updateDay = useCallback((data: DayData) => {
    setAllData(prev => { const next = { ...prev, [data.date]: data }; save(next); return next; });
  }, []);

  const prevWeek = useCallback(() => setWeekAnchor(a => addDays(a, -7)), []);
  const nextWeek = useCallback(() => setWeekAnchor(a => addDays(a, 7)),  []);
  const goToday  = useCallback(() => { setWeekAnchor(today()); setSelectedDate(today()); }, []);

  const todayStr = today();

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--c-border-sub)", background: "var(--c-surface)" }}>
        <div>
          <h1 style={{ color: "var(--c-text-1)", fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'Syne', sans-serif" }}>
            {formatDate(selectedDate)}
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
            {(allData[selectedDate]?.tasks.filter(t2 => !t2.done).length ?? 0) > 0
              ? `${allData[selectedDate]?.tasks.filter(t2 => !t2.done).length} задач осталось`
              : allData[selectedDate]?.tasks.length ? "Всё выполнено 🎉" : "Нет задач"
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = allData[selectedDate] ?? { date: selectedDate, tasks: [] };
              const next = { ...allData, [selectedDate]: { ...d, important: !d.important } };
              setAllData(next); save(next);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-500 transition-all active:scale-95"
            style={{
              color: allData[selectedDate]?.important ? "#ef4444" : "var(--c-text-4)",
              background: allData[selectedDate]?.important ? "#ef444415" : "var(--c-elevated)",
              border: `1px solid ${allData[selectedDate]?.important ? "#ef444440" : "var(--c-border)"}`,
            }}>
            {allData[selectedDate]?.important ? "★" : "☆"} Важный день
          </button>
          {!isToday && (
            <button onClick={goToday}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all active:scale-95"
              style={{ color: "var(--c-text-2)", background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
              <Calendar size={12} />Сегодня
            </button>
          )}
        </div>
      </div>

      {/* ── Week strip ── */}
      <div className="flex-shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--c-border-sub)", background: "var(--c-surface)" }}>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl transition-all"
            style={{ color: "var(--c-text-3)", background: "transparent" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--c-elevated)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <ChevronLeft size={15} />
          </button>

          <div className="flex flex-1 items-center gap-1">
            {weekDays.map((d, i) => {
              const isSelected = d === selectedDate;
              const isTod = d === todayStr;
              const dayData = allData[d];
              const hasTasks = (dayData?.tasks.length ?? 0) > 0;
              const allDone = hasTasks && dayData!.tasks.every(t2 => t2.done);
              const isFuture = d > todayStr;

              return (
                <button key={d} onClick={() => setSelectedDate(d)}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: isSelected
                      ? (allData[d]?.important ? "#ef4444" : "var(--c-accent)")
                      : allData[d]?.important
                        ? "#ef4444"
                        : "transparent",
                    opacity: isFuture ? 0.45 : 1,
                    cursor: "pointer",
                  }}
                >
                  <span className="text-[10px] font-mono" style={{ color: (isSelected || allData[d]?.important) ? "#fff" : "var(--c-text-4)" }}>
                    {WEEKDAYS_SHORT[i]}
                  </span>
                  <span className="text-[13px] font-600" style={{ color: (isSelected || allData[d]?.important) ? "#fff" : isTod ? "var(--c-accent)" : "var(--c-text-2)" }}>
                    {new Date(d + "T12:00:00").getDate()}
                  </span>
                  {/* Dot indicator */}
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: allData[d]?.important
                      ? "#ef4444"
                      : hasTasks
                        ? (allDone ? "var(--c-accent)" : "#f59e0b")
                        : "transparent",
                    opacity: isSelected ? 0.7 : 1,
                  }} />
                </button>
              );
            })}
          </div>

          <button onClick={nextWeek} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl transition-all"
            style={{ color: "var(--c-text-3)", background: "transparent" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--c-elevated)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Day content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[620px] mx-auto px-6 py-6 pb-24">
          <DayView
            dateStr={selectedDate}
            data={allData[selectedDate]}
            isToday={isToday}
            onUpdate={updateDay}
          />
        </div>
      </div>
    </div>
  );
};
