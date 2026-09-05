import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  refreshInterval: number;
  toggleTheme: () => void;
  setRefreshInterval: (interval: number) => void;
}

const STORAGE_KEY = 'gorig_om_app_settings';

const getSavedState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load app settings', e);
  }
  return {
    theme: 'light',
    refreshInterval: 10000,
  };
};

export const useAppStore = create<AppState>((set) => {
  const initial = getSavedState();

  return {
    theme: initial.theme || 'light',
    refreshInterval: initial.refreshInterval !== undefined ? initial.refreshInterval : 10000,

    toggleTheme: () => {
      set((state) => {
        const nextTheme = state.theme === 'light' ? 'dark' : 'light';
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: nextTheme, refreshInterval: state.refreshInterval }));
        return { theme: nextTheme };
      });
    },

    setRefreshInterval: (interval: number) => {
      set((state) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: state.theme, refreshInterval: interval }));
        return { refreshInterval: interval };
      });
    },
  };
});
