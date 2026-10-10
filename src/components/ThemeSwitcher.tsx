import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface Props {
  minimal?: boolean;
}

export const ThemeSwitcher: React.FC<Props> = ({ minimal = false }) => {
  const { theme, toggleTheme } = useTheme();

  if (minimal) {
    return (
      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs"
        title={`Switch to ${theme === 'light' ? 'Dark Theme' : 'Classic White'}`}
      >
        {theme === 'light' ? (
          <Moon className="w-4 h-4 text-slate-700" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
      title={`Switch to ${theme === 'light' ? 'Dark Theme' : 'Classic White'}`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-3.5 h-3.5 text-slate-700" />
          <span>Dark Mode</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Classic White</span>
        </>
      )}
    </button>
  );
};
