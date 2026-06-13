import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type };

    setToasts((prev) => {
      const nextToasts = [...prev, newToast];
      if (nextToasts.length > 3) {
        // Enforce stacking limit of up to 3 toasts (Task 57)
        return nextToasts.slice(nextToasts.length - 3);
      }
      return nextToasts;
    });

    // Auto-dismiss after 4 seconds (Task 57)
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Container & Presentation Component
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const { type, message } = toast;

  let bgClass = 'bg-slate-900/90 border-slate-700 text-slate-100';
  let iconColor = 'text-indigo-400';
  let iconSvg = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  if (type === 'success') {
    bgClass = 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200 backdrop-blur-md';
    iconColor = 'text-emerald-400';
    iconSvg = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  } else if (type === 'error') {
    bgClass = 'bg-rose-950/80 border-rose-800/80 text-rose-200 backdrop-blur-md';
    iconColor = 'text-rose-400';
    iconSvg = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  } else if (type === 'info') {
    bgClass = 'bg-sky-950/80 border-sky-800/80 text-sky-200 backdrop-blur-md';
    iconColor = 'text-sky-400';
  }

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-4 rounded-2xl border shadow-2xl transition-all duration-300 transform translate-y-0 animate-fade-in-up ${bgClass}`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <div className={iconColor}>{iconSvg}</div>
        <p className="text-sm font-medium pr-2">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-white transition-colors duration-150 p-1 rounded-lg hover:bg-white/10"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
