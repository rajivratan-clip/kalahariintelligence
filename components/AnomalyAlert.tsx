import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Anomaly {
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  metric_value?: number;
  baseline_value?: number;
  metadata?: Record<string, any>;
}

interface AnomalyAlertProps {
  /** Whether to show the alert component */
  show?: boolean;
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  pollInterval?: number;
}

const AnomalyAlert: React.FC<AnomalyAlertProps> = ({ 
  show = true, 
  pollInterval = 30000 
}) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  useEffect(() => {
    if (!show || isDismissed) return;

    const fetchAnomalies = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/ai/anomalies?limit=5');
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.anomalies && Array.isArray(data.anomalies)) {
          // Only show high and medium severity anomalies
          const filtered = data.anomalies.filter(
            (a: Anomaly) => a.severity === 'high' || a.severity === 'medium'
          );
          setAnomalies(filtered);
          setLastCheck(data.last_check_timestamp);
        }
      } catch (error) {
        console.error('Error fetching anomalies:', error);
      }
    };

    // Fetch immediately
    fetchAnomalies();

    // Set up polling
    const interval = setInterval(fetchAnomalies, pollInterval);
    return () => clearInterval(interval);
  }, [show, isDismissed, pollInterval]);

  if (!show || isDismissed || anomalies.length === 0) {
    return null;
  }

  const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
  const severityColor = highSeverityCount > 0 ? 'red' : 'amber';
  const bgColor = severityColor === 'red' ? 'bg-red-50' : 'bg-amber-50';
  const borderColor = severityColor === 'red' ? 'border-red-200' : 'border-amber-200';
  const textColor = severityColor === 'red' ? 'text-red-900' : 'text-amber-900';
  const iconColor = severityColor === 'red' ? 'text-red-600' : 'text-amber-600';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg shadow-sm mb-4`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className={iconColor} />
          <div>
            <div className={`font-semibold ${textColor} text-sm`}>
              {highSeverityCount > 0 
                ? `${highSeverityCount} High Priority Anomal${highSeverityCount > 1 ? 'ies' : 'y'} Detected`
                : `${anomalies.length} Anomal${anomalies.length > 1 ? 'ies' : 'y'} Detected`
              }
            </div>
            {lastCheck && (
              <div className="text-xs text-slate-500 mt-0.5">
                Last checked: {new Date(lastCheck).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 p-4 space-y-3">
          {anomalies.map((anomaly, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-md ${
                anomaly.severity === 'high' 
                  ? 'bg-red-100 border border-red-200' 
                  : 'bg-amber-100 border border-amber-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle 
                  size={16} 
                  className={
                    anomaly.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                  }
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      anomaly.severity === 'high'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-amber-200 text-amber-800'
                    }`}>
                      {anomaly.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {anomaly.anomaly_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">{anomaly.description}</p>
                  {anomaly.metric_value !== undefined && anomaly.baseline_value !== undefined && (
                    <div className="text-xs text-slate-500">
                      Current: {typeof anomaly.metric_value === 'number' 
                        ? anomaly.metric_value.toLocaleString() 
                        : anomaly.metric_value} | 
                      Baseline: {typeof anomaly.baseline_value === 'number'
                        ? anomaly.baseline_value.toLocaleString()
                        : anomaly.baseline_value}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    Detected: {new Date(anomaly.detected_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnomalyAlert;
