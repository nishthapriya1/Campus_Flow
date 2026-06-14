import React from 'react';

export const BurnoutTab = ({ burnoutGuardian = {} }) => {
  const {
    burnoutRiskScore = 0,
    burnoutLevel = 'Low',
    contributingFactors = [],
    recoveryGuidance = []
  } = burnoutGuardian;

  const burnoutColor = burnoutRiskScore > 70 ? 'text-rose-400' : burnoutRiskScore > 40 ? 'text-amber-400' : 'text-emerald-400';
  const burnoutBg = burnoutRiskScore > 70 ? 'bg-rose-500' : burnoutRiskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Burnout Risks Card */}
      <div className="glass-panel p-5 space-y-4 bg-gradient-to-br from-indigo-950/10 to-slate-950/40 border-indigo-500/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-rose-400">🚨</span> Burnout Risk Profile
        </h3>
        
        <div className="space-y-4 text-xs font-semibold">
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-900 space-y-1 text-center">
            <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Risks Score assessment</div>
            <div className={`text-4xl font-black ${burnoutColor} font-mono mt-1`}>{burnoutRiskScore}%</div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${burnoutColor} bg-slate-900 inline-block border border-slate-800 mt-2`}>
              {burnoutLevel} Risk Level
            </span>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
              <div className={`${burnoutBg} h-full rounded-full transition-all duration-500`} style={{ width: `${burnoutRiskScore}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Contributing factors</span>
            {contributingFactors && contributingFactors.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {contributingFactors.map((factor, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/15">
                    ⚠️ {factor}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 bg-slate-950/20 border border-slate-900 p-3.5 rounded-xl italic">
                No active burnout warning factors detected. Your routine is balanced!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Guidance Actions */}
      <div className="glass-panel p-5 space-y-4">
        <div className="border-b border-slate-800/40 pb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-teal-400">🩹</span> Recovery Guidance
          </h3>
          <p className="text-[10px] text-slate-500">Recommended habits to lower stress risk index</p>
        </div>

        <div className="space-y-3">
          {recoveryGuidance && recoveryGuidance.length > 0 ? (
            recoveryGuidance.map((guideline, i) => (
              <div key={i} className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl flex gap-2.5 items-start text-xs text-slate-350 leading-relaxed font-medium">
                <span className="text-teal-500 select-none">✔</span>
                <span>{guideline}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 text-xs italic py-4 text-center">
              Routine is fully stable. Keep it up!
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default BurnoutTab;
