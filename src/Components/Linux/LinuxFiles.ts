import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { sshStateManager } from '../../Service/ssh_state';

export interface LinuxFileInfo {
    name: string;
    path: string;
    size: number;
    isDirectory: boolean;
    permissions: string;
    owner: string;
    group: string;
    modified: Date;
    accessed: Date;
}

class LinuxFilesManager {
    private currentPath: string = '/home/user';
    private fileList: LinuxFileInfo[] = [];
    private treeView: HTMLElement | null = null;
    private contentView: HTMLElement | null = null;
    private connectionId: string | null = null;

    constructor() {
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // Listen for SSH connection events
        document.addEventListener('ssh-connected', (e) => {
            const event = e as CustomEvent;
            this.connectionId = event.detail.connectionId;
            this.initializeLinuxFiles();
        });

        document.addEventListener('ssh-disconnected', () => {
            this.connectionId = null;
            this.clearLinuxFiles();
        });

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

    async initializeLinuxFiles(): Promise<void> {
        if (!this.connectionId) {
            console.warn('No SSH connection available');
            return;
        }

        // Initialize tree view
        this.treeView = document.getElementById('linux-tree-pane')?.querySelector('.tree-view');
        this.contentView = document.getElementById('linux-content-pane')?.querySelector('.file-list');

        if (this.treeView) {
            await this.buildDirectoryTree();
        }

        if (this.contentView) {
            await this.loadDirectoryContents(this.currentPath);
        }
    }

    private async buildDirectoryTree(): Promise<void> {
        if (!this.treeView || !this.connectionId) return;

        try {
            const directories = await this.getDirectories('/');
            this.renderDirectoryTree(directories, this.treeView);
        } catch (error) {
            console.error('Failed to build directory tree:', error);
            this.treeView.innerHTML = '<div class="error">Failed to load directories</div>';
        }
    }

    private async getDirectories(path: string): Promise<string[]> {
        if (!this.connectionId) return [];

        try {
            const result = await invoke<string[]>('list_linux_directories', { 
                connectionId: this.connectionId,
                path 
            });
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
        if (!this.contentView || !this.connectionId) return;

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

    private async getDirectoryContents(path: string): Promise<LinuxFileInfo[]> {
        if (!this.connectionId) return [];

        try {
            const result = await invoke<LinuxFileInfo[]>('list_linux_dir', { 
                connectionId: this.connectionId,
                path 
            });
            return result;
        } catch (error) {
            console.error('Failed to get directory contents:', error);
            return [];
        }
    }

    private renderFileList(files: LinuxFileInfo[]): void {
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
                <div class="file-permissions">${file.permissions}</div>
                <div class="file-owner">${file.owner}:${file.group}</div>
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

    private getFileIcon(file: LinuxFileInfo): string {
        if (file.isDirectory) {
            return '📁';
        }
        
        const extension = file.name.split('.').pop()?.toLowerCase();
        const iconMap: { [key: string]: string } = {
            'txt': '📄',
            'md': '📄',
            'json': '📄',
            'xml': '📄',
            'py': '🐍',
            'js': '📜',
            'ts': '📜',
            'html': '🌐',
            'css': '🎨',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'mp3': '🎵',
            'mp4': '🎬',
            'zip': '📦',
            'tar': '📦',
            'gz': '📦'
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

    private showContextMenu(event: MouseEvent, file: LinuxFileInfo): void {
        event.preventDefault();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-item" data-action="copy">Copy</div>
            <div class="context-item" data-action="cut">Cut</div>
            <div class="context-item" data-action="paste">Paste</div>
            <div class="context-item" data-action="delete">Delete</div>
            <div class="context-item" data-action="rename">Rename</div>
            <div class="context-item" data-action="permissions">Permissions</div>
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

    private handleContextAction(action: string | undefined, file: LinuxFileInfo): void {
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
            case 'permissions':
                this.editPermissions(file);
                break;
            case 'properties':
                this.showFileProperties(file);
                break;
        }
    }

    private async copyFile(file: LinuxFileInfo): Promise<void> {
        try {
            // This would implement copy functionality
            console.log('Copying file:', file.name);
        } catch (error) {
            console.error('Failed to copy file:', error);
        }
    }

    private async cutFile(file: LinuxFileInfo): Promise<void> {
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

    private async deleteFile(file: LinuxFileInfo): Promise<void> {
        if (!this.connectionId) return;

        try {
            if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                await invoke('delete_linux_file', { 
                    connectionId: this.connectionId,
                    path: file.path 
                });
                await this.refreshCurrentDirectory();
            }
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    }

    private async renameFile(file: LinuxFileInfo): Promise<void> {
        const newName = prompt('Enter new name:', file.name);
        if (newName && newName !== file.name) {
            try {
                // This would implement rename functionality
                console.log('Renaming file:', file.name, 'to', newName);
                await this.refreshCurrentDirectory();
            } catch (error) {
                console.error('Failed to rename file:', error);
            }
        }
    }

    private async editPermissions(file: LinuxFileInfo): Promise<void> {
        if (!this.connectionId) return;

        const newPermissions = prompt('Enter new permissions (e.g., 755):', file.permissions);
        if (newPermissions && newPermissions !== file.permissions) {
            try {
                const octalPermissions = parseInt(newPermissions, 8);
                await invoke('set_linux_permissions', {
                    connectionId: this.connectionId,
                    path: file.path,
                    permissions: octalPermissions
                });
                await this.refreshCurrentDirectory();
            } catch (error) {
                console.error('Failed to set permissions:', error);
            }
        }
    }

    private showFileProperties(file: LinuxFileInfo): void {
        // This would show file properties dialog
        console.log('Showing properties for:', file.name);
    }

    private async openFile(file: LinuxFileInfo): Promise<void> {
        try {
            // This would implement file opening
            console.log('Opening file:', file.name);
        } catch (error) {
            console.error('Failed to open file:', error);
        }
    }

    private async refreshCurrentDirectory(): Promise<void> {
        await this.loadDirectoryContents(this.currentPath);
    }

    private clearLinuxFiles(): void {
        if (this.treeView) {
            this.treeView.innerHTML = '<div class="error">No SSH connection</div>';
        }
        if (this.contentView) {
            this.contentView.innerHTML = '<div class="error">No SSH connection</div>';
        }
    }

    getCurrentPath(): string {
        return this.currentPath;
    }

    getFileList(): LinuxFileInfo[] {
        return this.fileList;
    }
}

// Global Linux files manager
export const linuxFilesManager = new LinuxFilesManager();

export async function initializeLinuxFiles(): Promise<void> {
    await linuxFilesManager.initializeLinuxFiles();
}

export function getLinuxFilesManager(): LinuxFilesManager {
    return linuxFilesManager;
}
