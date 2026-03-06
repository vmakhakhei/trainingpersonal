// file: src/components/layout/MainLayout.jsx
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Dumbbell, TrendingUp, BookOpen, Brain, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export default function MainLayout() {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/log-workout', icon: Dumbbell, label: 'Тренировка' },
    { to: '/analytics', icon: TrendingUp, label: 'Аналитика' },
    { to: '/approaches', icon: BookOpen, label: 'Методики' },
    { to: '/ai', icon: Brain, label: 'AI' },
    { to: '/profile', icon: User, label: 'Профиль' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">

      {/* ── Шапка с кнопкой темы ── */}
      <header className="fixed top-0 left-0 right-0 z-10
                         bg-dark-surface border-b border-dark-border
                         safe-top
                         transition-colors duration-200">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Логотип / название */}
          <span className="text-dark-text font-semibold text-base tracking-tight">
            Personal Trainer
          </span>

          {/* Переключатель темы */}
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark'
              ? <Sun className="w-5 h-5 text-dark-muted" />
              : <Moon className="w-5 h-5 text-dark-muted" />
            }
          </button>
        </div>
      </header>

      {/* ── Основной контент ── */}
      {/* pt-12 чтобы не перекрывалось шапкой, pb-20 — нижней навигацией */}
      <main className="flex-1 pt-12 pb-20">
        <Outlet />
      </main>

      {/* ── Нижняя навигация ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-10
                      bg-dark-surface border-t border-dark-border
                      safe-bottom
                      transition-colors duration-200">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-touch
                 transition-colors duration-150 ${isActive
                  ? 'text-primary-500'
                  : 'text-dark-muted hover:text-dark-text'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] mt-0.5 font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
