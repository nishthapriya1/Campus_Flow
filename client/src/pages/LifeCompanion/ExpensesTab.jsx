import React from 'react';
import { BudgetCard } from './BudgetCard';

export const ExpensesTab = ({
  expenseIntelligence = {},
  expenseForm = {},
  setExpenseForm,
  handleExpenseSubmit,
  handleExpenseDelete,
  fetchData
}) => {
  const {
    budgetScore = 100,
    spendingTrends = {},
    savingsEstimates = 0,
    financialInsights = [],
    expenses = [],
    activeBudget = null
  } = expenseIntelligence;

  const getCurrencySymbol = (curr) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'EUR': return '€';
      case 'USD':
      default: return '$';
    }
  };

  const currentCurrency = activeBudget ? activeBudget.currency : 'USD';
  const sym = getCurrencySymbol(currentCurrency);
  const maxVal = activeBudget?.budgetAmount || 300;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Budget Card */}
      <BudgetCard
        expenseIntelligence={expenseIntelligence}
        fetchData={fetchData}
      />

      {/* Logging Form */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2">
          💵 Log Expense Record
        </h3>
        <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs font-medium">
          
          <div className="space-y-1">
            <label className="text-slate-400">Amount ({sym})</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 15.50"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Category</label>
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white"
            >
              <option>Food</option>
              <option>Travel</option>
              <option>Education</option>
              <option>Shopping</option>
              <option>Entertainment</option>
              <option>Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Description</label>
            <input
              type="text"
              placeholder="e.g. Lunch at cafeteria"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Date</label>
            <input
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition"
          >
            Log Expense
          </button>

        </form>
      </div>

      {/* Spending Breakdown & History */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2">
          📊 Spending Analytics
        </h3>
        
        {/* Category breakdown visual bars */}
        <div className="space-y-3 bg-slate-950/30 border border-slate-900 p-4 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly category totals</span>
          {Object.entries(spendingTrends || {}).map(([cat, total]) => (
            <div key={cat} className="space-y-1.5">
              <div className="flex justify-between text-slate-350 font-medium font-mono text-[11px]">
                <span>{cat}</span>
                <span className="font-bold text-white">{sym}{total.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (total / maxVal) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {savingsEstimates > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-400 font-bold flex items-center justify-between">
            <span>💡 Savings opportunity</span>
            <span>Save up to {sym}{savingsEstimates.toFixed(2)} this month</span>
          </div>
        )}

        <div className="space-y-2 mt-4">
          <span className="text-[10px] uppercase font-bold text-slate-500">Expenses Log list</span>
          <div className="space-y-2 overflow-y-auto max-h-[160px] sidebar-scrollbar pr-1">
            {expenses && expenses.length > 0 ? (
              expenses.map((exp, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-950/30 p-2.5 border border-slate-900 rounded-xl hover:border-slate-850 transition">
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{exp.category}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{exp.description || 'No description'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white font-mono">{sym}{exp.amount.toFixed(2)}</span>
                    <button
                      onClick={() => handleExpenseDelete(exp._id)}
                      className="text-slate-500 hover:text-rose-500 text-sm active:scale-95 transition"
                      title="Delete record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-650 text-xs italic py-4 text-center">
                No transactions logged this month.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default ExpensesTab;
