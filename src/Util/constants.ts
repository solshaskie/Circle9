export const MAIN_BOX_ELEMENT = (): HTMLElement => {
    return document.getElementById('main-box') || document.body;
};

export const FOUR_PANE_CONTAINER = (): HTMLElement | null => {
    return document.getElementById('four-pane-container');
};

export const WINDOWS_TREE_PANE = (): HTMLElement | null => {
    return document.getElementById('windows-tree-pane');
};

export const WINDOWS_CONTENT_PANE = (): HTMLElement | null => {
    return document.getElementById('windows-content-pane');
};

export const LINUX_TREE_PANE = (): HTMLElement | null => {
    return document.getElementById('linux-tree-pane');
};

export const LINUX_CONTENT_PANE = (): HTMLElement | null => {
    return document.getElementById('linux-content-pane');
};

export const STATUS_BAR = (): HTMLElement | null => {
    return document.getElementById('status-bar');
};

// Transfer progress constants
export const TRANSFER_CHUNK_SIZE = 8192;
export const MAX_CONCURRENT_TRANSFERS = 3;

// SSH connection constants
export const SSH_KEEPALIVE_INTERVAL = 60000; // 60 seconds
export const SSH_CONNECTION_TIMEOUT = 300000; // 5 minutes

// File operation constants
export const SUPPORTED_FILE_TYPES = [
    '.txt', '.md', '.json', '.xml', '.csv', '.log',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
    '.mp3', '.mp4', '.avi', '.mov', '.wav',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
];

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
export const MIN_FREE_SPACE = 100 * 1024 * 1024; // 100MB

// UI constants
export const PANE_MIN_WIDTH = 200;
export const PANE_MIN_HEIGHT = 150;
export const RESIZER_WIDTH = 4;

// Theme constants
export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';
export const THEME_CUSTOM = 'custom';

// Default paths
export const DEFAULT_WINDOWS_PATH = 'C:\\Users\\';
export const DEFAULT_LINUX_PATH = '/home/';

// Error messages
export const ERROR_MESSAGES = {
    SSH_CONNECTION_FAILED: 'Failed to connect to SSH server',
    SSH_AUTHENTICATION_FAILED: 'SSH authentication failed',
    FILE_NOT_FOUND: 'File not found',
    PERMISSION_DENIED: 'Permission denied',
    INSUFFICIENT_SPACE: 'Insufficient disk space',
    TRANSFER_FAILED: 'File transfer failed',
    CASE_CONFLICT: 'Case sensitivity conflict detected',
    NETWORK_ERROR: 'Network error occurred',
    UNKNOWN_ERROR: 'An unknown error occurred'
};

// Success messages
export const SUCCESS_MESSAGES = {
    SSH_CONNECTED: 'SSH connection established',
    FILE_COPIED: 'File copied successfully',
    FILE_MOVED: 'File moved successfully',
    FILE_DELETED: 'File deleted successfully',
    PERMISSIONS_UPDATED: 'Permissions updated successfully',
    TRANSFER_COMPLETED: 'Transfer completed successfully'
};
