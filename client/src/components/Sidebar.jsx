import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotification();
  const { theme, toggleTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  const navItems = user?.role === 'administrator'
    ? [
        {
          name: 'Upload Notice',
          path: '/admin',
          icon: (
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          ),
        },
        {
          name: 'Previous Notices',
          path: '/admin/previous-notices',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        }
      ]
    : [
        {
          name: 'Dashboard',
          path: '/dashboard',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          name: 'Calendar',
          path: '/calendar',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'Notices',
          path: '/notices',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          name: 'Notifications',
          path: '/notifications',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
        },
        {
          name: 'Study Plan',
          path: '/study-plan',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
        },
        {
          name: 'Attendance',
          path: '/attendance',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          name: 'Chatbot',
          path: '/chat',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          name: 'Focus Zone',
          path: '/focus-zone',
          icon: (
            <span className="text-lg leading-none select-none" aria-hidden="true">🌱</span>
          ),
        },
        {
          name: 'Smart Scheduler',
          path: '/scheduling',
          icon: (
            <span className="text-lg leading-none select-none" aria-hidden="true">📅</span>
          ),
        },
        {
          name: 'Life Companion',
          path: '/life-companion',
          icon: (
            <span className="text-lg leading-none select-none" aria-hidden="true">❤️</span>
          ),
        },

      ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900 text-slate-200">
      
      {/* Fixed Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-bold tracking-wider text-white">Campus Flow</h1>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" aria-hidden="true"></span>
          <span className="sr-only">Live Connection Connected</span>
        </div>
      </div>

      {/* User Card */}
      <div className="p-4 mx-4 my-5 bg-slate-950/60 rounded-2xl border border-slate-850 flex flex-col gap-1.5 flex-shrink-0">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Logged in as</div>
        <div className="font-semibold text-white truncate text-sm leading-tight">{user?.name}</div>
        <div className="inline-flex self-start px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {user?.role}
        </div>
      </div>

      {/* Navigation Links - Scrollable */}
      <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto overflow-x-hidden min-h-0 sidebar-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-250 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-slate-800/40'
              }`
            }
            aria-label={item.name}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.name}</span>
            </div>
            {item.name === 'Notifications' && unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white leading-none">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Fixed Footer */}
      <div className="p-4 border-t border-slate-800 flex flex-col gap-2.5 bg-slate-900/95 backdrop-blur-md flex-shrink-0 z-10">
        
        {/* Theme Switch Button */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-450 hover:text-white hover:bg-slate-850 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg leading-none select-none" aria-hidden="true">
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
        </button>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-800 text-slate-450 hover:text-white hover:bg-rose-950/20 hover:border-rose-900/40 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Sign Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>

      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-40 px-4 flex items-center justify-between shadow-md select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-750 flex items-center justify-center text-slate-350 hover:text-white active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Open Navigation Sidebar Menu"
            aria-expanded={isMobileOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-bold tracking-wider text-white">Campus Flow</span>
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" aria-hidden="true"></span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-750 flex items-center justify-center text-lg active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Toggle Theme Switcher"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {unreadCount > 0 && (
            <NavLink
              to="/notifications"
              className="w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-500/25 flex items-center justify-center relative text-rose-450 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Notifications Drawer Link"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white leading-none">
                {unreadCount}
              </span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Desktop Navigation Sidebar (Left-positioned, full-height) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-200 h-screen select-none relative overflow-hidden transition-all duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Slide-over Panel Overlay */}
      <div 
        className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ${
          isMobileOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop glass blur */}
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />

        {/* Drawer container (slides in from left) */}
        <aside 
          className={`absolute top-0 bottom-0 left-0 w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 transform ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Close button inside Drawer */}
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400 hover:text-white active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close Sidebar Menu Drawer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <SidebarContent />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
