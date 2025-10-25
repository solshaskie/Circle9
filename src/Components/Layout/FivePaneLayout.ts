import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export interface PaneConfig {
  id: string;
  type: 'tree' | 'content' | 'terminal';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-full';
  visible: boolean;
}

const DEFAULT_PANE_CONFIG: PaneConfig[] = [
  { id: 'windows-tree-pane', type: 'tree', position: 'top-left', visible: true },
  { id: 'windows-content-pane', type: 'content', position: 'top-right', visible: true },
  { id: 'linux-tree-pane', type: 'tree', position: 'bottom-left', visible: true },
  { id: 'linux-content-pane', type: 'content', position: 'bottom-right', visible: true },
  { id: 'terminal-log-pane', type: 'terminal', position: 'bottom-full', visible: true }
];

export function createFivePaneLayout(): void {
    const mainBox = document.getElementById('main-box') || createMainBox();

    // Create container for the 5-pane layout
    const fivePaneContainer = document.createElement('div');
    fivePaneContainer.id = 'five-pane-container';
    fivePaneContainer.className = 'five-pane-container';

    // Top row - Windows panes
    const windowsRow = document.createElement('div');
    windowsRow.className = 'pane-row windows-row';

    const windowsTreePane = createPane('windows-tree-pane', 'Windows Directory Tree', 'tree');
    const windowsContentPane = createPane('windows-content-pane', 'Windows Files', 'content');

    windowsRow.appendChild(windowsTreePane);
    windowsRow.appendChild(windowsContentPane);

    // Middle row - Linux panes
    const linuxRow = document.createElement('div');
    linuxRow.className = 'pane-row linux-row';

    const linuxTreePane = createPane('linux-tree-pane', 'Linux Directory Tree', 'tree');
    const linuxContentPane = createPane('linux-content-pane', 'Linux Files', 'content');

    linuxRow.appendChild(linuxTreePane);
    linuxRow.appendChild(linuxContentPane);

    // Bottom row - Terminal log (full width)
    const terminalRow = document.createElement('div');
    terminalRow.className = 'pane-row terminal-row';

    const terminalLogPane = createPane('terminal-log-pane', 'Command Log', 'terminal');

    terminalRow.appendChild(terminalLogPane);

    // Add all rows to container
    fivePaneContainer.appendChild(windowsRow);
    fivePaneContainer.appendChild(linuxRow);
    fivePaneContainer.appendChild(terminalRow);

    // Add container to main box
    mainBox.appendChild(fivePaneContainer);

    // Initialize terminal log functionality
    initializeTerminalLog();

    // Initialize resizers (reuse existing logic but adapted for 5 panes)
    initializePaneResizers();

    // Listen for transfer progress events with CLI logging
    listen('transfer_progress', (event: any) => {
        handleTransferProgress(event.payload);
        logCliCommandForTransfer(event.payload);
    });
}

function createMainBox(): HTMLElement {
    const mainBox = document.createElement('div');
    mainBox.id = 'main-box';
    mainBox.className = 'main-box';
    document.body.appendChild(mainBox);
    return mainBox;
}

function createPane(id: string, title: string, type: 'tree' | 'content' | 'terminal'): HTMLElement {
    const pane = document.createElement('div');
    pane.id = id;
    pane.className = `pane ${type}-pane`;
    pane.setAttribute('data-pane-type', type);

    // Create pane header
    const header = document.createElement('div');
    header.className = 'pane-header';
    header.textContent = title;
    pane.appendChild(header);

    // Create pane content
    const content = document.createElement('div');
    content.className = 'pane-content';

    if (type === 'terminal') {
        content.innerHTML = `
            <div class="terminal-view">
                <div class="terminal-header">
                    <span class="terminal-title">Circle9 Command Log</span>
                    <div class="terminal-controls">
                        <button id="clear-terminal" class="terminal-btn" title="Clear log">🗑️</button>
                        <button id="toggle-terminal" class="terminal-btn" title="Collapse/Expand">−</button>
                    </div>
                </div>
                <div class="terminal-output" id="terminal-output">
                    <div class="terminal-line welcome">
                        <span class="terminal-prompt">circle9$</span>
                        <span class="terminal-text">Welcome to Circle9 terminal log! GUI actions will show their CLI equivalents here.</span>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'tree') {
        content.innerHTML = '<div class="tree-view">Loading...</div>';
    } else {
        content.innerHTML = '<div class="file-list">Loading...</div>';
    }

    pane.appendChild(content);

    return pane;
}

function initializeTerminalLog(): void {
    // Set up terminal log event listeners
    const clearBtn = document.getElementById('clear-terminal');
    const toggleBtn = document.getElementById('toggle-terminal');

    clearBtn?.addEventListener('click', () => {
        const output = document.getElementById('terminal-output');
        if (output) {
            // Keep only the welcome message
            output.innerHTML = `
                <div class="terminal-line welcome">
                    <span class="terminal-prompt">circle9$</span>
                    <span class="terminal-text">Log cleared.</span>
                </div>
            `;
        }
    });

    // Toggle terminal visibility
    let terminalCollapsed = false;
    toggleBtn?.addEventListener('click', () => {
        const terminalRow = document.querySelector('.terminal-row') as HTMLElement;
        const terminalPane = document.getElementById('terminal-log-pane') as HTMLElement;

        if (terminalCollapsed) {
            if (terminalRow) terminalRow.style.display = 'block';
            if (terminalPane) terminalPane.style.height = '200px'; // Default height
            toggleBtn.textContent = '−';
            toggleBtn.title = 'Collapse';
        } else {
            if (terminalRow) terminalRow.style.display = 'none';
            toggleBtn.textContent = '+';
            toggleBtn.title = 'Expand';
        }
        terminalCollapsed = !terminalCollapsed;
    });

    // Auto-scroll to bottom when new content is added
    const output = document.getElementById('terminal-output');
    if (output) {
        const resizeObserver = new ResizeObserver(() => {
            output.scrollTop = output.scrollHeight;
        });
        resizeObserver.observe(output);
    }
}

function initializePaneResizers(): void {
    // Add resizers between pane rows (adapted from existing FourPaneLayout logic)
    const container = document.getElementById('five-pane-container');
    if (!container) return;

    // Vertical resizer between Windows and Linux rows
    const verticalResizer1 = createResizer('vertical-resizer');
    const windowsRow = container.querySelector('.windows-row');
    const linuxRow = container.querySelector('.linux-row');

    if (windowsRow && linuxRow) {
        windowsRow.parentNode?.insertBefore(verticalResizer1, linuxRow);
    }

    // Vertical resizer between Linux and Terminal rows
    const verticalResizer2 = createResizer('vertical-resizer');
    const terminalRow = container.querySelector('.terminal-row');

    if (linuxRow && terminalRow) {
        linuxRow.parentNode?.insertBefore(verticalResizer2, terminalRow);
    }

    // Horizontal resizers within rows
    setupHorizontalResizers('.windows-row');
    setupHorizontalResizers('.linux-row');

    // Add resize functionality
    initializeResizeHandlers();
}

function createResizer(className: string): HTMLElement {
    const resizer = document.createElement('div');
    resizer.className = `resizer ${className}`;
    resizer.style.cursor = className === 'vertical-resizer' ? 'ns-resize' : 'ew-resize';
    resizer.style.backgroundColor = '#ccc';
    resizer.style.zIndex = '1000';

    if (className === 'vertical-resizer') {
        resizer.style.height = '4px';
        resizer.style.width = '100%';
        resizer.style.cursor = 'ns-resize';
    } else {
        resizer.style.width = '4px';
        resizer.style.height = '100%';
        resizer.style.cursor = 'ew-resize';
    }

    return resizer;
}

function setupHorizontalResizers(rowSelector: string): void {
    const row = document.querySelector(rowSelector);
    if (!row) return;

    const panes = row.querySelectorAll('.pane');
    if (panes.length >= 2) {
        const resizer = createResizer('horizontal-resizer');
        panes[0].parentNode?.insertBefore(resizer, panes[1]);
    }
}

function initializeResizeHandlers(): void {
    const resizers = document.querySelectorAll('.resizer');

    resizers.forEach(resizer => {
        let isResizing = false;
        let startX = 0;
        let startY = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            const event = e as MouseEvent;
            startX = event.clientX;
            startY = event.clientY;

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            e.preventDefault();
        });

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            if (resizer.classList.contains('vertical-resizer')) {
                resizeVertical(resizer, deltaY);
            } else if (resizer.classList.contains('horizontal-resizer')) {
                resizeHorizontal(resizer, deltaX);
            }
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    });
}

function resizeVertical(resizer: Element, deltaY: number): void {
    const prevPane = resizer.previousElementSibling as HTMLElement;
    const nextPane = resizer.nextElementSibling as HTMLElement;

    if (prevPane && nextPane) {
        const prevHeight = prevPane.offsetHeight;
        const nextHeight = nextPane.offsetHeight;

        if (prevHeight + deltaY > 100 && nextHeight - deltaY > 100) {
            prevPane.style.height = `${prevHeight + deltaY}px`;
            nextPane.style.height = `${nextHeight - deltaY}px`;
        }
    }
}

function resizeHorizontal(resizer: Element, deltaX: number): void {
    const prevPane = resizer.previousElementSibling as HTMLElement;
    const nextPane = resizer.nextElementSibling as HTMLElement;

    if (prevPane && nextPane) {
        const prevWidth = prevPane.offsetWidth;
        const nextWidth = nextPane.offsetWidth;

        if (prevWidth + deltaX > 100 && nextWidth - deltaX > 100) {
            prevPane.style.width = `${prevWidth + deltaX}px`;
            nextPane.style.width = `${nextWidth - deltaX}px`;
        }
    }
}

function handleTransferProgress(progress: any): void {
    console.log('Transfer progress:', progress);
    // Update UI progress bars as before (existing functionality)
}

function logCliCommandForTransfer(progress: any): void {
    // Generate CLI command representation of the transfer
    const command = generateCliCommand(progress);
    if (command) {
        addToTerminalLog(command, 'info');
    }
}

function generateCliCommand(progress: any): string | null {
    if (!progress) return null;

    // Generate CLI equivalent based on the transfer operation
    // This will be enhanced when we integrate with the log agent
    const direction = progress.direction || 'windows_to_linux';

    if (direction === 'windows_to_linux') {
        return `scp -p "${progress.filename}" user@server:~/${progress.filename}`;
    } else if (direction === 'linux_to_windows') {
        return `scp -p user@server:~/${progress.filename} "C:/Users/User/${progress.filename}"`;
    }

    return null;
}

function addToTerminalLog(command: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;

    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    prompt.textContent = 'circle9$';

    const text = document.createElement('span');
    text.className = 'terminal-text';
    text.textContent = ` ${command}`;

    line.appendChild(prompt);
    line.appendChild(text);
    output.appendChild(line);

    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;
}

// Global function to add custom log entries for future integration
export function addCliCommand(command: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    addToTerminalLog(command, type);
}
