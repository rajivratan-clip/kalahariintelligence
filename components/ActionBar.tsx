import React from 'react';
import { AlertTriangle, BarChart3, Smartphone, Bell } from 'lucide-react';

interface ActionItem {
  label: string;
  action_id: string;
}

interface ActionBarProps {
  actions: ActionItem[];
  onAction?: (actionId: string, label: string) => void;
  disabled?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  latency: <BarChart3 size={14} />,
  device: <Smartphone size={14} />,
  alert: <Bell size={14} />,
  custom: <AlertTriangle size={14} />,
};

export const ActionBar: React.FC<ActionBarProps> = ({
  actions,
  onAction,
  disabled,
}) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onAction?.(a.action_id, a.label)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
        >
          {iconMap[a.action_id] || iconMap.custom}
          {a.label}
        </button>
      ))}
    </div>
  );
};

export default ActionBar;
