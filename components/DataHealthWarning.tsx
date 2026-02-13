import React from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import type { DataHealthReport } from '../engines/dataHealthMonitor';

interface DataHealthWarningProps {
  healthReport: DataHealthReport | null;
  onDismiss?: () => void;
}

const DataHealthWarning: React.FC<DataHealthWarningProps> = ({
  healthReport,
  onDismiss,
}) => {
  if (!healthReport) {
    return null;
  }

  if (!healthReport.hasIssues) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
        <CheckCircle2 size={16} className="text-green-600" />
        <span className="text-sm text-green-800">Data quality looks good</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-amber-900">Data Quality Warning</h4>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-amber-600 hover:text-amber-800"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {healthReport.warnings.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-amber-800 mb-1">Issues detected:</div>
              <ul className="list-disc list-inside space-y-1">
                {healthReport.warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-amber-700">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {healthReport.suggestions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-amber-800 mb-1">Suggestions:</div>
              <ul className="list-disc list-inside space-y-1">
                {healthReport.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-xs text-amber-700">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataHealthWarning;
