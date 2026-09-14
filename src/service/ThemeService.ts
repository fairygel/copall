export type Theme = 'dark' | 'light' | 'exclusive';

export const THEMES: Theme[] = ['dark', 'light', 'exclusive'];

export const THEME_LABEL: Record<Theme, string> = {
    dark: 'Dark',
    light: 'Light',
    exclusive: 'Exclusive',
};

export function getSavedTheme(): Theme {
    const saved = localStorage.getItem('theme') as Theme | null;

    return saved && THEMES.includes(saved) ? saved : 'dark';
}

export function applyTheme(next: Theme) {
    localStorage.setItem('theme', next);

    if (next === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', next);
    }
}

export function themeFromLabel(label: string): Theme {
    return (Object.entries(THEME_LABEL).find(([, v]) => v === label)?.[0] ?? 'dark') as Theme;
}
