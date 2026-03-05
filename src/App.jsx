// file: src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LogWorkoutPage from './pages/LogWorkoutPage';
import WorkoutsPage from './pages/WorkoutsPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import ExercisesPage from './pages/ExercisesPage';
import PlansPage from './pages/PlansPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ApproachesPage from './pages/ApproachesPage';
import InstructionsPage from './pages/InstructionsPage';
import AIPage from './pages/AIPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { user, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="text-dark-muted">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <LoginPage />} 
        />
        
        <Route element={user ? <MainLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/log-workout" element={<LogWorkoutPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/approaches" element={<ApproachesPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
