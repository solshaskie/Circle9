import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export interface WindowsFileInfo {
    name: string;
    path: string;
    size: number;
    isDirectory: boolean;
    modified: Date;
    attributes: {
        readOnly: boolean;
        hidden: boolean;
        system: boolean;
        archive: boolean;
    };
}

class WindowsFilesManager {
    private currentPath: string = 'C:\\Users\\';
    private fileList: WindowsFileInfo[] = [];
    private treeView: HTMLElement | null = null;
    private contentView: HTMLElement | null = null;

    constructor() {
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // Listen for file system events
        listen('file-created', (event) => {
            this.refreshCurrentDirectory();
        });

        listen('file-deleted', (event) => {
            this.refreshCurrentDirectory();
        });

        listen('file-modified', (event) => {
            this.refreshCurrentDirectory();
        });
    }

    async initializeWindowsFiles(): Promise<void> {
        // Initialize tree view
        this.treeView = document.getElementById('windows-tree-pane')?.querySelector('.tree-view');
        this.contentView = document.getElementById('windows-content-pane')?.querySelector('.file-list');

        if (this.treeView) {
            await this.buildDirectoryTree();
        }

        if (this.contentView) {
            await this.loadDirectoryContents(this.currentPath);
        }
    }

    private async buildDirectoryTree(): Promise<void> {
        if (!this.treeView) return;

        try {
            const directories = await this.getDirectories('C:\\');
            this.renderDirectoryTree(directories, this.treeView);
        } catch (error) {
            console.error('Failed to build directory tree:', error);
            this.treeView.innerHTML = '<div class="error">Failed to load directories</div>';
        }
    }

    private async getDirectories(path: string): Promise<string[]> {
        try {
            // This would call a Tauri command to get directories
            const result = await invoke<string[]>('list_windows_directories', { path });
            return result;
        } catch (error) {
            console.error('Failed to get directories:', error);
            return [];
        }
    }

    private renderDirectoryTree(directories: string[], container: HTMLElement): void {
        container.innerHTML = '';
        
        directories.forEach(dir => {
            const dirElement = document.createElement('div');
            dirElement.className = 'tree-item directory';
            dirElement.textContent = dir;
            dirElement.addEventListener('click', () => {
                this.navigateToDirectory(dir);
            });
            container.appendChild(dirElement);
        });
    }

    private async navigateToDirectory(path: string): Promise<void> {
        this.currentPath = path;
        await this.loadDirectoryContents(path);
        this.updateTreeSelection(path);
    }

    private async loadDirectoryContents(path: string): Promise<void> {
        if (!this.contentView) return;

        try {
            this.contentView.innerHTML = '<div class="loading">Loading...</div>';
            
            const files = await this.getDirectoryContents(path);
            this.fileList = files;
            this.renderFileList(files);
        } catch (error) {
            console.error('Failed to load directory contents:', error);
            this.contentView.innerHTML = '<div class="error">Failed to load directory</div>';
        }
    }

    private async getDirectoryContents(path: string): Promise<WindowsFileInfo[]> {
        try {
            const result = await invoke<WindowsFileInfo[]>('list_windows_files', { path });
            return result;
        } catch (error) {
            console.error('Failed to get directory contents:', error);
            return [];
        }
    }

    private renderFileList(files: WindowsFileInfo[]): void {
        if (!this.contentView) return;

        this.contentView.innerHTML = '';
        
        files.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = `file-item ${file.isDirectory ? 'directory' : 'file'}`;
            fileElement.dataset.path = file.path;
            fileElement.dataset.filename = file.name;
            fileElement.dataset.isDirectory = file.isDirectory.toString();
            fileElement.draggable = true;
            
            fileElement.innerHTML = `
                <div class="file-icon">${this.getFileIcon(file)}</div>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${this.formatFileSize(file.size)}</div>
                <div class="file-date">${this.formatDate(file.modified)}</div>
            `;
            
            // Add context menu
            fileElement.addEventListener('contextmenu', (e) => {
                this.showContextMenu(e, file);
            });
            
            // Add double-click handler
            fileElement.addEventListener('dblclick', () => {
                if (file.isDirectory) {
                    this.navigateToDirectory(file.path);
                } else {
                    this.openFile(file);
                }
            });
            
            this.contentView.appendChild(fileElement);
        });
    }

    private getFileIcon(file: WindowsFileInfo): string {
        if (file.isDirectory) {
            return '📁';
        }
        
        const extension = file.name.split('.').pop()?.toLowerCase();
        const iconMap: { [key: string]: string } = {
            'txt': '📄',
            'doc': '📄',
            'docx': '📄',
            'pdf': '📄',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'mp3': '🎵',
            'mp4': '🎬',
            'zip': '📦',
            'exe': '⚙️'
        };
        
        return iconMap[extension || ''] || '📄';
    }

    private formatFileSize(size: number): string {
        if (size === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let fileSize = size;
        
        while (fileSize >= 1024 && unitIndex < units.length - 1) {
            fileSize /= 1024;
            unitIndex++;
        }
        
        return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString();
    }

    private updateTreeSelection(path: string): void {
        const treeItems = this.treeView?.querySelectorAll('.tree-item');
        treeItems?.forEach(item => {
            item.classList.remove('selected');
            if (item.textContent === path) {
                item.classList.add('selected');
            }
        });
    }

    private showContextMenu(event: MouseEvent, file: WindowsFileInfo): void {
        event.preventDefault();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-item" data-action="copy">Copy</div>
            <div class="context-item" data-action="cut">Cut</div>
            <div class="context-item" data-action="paste">Paste</div>
            <div class="context-item" data-action="delete">Delete</div>
            <div class="context-item" data-action="rename">Rename</div>
            <div class="context-item" data-action="properties">Properties</div>
        `;
        
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        
        document.body.appendChild(contextMenu);
        
        // Handle context menu actions
        contextMenu.addEventListener('click', (e) => {
            const action = (e.target as HTMLElement).dataset.action;
            this.handleContextAction(action, file);
            contextMenu.remove();
        });
        
        // Remove context menu when clicking elsewhere
        document.addEventListener('click', () => {
            contextMenu.remove();
        }, { once: true });
    }

    private handleContextAction(action: string | undefined, file: WindowsFileInfo): void {
        switch (action) {
            case 'copy':
                this.copyFile(file);
                break;
            case 'cut':
                this.cutFile(file);
                break;
            case 'paste':
                this.pasteFile();
                break;
            case 'delete':
                this.deleteFile(file);
                break;
            case 'rename':
                this.renameFile(file);
                break;
            case 'properties':
                this.showFileProperties(file);
                break;
        }
    }

    private async copyFile(file: WindowsFileInfo): Promise<void> {
        try {
            // This would implement copy functionality
            console.log('Copying file:', file.name);
        } catch (error) {
            console.error('Failed to copy file:', error);
        }
    }

    private async cutFile(file: WindowsFileInfo): Promise<void> {
        try {
            // This would implement cut functionality
            console.log('Cutting file:', file.name);
        } catch (error) {
            console.error('Failed to cut file:', error);
        }
    }

    private async pasteFile(): Promise<void> {
        try {
            // This would implement paste functionality
            console.log('Pasting file');
        } catch (error) {
            console.error('Failed to paste file:', error);
        }
    }

    private async deleteFile(file: WindowsFileInfo): Promise<void> {
        try {
            if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                await invoke('delete_windows_file', { path: file.path });
                await this.refreshCurrentDirectory();
            }
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    }

    private async renameFile(file: WindowsFileInfo): Promise<void> {
        const newName = prompt('Enter new name:', file.name);
        if (newName && newName !== file.name) {
            try {
                await invoke('rename_windows_file', { 
                    oldPath: file.path, 
                    newPath: file.path.replace(file.name, newName) 
                });
                await this.refreshCurrentDirectory();
            } catch (error) {
                console.error('Failed to rename file:', error);
            }
        }
    }

    private showFileProperties(file: WindowsFileInfo): void {
        // This would show file properties dialog
        console.log('Showing properties for:', file.name);
    }

    private async openFile(file: WindowsFileInfo): Promise<void> {
        try {
            await invoke('open_windows_file', { path: file.path });
        } catch (error) {
            console.error('Failed to open file:', error);
        }
    }

    private async refreshCurrentDirectory(): Promise<void> {
        await this.loadDirectoryContents(this.currentPath);
    }

    getCurrentPath(): string {
        return this.currentPath;
    }

    getFileList(): WindowsFileInfo[] {
        return this.fileList;
    }
}

// Global Windows files manager
export const windowsFilesManager = new WindowsFilesManager();

export async function initializeWindowsFiles(): Promise<void> {
    await windowsFilesManager.initializeWindowsFiles();
}

export function getWindowsFilesManager(): WindowsFilesManager {
    return windowsFilesManager;
}
