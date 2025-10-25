import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export interface SSHConfig {
    host: string;
    port: number;
    username: string;
    keyPath?: string;
    password?: string;
}

export interface SSHConnection {
    id: string;
    host: string;
    port: number;
    username: string;
    connected: boolean;
    lastActivity: Date;
}

class SSHStateManager {
    private connections: Map<string, SSHConnection> = new Map();
    private currentConnection: string | null = null;

    constructor() {
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // Listen for SSH connection events
        listen('ssh-connected', (event) => {
            console.log('SSH connected:', event.payload);
            // Update state if needed
        });

        listen('ssh-disconnected', (event) => {
            const connectionId = event.payload as string;
            console.log('SSH disconnected:', connectionId);
            this.connections.delete(connectionId);
            if (this.currentConnection === connectionId) {
                this.currentConnection = null;
            }
        });
    }

    async connect(config: SSHConfig): Promise<string> {
        try {
            const connectionId = await invoke<string>('connect_ssh', {
                host: config.host,
                port: config.port,
                username: config.username,
                keyPath: config.keyPath,
                password: config.password
            });

            const connection: SSHConnection = {
                id: connectionId,
                host: config.host,
                port: config.port,
                username: config.username,
                connected: true,
                lastActivity: new Date()
            };

            this.connections.set(connectionId, connection);
            this.currentConnection = connectionId;

            return connectionId;
        } catch (error) {
            console.error('Failed to connect to SSH:', error);
            throw error;
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        try {
            await invoke('disconnect_ssh', { connectionId });
            this.connections.delete(connectionId);
            
            if (this.currentConnection === connectionId) {
                this.currentConnection = null;
            }
        } catch (error) {
            console.error('Failed to disconnect SSH:', error);
            throw error;
        }
    }

    async isConnected(connectionId: string): Promise<boolean> {
        try {
            return await invoke<boolean>('is_ssh_connected', { connectionId });
        } catch (error) {
            console.error('Failed to check SSH connection:', error);
            return false;
        }
    }

    async listConnections(): Promise<string[]> {
        try {
            return await invoke<string[]>('list_ssh_connections');
        } catch (error) {
            console.error('Failed to list SSH connections:', error);
            return [];
        }
    }

    getCurrentConnection(): SSHConnection | null {
        if (!this.currentConnection) return null;
        return this.connections.get(this.currentConnection) || null;
    }

    getAllConnections(): SSHConnection[] {
        return Array.from(this.connections.values());
    }

    setCurrentConnection(connectionId: string): void {
        if (this.connections.has(connectionId)) {
            this.currentConnection = connectionId;
        }
    }
}

// Global SSH state manager
export const sshStateManager = new SSHStateManager();

export async function initializeSSHConnection(config: SSHConfig): Promise<string> {
    return await sshStateManager.connect(config);
}

export function getSSHStateManager(): SSHStateManager {
    return sshStateManager;
}
