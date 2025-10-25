import { connectionPanel } from '../Connection/ConnectionPanel';
import { transferQueueManager } from '../../Service/transfer_queue';

class StatusBar {
    private statusBar: HTMLElement | null = null;
    private sshStatus: HTMLElement | null = null;
    private transferStatus: HTMLElement | null = null;
    private connectionInfo: HTMLElement | null = null;

    constructor() {
        this.createStatusBar();
        this.initializeEventListeners();
    }

    private createStatusBar(): void {
        const statusBar = document.createElement('div');
        statusBar.id = 'status-bar';
        statusBar.className = 'status-bar';
        
        statusBar.innerHTML = `
            <div class="status-left">
                <span id="ssh-status" class="status-disconnected">SSH: Disconnected</span>
                <span id="connection-info" class="connection-info"></span>
            </div>
            <div class="status-center">
                <span id="transfer-status" class="transfer-status">Ready</span>
            </div>
            <div class="status-right">
                <span id="file-count" class="file-count">0 files</span>
                <span id="free-space" class="free-space"></span>
            </div>
        `;
        
        document.body.appendChild(statusBar);
        this.statusBar = statusBar;
        this.sshStatus = document.getElementById('ssh-status');
        this.transferStatus = document.getElementById('transfer-status');
        this.connectionInfo = document.getElementById('connection-info');
    }

    private initializeEventListeners(): void {
        // Listen for SSH connection events
        document.addEventListener('ssh-connected', (e) => {
            this.updateSSHStatus(true, (e as CustomEvent).detail);
        });

        document.addEventListener('ssh-disconnected', () => {
            this.updateSSHStatus(false);
        });

        // Listen for transfer events
        document.addEventListener('transfer-started', (e) => {
            this.updateTransferStatus('Transferring...', (e as CustomEvent).detail);
        });

        document.addEventListener('transfer-completed', () => {
            this.updateTransferStatus('Transfer completed');
        });

        document.addEventListener('transfer-failed', (e) => {
            this.updateTransferStatus('Transfer failed', (e as CustomEvent).detail);
        });

        // Update file count periodically
        setInterval(() => {
            this.updateFileCount();
        }, 5000);
    }

    private updateSSHStatus(connected: boolean, connectionInfo?: any): void {
        if (this.sshStatus) {
            this.sshStatus.textContent = connected ? 'SSH: Connected' : 'SSH: Disconnected';
            this.sshStatus.className = connected ? 'status-connected' : 'status-disconnected';
        }

        if (this.connectionInfo && connectionInfo) {
            this.connectionInfo.textContent = `${connectionInfo.username}@${connectionInfo.host}`;
        }
    }

    private updateTransferStatus(status: string, details?: any): void {
        if (this.transferStatus) {
            this.transferStatus.textContent = status;
            
            if (details) {
                this.transferStatus.title = JSON.stringify(details, null, 2);
            }
        }
    }

    private async updateFileCount(): Promise<void> {
        try {
            const activeTransfers = await transferQueueManager.getActiveTransfers();
            const fileCount = activeTransfers.length;
            
            const fileCountElement = document.getElementById('file-count');
            if (fileCountElement) {
                fileCountElement.textContent = `${fileCount} transfers`;
            }
        } catch (error) {
            console.error('Failed to update file count:', error);
        }
    }

    private async updateFreeSpace(): Promise<void> {
        try {
            // This would call a Tauri command to get free space
            const freeSpace = await this.getFreeSpace();
            
            const freeSpaceElement = document.getElementById('free-space');
            if (freeSpaceElement) {
                freeSpaceElement.textContent = this.formatBytes(freeSpace);
            }
        } catch (error) {
            console.error('Failed to update free space:', error);
        }
    }

    private async getFreeSpace(): Promise<number> {
        // This would be implemented with a Tauri command
        return 1024 * 1024 * 1024; // 1GB placeholder
    }

    private formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]} free`;
    }

    showMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        const messageElement = document.createElement('div');
        messageElement.className = `status-message ${type}`;
        messageElement.textContent = message;
        
        if (this.statusBar) {
            this.statusBar.appendChild(messageElement);
            
            setTimeout(() => {
                messageElement.remove();
            }, 3000);
        }
    }

    showProgress(progress: number, filename: string): void {
        if (this.transferStatus) {
            this.transferStatus.textContent = `Transferring ${filename}: ${Math.round(progress)}%`;
        }
    }

    clearProgress(): void {
        if (this.transferStatus) {
            this.transferStatus.textContent = 'Ready';
        }
    }

    updateConnectionInfo(host: string, username: string): void {
        if (this.connectionInfo) {
            this.connectionInfo.textContent = `${username}@${host}`;
        }
    }
}

// Global status bar instance
export const statusBar = new StatusBar();

export function initializeStatusBar(): void {
    console.log('Status bar initialized');
}

export function getStatusBar(): StatusBar {
    return statusBar;
}
