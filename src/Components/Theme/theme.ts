import { THEME_LIGHT, THEME_DARK, THEME_CUSTOM } from '../../Util/constants';

export function updateTheme(selector: string, customTheme?: string): void {
    const element = selector === '*' ? document.documentElement : document.querySelector(selector);
    if (!element) return;

    if (customTheme) {
        // Apply custom theme
        element.setAttribute('data-theme', THEME_CUSTOM);
        element.setAttribute('data-custom-theme', customTheme);
    } else {
        // Apply default theme based on system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? THEME_DARK : THEME_LIGHT;
        element.setAttribute('data-theme', theme);
    }
}

export function setTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Save theme preference
    if (typeof Storage !== 'undefined') {
        localStorage.setItem('circle9-theme', theme);
    }
}

export function getCurrentTheme(): string {
    return document.documentElement.getAttribute('data-theme') || THEME_LIGHT;
}

export function loadTheme(): void {
    const savedTheme = localStorage.getItem('circle9-theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        updateTheme('*');
    }
}

export function toggleTheme(): void {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    setTheme(newTheme);
}
