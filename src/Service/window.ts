import { listen } from '@tauri-apps/api/event';

export function listenUpdateTheme(callback: () => void): void {
    listen('update-theme', callback);
}

export function emitUpdateTheme(): void {
    // This would emit an event to update the theme
    // Implementation depends on the specific event system
    console.log('Theme update requested');
}
