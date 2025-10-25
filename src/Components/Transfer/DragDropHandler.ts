import { transferQueueManager } from '../../Service/transfer_queue';
import { invoke } from '@tauri-apps/api/tauri';

export interface DragDropData {
    sourcePane: string;
    destPane: string;
    sourcePath: string;
    destPath: string;
    filename: string;
    isDirectory: boolean;
}

class DragDropHandler {
    private dragData: DragDropData | null = null;
    private isDragging = false;

    constructor() {
        this.initializeDragDrop();
    }

    private initializeDragDrop(): void {
        // Add drag and drop event listeners to all panes
        const panes = document.querySelectorAll('.pane');
        
        panes.forEach(pane => {
            pane.addEventListener('dragstart', this.handleDragStart.bind(this));
            pane.addEventListener('dragend', this.handleDragEnd.bind(this));
            pane.addEventListener('dragover', this.handleDragOver.bind(this));
            pane.addEventListener('dragenter', this.handleDragEnter.bind(this));
            pane.addEventListener('dragleave', this.handleDragLeave.bind(this));
            pane.addEventListener('drop', this.handleDrop.bind(this));
        });
    }

    private handleDragStart(e: DragEvent): void {
        const target = e.target as HTMLElement;
        const fileItem = target.closest('.file-item');
        
        if (!fileItem) return;

        this.isDragging = true;
        this.dragData = this.extractDragData(fileItem);
        
        if (this.dragData) {
            e.dataTransfer?.setData('text/plain', JSON.stringify(this.dragData));
            e.dataTransfer!.effectAllowed = 'copy';
            
            // Add visual feedback
            fileItem.classList.add('dragging');
        }
    }

    private handleDragEnd(e: DragEvent): void {
        this.isDragging = false;
        this.dragData = null;
        
        // Remove visual feedback
        const fileItems = document.querySelectorAll('.file-item.dragging');
        fileItems.forEach(item => item.classList.remove('dragging'));
    }

    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
    }

    private handleDragEnter(e: DragEvent): void {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        target.classList.add('drag-over');
    }

    private handleDragLeave(e: DragEvent): void {
        const target = e.currentTarget as HTMLElement;
        target.classList.remove('drag-over');
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        target.classList.remove('drag-over');
        
        if (!this.dragData) return;

        const destPane = this.getPaneId(target);
        const sourcePane = this.dragData.sourcePane;

        // Check if this is a valid drop (different panes)
        if (sourcePane === destPane) {
            console.log('Cannot drop on same pane');
            return;
        }

        // Determine transfer direction
        const direction = this.getTransferDirection(sourcePane, destPane);
        
        if (direction) {
            this.initiateTransfer(this.dragData, destPane, direction);
        }
    }

    private extractDragData(fileItem: HTMLElement): DragDropData | null {
        const sourcePane = this.getPaneId(fileItem.closest('.pane')!);
        const sourcePath = fileItem.dataset.path || '';
        const filename = fileItem.dataset.filename || '';
        const isDirectory = fileItem.dataset.isDirectory === 'true';

        if (!sourcePath || !filename) return null;

        return {
            sourcePane,
            destPane: '', // Will be set on drop
            sourcePath,
            destPath: '', // Will be set on drop
            filename,
            isDirectory
        };
    }

    private getPaneId(element: HTMLElement): string {
        const pane = element.closest('.pane');
        return pane?.id || '';
    }

    private getTransferDirection(sourcePane: string, destPane: string): 'windows_to_linux' | 'linux_to_windows' | null {
        if (sourcePane.includes('windows') && destPane.includes('linux')) {
            return 'windows_to_linux';
        } else if (sourcePane.includes('linux') && destPane.includes('windows')) {
            return 'linux_to_windows';
        }
        return null;
    }

    private async initiateTransfer(
        dragData: DragDropData,
        destPane: string,
        direction: 'windows_to_linux' | 'linux_to_windows'
    ): Promise<void> {
        try {
            // Determine destination path
            const destPath = await this.getDestinationPath(destPane, dragData.filename);
            
            if (!destPath) {
                console.error('Could not determine destination path');
                return;
            }

            // Create transfer task
            const taskId = await transferQueueManager.createTransferTask(
                dragData.sourcePath,
                destPath,
                direction
            );

            console.log('Transfer initiated:', taskId);

            // Show progress UI
            this.showTransferProgress(taskId, dragData.filename);

        } catch (error) {
            console.error('Failed to initiate transfer:', error);
            this.showError('Transfer failed: ' + error);
        }
    }

    private async getDestinationPath(destPane: string, filename: string): Promise<string | null> {
        // This would get the current directory of the destination pane
        // For now, return a placeholder
        if (destPane.includes('linux')) {
            return `/home/user/${filename}`;
        } else if (destPane.includes('windows')) {
            return `C:\\Users\\User\\${filename}`;
        }
        return null;
    }

    private showTransferProgress(taskId: string, filename: string): void {
        // Create progress UI element
        const progressContainer = document.createElement('div');
        progressContainer.className = 'transfer-progress-container';
        progressContainer.innerHTML = `
            <div class="transfer-item">
                <span class="filename">${filename}</span>
                <div class="progress-bar">
                    <div class="transfer-progress" style="width: 0%"></div>
                </div>
                <span class="percentage">0%</span>
            </div>
        `;

        // Add to status area
        const statusArea = document.getElementById('status-area') || this.createStatusArea();
        statusArea.appendChild(progressContainer);

        // Set up progress callback
        transferQueueManager.onProgress(taskId, (progress) => {
            const progressBar = progressContainer.querySelector('.transfer-progress') as HTMLElement;
            const percentage = progressContainer.querySelector('.percentage') as HTMLElement;
            
            if (progressBar) {
                progressBar.style.width = `${progress.percentage}%`;
            }
            if (percentage) {
                percentage.textContent = `${Math.round(progress.percentage)}%`;
            }
        });
    }

    private createStatusArea(): HTMLElement {
        const statusArea = document.createElement('div');
        statusArea.id = 'status-area';
        statusArea.className = 'status-area';
        document.body.appendChild(statusArea);
        return statusArea;
    }

    private showError(message: string): void {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Global drag drop handler
export const dragDropHandler = new DragDropHandler();

export function initializeDragDrop(): void {
    console.log('Drag and drop initialized');
}

export function getDragDropHandler(): DragDropHandler {
    return dragDropHandler;
}
