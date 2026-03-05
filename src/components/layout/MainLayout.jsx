// file: src/components/layout/MainLayout.jsx
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Dumbbell, TrendingUp, BookOpen, Brain, User } from 'lucide-react';

export default function MainLayout() {
  const navItems = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/log-workout', icon: Dumbbell, label: 'Тренировка' },
    { to: '/analytics', icon: TrendingUp, label: 'Аналитика' },
    { to: '/approaches', icon: BookOpen, label: 'Методики' },
    { to: '/ai', icon: Brain, label: 'AI' },
    { to: '/profile', icon: User, label: 'Профиль' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation - Источник: architecture - mobile-first */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border safe-bottom">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-touch transition-colors ${
                  isActive ? 'text-primary-500' : 'text-dark-muted hover:text-dark-text'
                }`
              }
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
