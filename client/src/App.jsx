import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Sidebar from './components/Sidebar';
import NotificationBanner from './components/NotificationBanner';

// Lazy-load page components (Task 58)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const NoticesPage = lazy(() => import('./pages/NoticesPage'));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const FocusZonePage = lazy(() => import('./pages/FocusZonePage'));
const SchedulingPage = lazy(() => import('./pages/SchedulingPage'));
const RoutinePage = lazy(() => import('./pages/RoutinePage'));
const LifeCompanionPage = lazy(() => import('./pages/LifeCompanionPage'));
const PreviousNoticesPage = lazy(() => import('./pages/PreviousNoticesPage'));




import { NotificationProvider } from './context/NotificationContext';

// AppLayout houses the Sidebar navigation and Notification Banner alert area
const AppLayout = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0">
        <NotificationBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export const App = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <Router>
              <Routes>

  {/* Root Route */}
  <Route path="/" element={<Navigate to="/login" replace />} />

  {/* Public Routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Protected Student Routes */}
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <DashboardPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/calendar"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <CalendarPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/notices"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <NoticesPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/study-plan"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <StudyPlanPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/chat"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <ChatPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/attendance"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <AttendancePage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/notifications"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <NotificationsPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/focus-zone"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <FocusZonePage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/scheduling"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <SchedulingPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/routine"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <RoutinePage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/life-companion/*"
    element={
      <ProtectedRoute allowedRoles={['student']}>
        <AppLayout>
          <LifeCompanionPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  {/* Protected Admin Route */}
  <Route
    path="/admin"
    element={
      <ProtectedRoute allowedRoles={['administrator']}>
        <AppLayout>
          <AdminPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/admin/previous-notices"
    element={
      <ProtectedRoute allowedRoles={['administrator']}>
        <AppLayout>
          <PreviousNoticesPage />
        </AppLayout>
      </ProtectedRoute>
    }
  />

  {/* Catch All Route */}
  <Route path="*" element={<Navigate to="/login" replace />} />

</Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
