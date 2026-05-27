export type Tab = "notes" | "projects" | "tasks" | "images" | "files" | "settings";

export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string;
  project_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  status: "planning" | "in_progress" | "completed" | "archived";
  video_url: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  theme: "dark";
  autosave_interval: number; // seconds
  font_size: number;
  editor_width: "compact" | "normal" | "wide";
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";
