import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export interface TransferTask {
    id: string;
    sourcePath: string;
    destPath: string;
    direction: 'windows_to_linux' | 'linux_to_windows';
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    totalBytes: number;
    transferredBytes: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

export interface TransferProgress {
    taskId: string;
    filename: string;
    direction: string;
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
    speedBytesPerSec: number;
    estimatedRemainingSecs: number;
}

class TransferQueueManager {
    private activeTransfers: Map<string, TransferTask> = new Map();
    private progressCallbacks: Map<string, (progress: TransferProgress) => void> = new Map();

    constructor() {
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // Listen for transfer progress events
        listen('transfer_progress', (event) => {
            const progress = event.payload as TransferProgress;
            this.handleTransferProgress(progress);
        });

        // Listen for transfer completion events
        listen('transfer_completed', (event) => {
            const taskId = event.payload as string;
            this.handleTransferCompleted(taskId);
        });

        // Listen for transfer failed events
        listen('transfer_failed', (event) => {
            const { taskId, error } = event.payload as { taskId: string; error: string };
            this.handleTransferFailed(taskId, error);
        });
    }

    async createTransferTask(
        sourcePath: string,
        destPath: string,
        direction: 'windows_to_linux' | 'linux_to_windows'
    ): Promise<string> {
        try {
            const taskId = await invoke<string>('create_transfer_task', {
                sourcePath,
                destPath,
                direction
            });

            // The task will be created on the Rust side
            console.log('Transfer task created:', taskId);
            return taskId;
        } catch (error) {
            console.error('Failed to create transfer task:', error);
            throw error;
        }
    }

    async getTransferProgress(taskId: string): Promise<TransferProgress | null> {
        try {
            const progress = await invoke<TransferProgress | null>('get_transfer_progress', { taskId });
            return progress;
        } catch (error) {
            console.error('Failed to get transfer progress:', error);
            return null;
        }
    }

    async getActiveTransfers(): Promise<TransferTask[]> {
        try {
            const transfers = await invoke<TransferTask[]>('get_active_transfers');
            return transfers;
        } catch (error) {
            console.error('Failed to get active transfers:', error);
            return [];
        }
    }

    async cancelTransfer(taskId: string): Promise<void> {
        try {
            await invoke('cancel_transfer', { taskId });
            this.activeTransfers.delete(taskId);
        } catch (error) {
            console.error('Failed to cancel transfer:', error);
            throw error;
        }
    }

    async retryTransfer(taskId: string): Promise<void> {
        try {
            await invoke('retry_transfer', { taskId });
        } catch (error) {
            console.error('Failed to retry transfer:', error);
            throw error;
        }
    }

    private handleTransferProgress(progress: TransferProgress): void {
        console.log('Transfer progress:', progress);
        
        // Update UI with progress
        this.updateProgressUI(progress);
        
        // Call registered callbacks
        const callback = this.progressCallbacks.get(progress.taskId);
        if (callback) {
            callback(progress);
        }
    }

    private handleTransferCompleted(taskId: string): void {
        console.log('Transfer completed:', taskId);
        this.activeTransfers.delete(taskId);
        this.progressCallbacks.delete(taskId);
    }

    private handleTransferFailed(taskId: string, error: string): void {
        console.error('Transfer failed:', taskId, error);
        this.activeTransfers.delete(taskId);
        this.progressCallbacks.delete(taskId);
    }

    private updateProgressUI(progress: TransferProgress): void {
        // Update progress bars in the UI
        const progressBars = document.querySelectorAll('.transfer-progress');
        progressBars.forEach(bar => {
            if (bar instanceof HTMLElement) {
                bar.style.width = `${progress.percentage}%`;
            }
        });

        // Update status bar
        const statusBar = document.getElementById('status-bar');
        if (statusBar && statusBar instanceof HTMLElement) {
            statusBar.textContent = `Transferring ${progress.filename}: ${Math.round(progress.percentage)}%`;
        }
    }

    onProgress(taskId: string, callback: (progress: TransferProgress) => void): void {
        this.progressCallbacks.set(taskId, callback);
    }

    removeProgressCallback(taskId: string): void {
        this.progressCallbacks.delete(taskId);
    }
}

// Global transfer queue manager
export const transferQueueManager = new TransferQueueManager();

export function initializeTransferQueue(): void {
    console.log('Transfer queue initialized');
}

export function getTransferQueueManager(): TransferQueueManager {
    return transferQueueManager;
}
