import React from "react";
import { Check, Loader2, Circle, AlertCircle } from "lucide-react";
import type { SaveStatus } from "../types";

interface SaveIndicatorProps {
  status: SaveStatus;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ status }) => {
  const map = {
    saved: {
      icon: <Check size={11} />,
      label: "Saved",
      cls: "text-success",
    },
    saving: {
      icon: <Loader2 size={11} className="animate-spin" />,
      label: "Saving…",
      cls: "text-text-muted",
    },
    unsaved: {
      icon: <Circle size={11} className="fill-warning text-warning" />,
      label: "Unsaved",
      cls: "text-warning",
    },
    error: {
      icon: <AlertCircle size={11} />,
      label: "Error",
      cls: "text-danger",
    },
  };

  const { icon, label, cls } = map[status];

  return (
    <span className={`flex items-center gap-1 text-[11px] font-mono ${cls}`}>
      {icon}
      {label}
    </span>
  );
};
