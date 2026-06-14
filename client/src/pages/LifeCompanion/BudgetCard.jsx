import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

export const BudgetCard = ({
  expenseIntelligence = {},
  fetchData
}) => {
  const { addToast } = useToast();
  const {
    activeBudget = null,
    totalSpent = 0,
    remainingBudget = 0,
    percentageUsed = 0,
    dailySafeLimit = 0,
    predictedEndSpent = 0,
    budgetHealthStatus = 'SAFE',
    allBudgets = []
  } = expenseIntelligence;

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form states
  const [amountInput, setAmountInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('USD');
  const [monthInput, setMonthInput] = useState(new Date().getMonth() + 1);
  const [yearInput, setYearInput] = useState(new Date().getFullYear());

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await client.get('/life-companion/budget/history');
      if (response.data) {
        setHistory(response.data);
      }
    } catch (err) {
      console.error('Failed to load budget history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeBudget, allBudgets]);

  const getCurrencySymbol = (curr) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'EUR': return '€';
      case 'USD':
      default: return '$';
    }
  };

  const getHealthStyles = (status) => {
    switch (status) {
      case 'CRITICAL':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/25',
          progress: 'bg-rose-500',
          badge: 'bg-rose-500 text-white'
        };
      case 'WARNING':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/25',
          progress: 'bg-amber-500',
          badge: 'bg-amber-500 text-slate-950'
        };
      case 'SAFE':
      default:
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/25',
          progress: 'bg-emerald-500',
          badge: 'bg-emerald-500 text-slate-950'
        };
    }
  };

  const currentCurrency = activeBudget ? activeBudget.currency : 'USD';
  const sym = getCurrencySymbol(currentCurrency);
  const health = getHealthStyles(budgetHealthStatus);

  const startCreateMode = () => {
    const now = new Date();
    setAmountInput('');
    setCurrencyInput('USD');
    setMonthInput(now.getMonth() + 1);
    setYearInput(now.getFullYear());
    setIsCreating(true);
    setIsEditing(false);
  };

  const startEditMode = () => {
    if (!activeBudget) return;
    setAmountInput(activeBudget.budgetAmount);
    setCurrencyInput(activeBudget.currency);
    setMonthInput(activeBudget.month);
    setYearInput(activeBudget.year);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!amountInput || Number(amountInput) < 0) {
      return addToast('Please enter a valid budget amount.', 'error');
    }

    try {
      if (isEditing && activeBudget) {
        // Edit active budget
        const response = await client.put(`/life-companion/budget/${activeBudget._id}`, {
          currency: currencyInput,
          budgetAmount: Number(amountInput)
        });
        if (response.status === 200) {
          addToast('Monthly budget updated successfully!', 'success');
          setIsEditing(false);
          await fetchData(true);
        }
      } else {
        // Create new budget
        const response = await client.post('/life-companion/budget', {
          month: Number(monthInput),
          year: Number(yearInput),
          currency: currencyInput,
          budgetAmount: Number(amountInput)
        });
        if (response.status === 201) {
          addToast('Monthly budget created successfully!', 'success');
          setIsCreating(false);
          await fetchData(true);
        }
      }
    } catch (err) {
      console.error('Failed to save budget:', err);
      addToast(err.response?.data?.error || 'Failed to save budget settings.', 'error');
    }
  };

  const handleDeleteBudget = async (id) => {
    if (!window.confirm('Are you sure you want to delete this monthly budget? All calculations will reset to defaults.')) return;
    try {
      const response = await client.delete(`/life-companion/budget/${id}`);
      if (response.status === 200) {
        addToast('Monthly budget deleted successfully.', 'success');
        await fetchData(true);
      }
    } catch (err) {
      console.error('Failed to delete budget:', err);
      addToast('Failed to delete budget.', 'error');
    }
  };

  const getMonthName = (mNum) => {
    const date = new Date();
    date.setMonth(mNum - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <span>🎯</span> Monthly Budget Management
        </h3>
        
        {!activeBudget && !isCreating && (
          <button
            onClick={startCreateMode}
            className="px-2.5 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition active:scale-95"
          >
            + Set Budget
          </button>
        )}
      </div>

      {/* CREATE OR EDIT FORM */}
      {(isCreating || isEditing) && (
        <form onSubmit={handleSaveBudget} className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900 text-xs">
          <h4 className="font-bold text-white">{isEditing ? 'Edit Current Budget' : 'Configure New Budget'}</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Select Month</label>
              <select
                disabled={isEditing}
                value={monthInput}
                onChange={(e) => setMonthInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Select Year</label>
              <input
                type="number"
                disabled={isEditing}
                required
                value={yearInput}
                onChange={(e) => setYearInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Currency</label>
              <select
                value={currencyInput}
                onChange={(e) => setCurrencyInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Budget Amount</label>
              <input
                type="number"
                step="1"
                required
                min="0"
                placeholder="e.g. 500"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setIsCreating(false); setIsEditing(false); }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-lg font-bold transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition active:scale-95"
            >
              Save Settings
            </button>
          </div>
        </form>
      )}

      {/* ACTIVE BUDGET DETAILS */}
      {!isCreating && !isEditing && (
        <>
          {activeBudget ? (
            <div className="space-y-4">
              
              {/* Score and status badge */}
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Active Month Budget</span>
                  <span className="text-white font-extrabold text-lg font-mono">
                    {sym}{activeBudget.budgetAmount.toFixed(0)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${health.badge}`}>
                    {budgetHealthStatus}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={startEditMode}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(activeBudget._id)}
                      className="text-[10px] text-rose-500 hover:text-rose-400 font-bold"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar info */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400 font-semibold font-mono">
                  <span>Spent: {sym}{totalSpent.toFixed(2)}</span>
                  <span>{percentageUsed}% Used</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${health.progress}`}
                    style={{ width: `${Math.min(100, percentageUsed)}%` }}
                  />
                </div>
              </div>

              {/* Grid indicators */}
              <div className="grid grid-cols-3 gap-3.5 text-center text-xs">
                
                {/* Remaining budget */}
                <div className={`p-2.5 rounded-xl border flex flex-col justify-center ${health.bg}`}>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Remaining</span>
                  <span className={`font-mono font-extrabold text-sm leading-tight mt-1 ${remainingBudget < 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                    {sym}{remainingBudget.toFixed(0)}
                  </span>
                </div>

                {/* Safe limit recommendation */}
                <div className="p-2.5 rounded-xl border border-slate-900 bg-slate-950/20 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Daily Limit</span>
                  <span className="font-mono font-extrabold text-slate-200 text-sm leading-tight mt-1">
                    {sym}{dailySafeLimit.toFixed(0)}
                  </span>
                </div>

                {/* Predicted End-Spend */}
                <div className="p-2.5 rounded-xl border border-slate-900 bg-slate-950/20 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Predicted</span>
                  <span className="font-mono font-extrabold text-slate-200 text-sm leading-tight mt-1">
                    {sym}{predictedEndSpent.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Safe limits warning recommendation banner */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 text-[11px] text-slate-350 leading-normal font-medium">
                {budgetHealthStatus === 'CRITICAL' && (
                  <p className="text-rose-400 font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Danger: You have consumed {percentageUsed}% of your budget limits. Freeze non-essential shopping immediately.
                  </p>
                )}
                {budgetHealthStatus === 'WARNING' && (
                  <p className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Warning: You are nearing critical levels. Try adhering to your safe limit of {sym}{dailySafeLimit} per day.
                  </p>
                )}
                {budgetHealthStatus === 'SAFE' && (
                  <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span>✔</span> Your budget health is stable! Your daily safe allocation is {sym}{dailySafeLimit}.
                  </p>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-6 bg-slate-950/30 border border-slate-900 border-dashed rounded-2xl">
              <span className="text-2xl mb-1.5 block">💸</span>
              <p className="text-xs text-slate-400 font-semibold">No active budget configured for this month.</p>
              <button
                onClick={startCreateMode}
                className="mt-3 px-3 py-1.5 bg-indigo-600/95 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition active:scale-95"
              >
                Set Monthly Budget
              </button>
            </div>
          )}
        </>
      )}

      {/* BUDGET HISTORY SECTION */}
      <div className="space-y-2 pt-2 border-t border-slate-800/40">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
          <span>Budget History</span>
          {activeBudget && (
            <button
              onClick={startCreateMode}
              className="text-indigo-400 hover:text-indigo-300 font-bold"
            >
              + Create Future
            </button>
          )}
        </div>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto sidebar-scrollbar pr-1">
          {loadingHistory ? (
            <span className="text-[10px] text-slate-500 italic block py-2 text-center animate-pulse">Loading logs...</span>
          ) : history && history.length > 0 ? (
            history.map((hItem) => {
              const hSym = getCurrencySymbol(hItem.currency);
              const isActive = activeBudget && activeBudget._id === hItem._id;
              
              return (
                <div
                  key={hItem._id}
                  className={`flex justify-between items-center text-xs p-2 border rounded-xl transition ${
                    isActive
                      ? 'bg-indigo-500/5 border-indigo-500/20'
                      : 'bg-slate-950/30 border-slate-900 hover:border-slate-850'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200">
                      {getMonthName(hItem.month)} {hItem.year}
                    </span>
                    {isActive && (
                      <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white font-mono">
                      {hSym}{hItem.budgetAmount.toFixed(0)}
                    </span>
                    <button
                      onClick={() => handleDeleteBudget(hItem._id)}
                      className="text-slate-500 hover:text-rose-500 text-xs active:scale-95 transition"
                      title="Remove budget configuration"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <span className="text-[10px] text-slate-500 italic block py-2 text-center">No historic budget setups registered.</span>
          )}
        </div>
      </div>
    </div>
  );
};
