import React from 'react';

export const RecommendationsTab = ({ recommendations = {} }) => {
  const {
    academicRecommendations = [],
    wellnessRecommendations = [],
    financialRecommendations = [],
    lifestyleImprovements = [],
    weeklyActionPlan = []
  } = recommendations;

  return (
    <div className="space-y-6">
      
      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Academic & Scheduling Advice */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/65 pb-2.5 flex items-center gap-2">
            <span className="text-purple-400">📅</span> Academic Recommendations
          </h3>
          <div className="space-y-3">
            {academicRecommendations && academicRecommendations.length > 0 ? (
              academicRecommendations.map((rec, i) => (
                <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 text-xs text-slate-300 leading-relaxed font-medium">
                  {rec}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
                Analyzing timetable workloads and schedules...
              </div>
            )}
          </div>
        </div>

        {/* Wellness & Health Rest Advice */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/65 pb-2.5 flex items-center gap-2">
            <span className="text-teal-400">❤️</span> Well-being Recommendations
          </h3>
          <div className="space-y-3">
            {wellnessRecommendations && wellnessRecommendations.length > 0 ? (
              wellnessRecommendations.map((rec, i) => (
                <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 text-xs text-slate-300 leading-relaxed font-medium">
                  {rec}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
                Analyzing wellness parameters and sleep logs...
              </div>
            )}
          </div>
        </div>

        {/* Budgeting & Financial Optimization */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/65 pb-2.5 flex items-center gap-2">
            <span className="text-amber-400">💰</span> Spending Advice
          </h3>
          <div className="space-y-3">
            {financialRecommendations && financialRecommendations.length > 0 ? (
              financialRecommendations.map((rec, i) => (
                <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 text-xs text-slate-300 leading-relaxed font-medium">
                  {rec}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
                Analyzing category expenses and budgets...
              </div>
            )}
          </div>
        </div>

        {/* Habits & Daily Schedule Advice */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/65 pb-2.5 flex items-center gap-2">
            <span className="text-indigo-400">🔄</span> Lifestyle improvements
          </h3>
          <div className="space-y-3">
            {lifestyleImprovements && lifestyleImprovements.length > 0 ? (
              lifestyleImprovements.map((rec, i) => (
                <div key={i} className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 text-xs text-slate-300 leading-relaxed font-medium">
                  {rec}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
                Analyzing habits logs completions...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Weekly Action Plan */}
      <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/65 pb-2.5 flex items-center gap-2">
          <span className="text-blue-400">🎯</span> Weekly Action Plan
        </h3>
        <div className="space-y-2.5">
          {weeklyActionPlan && weeklyActionPlan.length > 0 ? (
            weeklyActionPlan.map((plan, i) => (
              <div key={i} className="bg-slate-950/30 border border-slate-900/70 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-850 transition">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg w-20 text-center flex-shrink-0 select-none">
                    {plan.day}
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {plan.action}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border text-center self-start md:self-auto ${
                  plan.priority === 'high'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    : plan.priority === 'medium'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : 'bg-slate-900 text-slate-500 border-slate-850'
                }`}>
                  {plan.priority}
                </span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3.5 rounded-xl text-center">
              Compiling study schedule action items...
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default RecommendationsTab;
