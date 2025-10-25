import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export function createFourPaneLayout(): void {
    const mainBox = document.getElementById('main-box') || createMainBox();
    
    // Create the four-pane grid layout
    const fourPaneContainer = document.createElement('div');
    fourPaneContainer.id = 'four-pane-container';
    fourPaneContainer.className = 'four-pane-container';
    
    // Top row - Windows panes
    const windowsRow = document.createElement('div');
    windowsRow.className = 'pane-row windows-row';
    
    const windowsTreePane = createPane('windows-tree-pane', 'Windows Directory Tree', 'tree');
    const windowsContentPane = createPane('windows-content-pane', 'Windows Files', 'content');
    
    windowsRow.appendChild(windowsTreePane);
    windowsRow.appendChild(windowsContentPane);
    
    // Bottom row - Linux panes
    const linuxRow = document.createElement('div');
    linuxRow.className = 'pane-row linux-row';
    
    const linuxTreePane = createPane('linux-tree-pane', 'Linux Directory Tree', 'tree');
    const linuxContentPane = createPane('linux-content-pane', 'Linux Files', 'content');
    
    linuxRow.appendChild(linuxTreePane);
    linuxRow.appendChild(linuxContentPane);
    
    // Add rows to container
    fourPaneContainer.appendChild(windowsRow);
    fourPaneContainer.appendChild(linuxRow);
    
    // Add container to main box
    mainBox.appendChild(fourPaneContainer);
    
    // Initialize pane resizers
    initializePaneResizers();
    
    // Listen for transfer progress events
    listen('transfer_progress', (event) => {
        handleTransferProgress(event.payload as any);
    });
}

function createMainBox(): HTMLElement {
    const mainBox = document.createElement('div');
    mainBox.id = 'main-box';
    mainBox.className = 'main-box';
    document.body.appendChild(mainBox);
    return mainBox;
}

function createPane(id: string, title: string, type: 'tree' | 'content'): HTMLElement {
    const pane = document.createElement('div');
    pane.id = id;
    pane.className = `pane ${type}-pane`;
    
    // Create pane header
    const header = document.createElement('div');
    header.className = 'pane-header';
    header.textContent = title;
    pane.appendChild(header);
    
    // Create pane content
    const content = document.createElement('div');
    content.className = 'pane-content';
    
    if (type === 'tree') {
        content.innerHTML = '<div class="tree-view">Loading...</div>';
    } else {
        content.innerHTML = '<div class="file-list">Loading...</div>';
    }
    
    pane.appendChild(content);
    
    return pane;
}

function initializePaneResizers(): void {
    // Add resizer handles between panes
    const container = document.getElementById('four-pane-container');
    if (!container) return;
    
    // Vertical resizer between Windows and Linux rows
    const verticalResizer = document.createElement('div');
    verticalResizer.className = 'resizer vertical-resizer';
    verticalResizer.style.height = '4px';
    verticalResizer.style.cursor = 'ns-resize';
    verticalResizer.style.backgroundColor = '#ccc';
    verticalResizer.style.zIndex = '1000';
    
    // Insert between rows
    const windowsRow = container.querySelector('.windows-row');
    const linuxRow = container.querySelector('.linux-row');
    
    if (windowsRow && linuxRow) {
        windowsRow.parentNode?.insertBefore(verticalResizer, linuxRow);
    }
    
    // Horizontal resizers between left and right panes
    const addHorizontalResizer = (row: Element) => {
        const panes = row.querySelectorAll('.pane');
        if (panes.length >= 2) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer horizontal-resizer';
            resizer.style.width = '4px';
            resizer.style.cursor = 'ew-resize';
            resizer.style.backgroundColor = '#ccc';
            resizer.style.zIndex = '1000';
            
            panes[0].parentNode?.insertBefore(resizer, panes[1]);
        }
    };
    
    addHorizontalResizer(document.querySelector('.windows-row')!);
    addHorizontalResizer(document.querySelector('.linux-row')!);
    
    // Add resize functionality
    initializeResizeHandlers();
}

function initializeResizeHandlers(): void {
    const resizers = document.querySelectorAll('.resizer');
    
    resizers.forEach(resizer => {
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = (e as MouseEvent).clientX;
            startY = (e as MouseEvent).clientY;
            
            const container = document.getElementById('four-pane-container');
            if (container) {
                startWidth = container.offsetWidth;
                startHeight = container.offsetHeight;
            }
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        });
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            if (resizer.classList.contains('vertical-resizer')) {
                // Resize vertical panes
                const windowsRow = document.querySelector('.windows-row') as HTMLElement;
                const linuxRow = document.querySelector('.linux-row') as HTMLElement;
                
                if (windowsRow && linuxRow) {
                    const currentWindowsHeight = windowsRow.offsetHeight;
                    const currentLinuxHeight = linuxRow.offsetHeight;
                    const totalHeight = currentWindowsHeight + currentLinuxHeight;
                    
                    const newWindowsHeight = Math.max(100, currentWindowsHeight + deltaY);
                    const newLinuxHeight = Math.max(100, currentLinuxHeight - deltaY);
                    
                    windowsRow.style.height = `${newWindowsHeight}px`;
                    linuxRow.style.height = `${newLinuxHeight}px`;
                }
            } else if (resizer.classList.contains('horizontal-resizer')) {
                // Resize horizontal panes
                const parentRow = resizer.parentElement;
                if (parentRow) {
                    const panes = parentRow.querySelectorAll('.pane');
                    if (panes.length >= 2) {
                        const leftPane = panes[0] as HTMLElement;
                        const rightPane = panes[1] as HTMLElement;
                        
                        const currentLeftWidth = leftPane.offsetWidth;
                        const currentRightWidth = rightPane.offsetWidth;
                        
                        const newLeftWidth = Math.max(100, currentLeftWidth + deltaX);
                        const newRightWidth = Math.max(100, currentRightWidth - deltaX);
                        
                        leftPane.style.width = `${newLeftWidth}px`;
                        rightPane.style.width = `${newRightWidth}px`;
                    }
                }
            }
        };
        
        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    });
}

function handleTransferProgress(progress: any): void {
    console.log('Transfer progress:', progress);
    
    // Update progress in UI
    const progressBars = document.querySelectorAll('.transfer-progress');
    progressBars.forEach(bar => {
        if (bar instanceof HTMLElement) {
            const percentage = (progress.bytes_transferred / progress.total_bytes) * 100;
            bar.style.width = `${percentage}%`;
        }
    });
    
    // Update status bar
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = `Transferring ${progress.filename}: ${Math.round(percentage)}%`;
    }
}

// Export for use in other modules
export { createFourPaneLayout };