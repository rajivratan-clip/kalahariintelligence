import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  severity?: string;
  status?: string;
}

interface ActivityPanelProps {
  limit?: number;
  pollIntervalMs?: number;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  limit = 20,
  pollIntervalMs = 60000,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/ai/activity?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        setActivities(data.activities || []);
      } catch {
        setActivities([]);
      }
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, pollIntervalMs);
    return () => clearInterval(interval);
  }, [limit, pollIntervalMs]);

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 w-full text-left text-sm font-medium text-slate-600"
        >
          <Activity size={16} />
          AI Activity
        </button>
        {!collapsed && (
          <p className="mt-2 text-xs text-slate-500">No recent activity.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full p-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Activity size={16} />
          AI Activity
        </span>
        <span className="text-xs text-slate-500">{activities.length} items</span>
      </button>
      {!collapsed && (
        <ul className="max-h-48 overflow-y-auto divide-y divide-slate-200/80">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-2 p-2 text-xs">
              {a.type === "anomaly" && (a.severity === "high" || a.severity === "medium") ? (
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-slate-700">{a.description}</p>
                {a.timestamp && (
                  <p className="text-slate-400 mt-0.5">{new Date(a.timestamp).toLocaleString()}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActivityPanel;
