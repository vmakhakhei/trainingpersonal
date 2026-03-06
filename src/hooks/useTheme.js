// file: src/hooks/useTheme.js
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'app-theme';
const DEFAULT_THEME = 'dark';

/**
 * Хук для управления темой приложения.
 * Сохраняет выбор в localStorage, применяет класс на <html>.
 *
 * @returns {{ theme: 'dark'|'light', toggleTheme: Function, setTheme: Function }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Читаем из localStorage при инициализации
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    const html = document.documentElement;

    // Убираем оба класса, добавляем нужный
    html.classList.remove('dark', 'light');
    html.classList.add(theme);

    // Сохраняем
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage недоступен — не критично
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  return { theme, toggleTheme, setTheme };
}
