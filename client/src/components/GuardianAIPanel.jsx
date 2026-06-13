import React, { useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const getSeverityBadgeClass = (severity) => {
  switch (severity) {
    case 'critical':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
};

const getAlertTypeIcon = (type) => {
  switch (type) {
    case 'attendance':
      return '📅';
    case 'schedule':
      return '🕒';
    case 'exam_gap':
      return '🎓';
    case 'placement_alert':
      return '💼';
    default:
      return '⚠️';
  }
};

export const GuardianAIPanel = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    setReport(null);
    try {
      const response = await client.post('/guardian/analyze');
      if (response.data?.report) {
        setReport(response.data.report);
        addToast('Guardian AI analysis completed successfully.', 'success');
      } else {
        addToast('Invalid response from Guardian AI.', 'error');
      }
    } catch (err) {
      console.error('Failed to run Guardian AI analysis:', err.message);
      addToast(
        err.response?.data?.error || 'Guardian AI is temporarily unavailable. Please try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400">🛡️</span> Guardian AI Assistant
          </h2>
          <p className="text-xs text-slate-400">
            Proactive risk detection and academic advice tailored to your active schedules.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={`glass-btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 ${
            loading ? 'pulse-ring-active opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing Context...
            </>
          ) : (
            'Run Guardian AI'
          )}
        </button>
      </div>

      {/* Loading Spinner Placeholder */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-center">
            <p className="text-slate-300 font-medium text-sm">Evaluating Academic Risk Profiles</p>
            <p className="text-slate-500 text-xs mt-1">Inspecting calendar conflicts, preparation gaps and class attendance...</p>
          </div>
        </div>
      )}

      {/* Report Results */}
      {!loading && report && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary */}
          {report.summary && (
            <div className="bg-slate-950/45 border border-slate-800/80 rounded-xl p-4 text-sm text-slate-300">
              <span className="font-bold text-slate-400 block mb-1">Executive Summary</span>
              {report.summary}
            </div>
          )}

          {/* On Track Banner */}
          {report.onTrack && (!report.alerts || report.alerts.length === 0) && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-sm">
              <span className="text-xl">✨</span>
              <div>
                <span className="font-bold block">You're completely on track!</span>
                All calendar exams are backed by study sessions and no workload conflicts were found. Keep it up!
              </div>
            </div>
          )}

          {/* Alerts List */}
          {report.alerts && report.alerts.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                ⚠️ Detected Risk Alerts ({report.alerts.length})
              </h3>
              <div className="space-y-3">
                {report.alerts.map((alert, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{getAlertTypeIcon(alert.alertType)}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getSeverityBadgeClass(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <h4 className="font-semibold text-white text-sm">{alert.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{alert.detailedReason}</p>
                      {alert.recommendedAction && (
                        <div className="text-xs text-indigo-400 font-medium mt-1">
                          👉 Recommendation: {alert.recommendedAction}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Suggested Plan */}
          {report.dailyPlan && (
            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                📋 Suggested 3-Day Action Plan
              </h3>
              <div className="bg-slate-950/35 border border-slate-800/60 rounded-xl p-4 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {report.dailyPlan}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {report.opportunities && report.opportunities.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                🌟 Highlighted Opportunities
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                {report.opportunities.map((opp, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!loading && !report && (
        <div className="text-center py-6 text-slate-500 text-xs">
          Click the button above to request an instant AI audit of your schedules and deadlines.
        </div>
      )}
    </div>
  );
};

export default GuardianAIPanel;
