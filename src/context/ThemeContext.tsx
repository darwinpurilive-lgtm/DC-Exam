import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = (localStorage.getItem('exam_theme_mode') || localStorage.getItem('apex_theme_mode')) as ThemeMode;
    // Default to Classic White
    return saved === 'dark' ? 'dark' : 'light';
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('exam_theme_mode', mode);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('theme-light', 'theme-dark', 'dark');
    body.classList.remove('theme-light', 'theme-dark', 'dark');

    if (theme === 'light') {
      root.classList.add('theme-light');
      body.classList.add('theme-light');
    } else {
      root.classList.add('theme-dark', 'dark');
      body.classList.add('theme-dark', 'dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
