import { invoke } from '@tauri-apps/api/tauri';

export default class Storage {
    static async get(key: string, forceReload: boolean = false): Promise<any> {
        try {
            const result = await invoke('get_storage', { key });
            return result;
        } catch (error) {
            console.error(`Failed to get storage key ${key}:`, error);
            return null;
        }
    }

    static async set(key: string, value: any): Promise<void> {
        try {
            await invoke('set_storage', { key, value });
        } catch (error) {
            console.error(`Failed to set storage key ${key}:`, error);
        }
    }

    static async remove(key: string): Promise<void> {
        try {
            await invoke('remove_storage', { key });
        } catch (error) {
            console.error(`Failed to remove storage key ${key}:`, error);
        }
    }

    static async clear(): Promise<void> {
        try {
            await invoke('clear_storage');
        } catch (error) {
            console.error('Failed to clear storage:', error);
        }
    }

    static async keys(): Promise<string[]> {
        try {
            const result = await invoke('get_storage_keys');
            return result as string[];
        } catch (error) {
            console.error('Failed to get storage keys:', error);
            return [];
        }
    }

    static async has(key: string): Promise<boolean> {
        try {
            const result = await invoke('has_storage_key', { key });
            return result as boolean;
        } catch (error) {
            console.error(`Failed to check storage key ${key}:`, error);
            return false;
        }
    }
}
