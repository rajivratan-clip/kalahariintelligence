import React from 'react';
import { AlertCircle, MousePointerClick, Clock, ArrowRight } from 'lucide-react';

const FrictionForensic: React.FC = () => {
  const issues = [
    { id: 1, type: 'Rage Click', element: 'Apply Discount Btn', frequency: 1240, impact: 'High', loss: '$14,200', desc: 'Button unresponsive for 400ms after tap.' },
    { id: 2, type: 'API Timeout', element: 'Room Availability API', frequency: 450, impact: 'Critical', loss: '$28,000', desc: 'Timeout > 5s on mobile networks.' },
    { id: 3, type: 'Form Error', element: 'Date Picker', frequency: 890, impact: 'Medium', loss: '$5,400', desc: 'Validation fires before user finishes typing.' },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Friction Forensic</h2>
      <p className="text-slate-500 mb-6">Deep dive into microscopic behavioral triggers.</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
              <th className="p-4">Issue Type</th>
              <th className="p-4">UI Element</th>
              <th className="p-4">Frequency (24h)</th>
              <th className="p-4">Est. Revenue Loss</th>
              <th className="p-4">Details</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issues.map((issue) => (
              <tr key={issue.id} className="hover:bg-slate-50 group">
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    issue.impact === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {issue.impact === 'Critical' ? <AlertCircle size={12} /> : <MousePointerClick size={12} />}
                    {issue.type}
                  </span>
                </td>
                <td className="p-4 text-slate-700 font-medium">{issue.element}</td>
                <td className="p-4 text-slate-600">{issue.frequency.toLocaleString()}</td>
                <td className="p-4 text-slate-800 font-bold">{issue.loss}</td>
                <td className="p-4 text-slate-500 text-sm max-w-xs">{issue.desc}</td>
                <td className="p-4 text-right">
                  <button className="text-brand-600 hover:text-brand-800 text-sm font-medium flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    Investigate <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FrictionForensic;
