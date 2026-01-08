import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'codex-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>('light');
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		// Check localStorage or system preference
		const stored = localStorage.getItem(THEME_KEY) as Theme | null;
		if (stored) {
			setTheme(stored);
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			setTheme('dark');
		}
	}, []);

	useEffect(() => {
		if (!mounted) return;

		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
		localStorage.setItem(THEME_KEY, theme);
	}, [theme, mounted]);

	const toggleTheme = () => {
		setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
	};

	// Prevent flash of wrong theme
	if (!mounted) {
		return <>{children}</>;
	}

	return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	// Return default values during SSR or if not in provider
	if (!context) {
		return {
			theme: 'light' as const,
			toggleTheme: () => {},
		};
	}
	return context;
}
