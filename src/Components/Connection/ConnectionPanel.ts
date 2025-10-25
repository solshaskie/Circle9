import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { sshStateManager } from '../../Service/ssh_state';
import Storage from '../../Service/storage';

export interface LinuxCredentials {
    host: string;
    username: string;
    password: string;
    port?: number; // Default to 22 if not specified
}

export interface ConnectionStatus {
    connected: boolean;
    lastTested?: Date;
    connectionId?: string;
    errorMessage?: string;
}

class ConnectionPanel {
    private panel: HTMLElement | null = null;
    private credentials: LinuxCredentials | null = null;
    private status: ConnectionStatus = { connected: false };
    private isExpanded = true;

    constructor() {
        this.initializePanel();
        this.loadStoredCredentials();
        this.initializeEventListeners();
    }

    private initializePanel(): void {
        const panel = document.createElement('div');
        panel.id = 'connection-panel';
        panel.className = 'connection-panel';

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="connection-icon">🔗</span>
                    Linux Connection
                    <span class="expand-toggle">${this.isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>
            <div class="panel-content" style="display: ${this.isExpanded ? 'block' : 'none'}">
                <div class="credential-fields">
                    <div class="credential-row">
                        <label class="credential-label">IP/Host:</label>
                        <input type="text" id="linux-host" class="credential-input" placeholder="192.168.1.100">
                        <button id="edit-host" class="edit-btn small-btn" title="Edit host">✏️</button>
                    </div>
                    <div class="credential-row">
                        <label class="credential-label">Username:</label>
                        <input type="text" id="linux-username" class="credential-input" placeholder="username">
                        <button id="edit-username" class="edit-btn small-btn" title="Edit username">✏️</button>
                    </div>
                    <div class="credential-row">
                        <label class="credential-label">Password:</label>
                        <input type="password" id="linux-password" class="credential-input" placeholder="••••••••">
                        <button id="toggle-password" class="toggle-btn small-btn" title="Show/Hide password">👁️</button>
                        <button id="edit-password" class="edit-btn small-btn" title="Edit password">✏️</button>
                    </div>
                </div>
                <div class="connection-status">
                    <div class="status-indicator">
                        <span id="connection-status-icon" class="status-icon disconnected">🔴</span>
                        <span id="connection-status-text">Disconnected</span>
                    </div>
                    <div class="connection-controls">
                        <button id="test-connection" class="control-btn">Test</button>
                        <button id="clear-credentials" class="control-btn secondary">Clear</button>
                    </div>
                </div>
                <div id="connection-details" class="connection-details">
                    <span id="connection-info"></span>
                    <span id="last-tested"></span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panel = panel;
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Panel toggle
        const header = this.panel?.querySelector('.panel-title');
        if (header) {
            header.addEventListener('click', () => this.toggleExpanded());
        }

        // Edit buttons
        const editHost = document.getElementById('edit-host');
        const editUsername = document.getElementById('edit-username');
        const editPassword = document.getElementById('edit-password');

        editHost?.addEventListener('click', () => this.enableFieldEdit('linux-host'));
        editUsername?.addEventListener('click', () => this.enableFieldEdit('linux-username'));
        editPassword?.addEventListener('click', () => this.enableFieldEdit('linux-password'));

        // Password toggle
        const togglePassword = document.getElementById('toggle-password');
        togglePassword?.addEventListener('click', () => this.togglePasswordVisibility());

        // Control buttons
        const testBtn = document.getElementById('test-connection');
        const clearBtn = document.getElementById('clear-credentials');

        testBtn?.addEventListener('click', () => this.testConnection());
        clearBtn?.addEventListener('click', () => this.clearCredentials());
    }

    private initializeEventListeners(): void {
        // Listen for SSH connection events
        listen('ssh-connected', (event: any) => {
            this.handleConnectionChange(true, event.payload);
        });

        listen('ssh-disconnected', () => {
            this.handleConnectionChange(false);
        });

        // Listen for credential validation events
        listen('credential-validated', (event: any) => {
            this.handleCredentialValidation(event.payload);
        });
    }

    private async loadStoredCredentials(): Promise<void> {
        try {
            const storedCredentials = await Storage.get('linux_credentials');
            if (storedCredentials && storedCredentials.host && storedCredentials.username && storedCredentials.password) {
                this.credentials = storedCredentials;
                this.populateFields();
                this.updateUIStatus();

                // Auto-connect if valid credentials exist and auto-connect is enabled
                const preferences = await Storage.get('preference');
                if (preferences?.auto_connect !== false) {
                    await this.attemptAutoConnect();
                }
            }
        } catch (error) {
            console.error('Failed to load stored credentials:', error);
        }
    }

    private populateFields(): void {
        if (!this.credentials) return;

        const hostField = document.getElementById('linux-host') as HTMLInputElement;
        const usernameField = document.getElementById('linux-username') as HTMLInputElement;
        const passwordField = document.getElementById('linux-password') as HTMLInputElement;

        if (hostField) hostField.value = this.credentials.host;
        if (usernameField) usernameField.value = this.credentials.username;
        if (passwordField) passwordField.value = this.credentials.password;
    }

    private enableFieldEdit(fieldId: string): void {
        const field = document.getElementById(fieldId) as HTMLInputElement;
        if (!field) return;

        field.focus();
        field.select();

        const handleSave = () => {
            this.saveCredentials();
            field.removeEventListener('blur', handleSave);
            field.removeEventListener('keydown', handleKeydown);
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleSave();
            } else if (e.key === 'Escape') {
                // Restore original value
                if (fieldId === 'linux-host' && this.credentials?.host) field.value = this.credentials.host;
                if (fieldId === 'linux-username' && this.credentials?.username) field.value = this.credentials.username;
                if (fieldId === 'linux-password' && this.credentials?.password) field.value = this.credentials.password;
                field.blur();
            }
        };

        field.addEventListener('blur', handleSave);
        field.addEventListener('keydown', handleKeydown);
    }

    private togglePasswordVisibility(): void {
        const passwordField = document.getElementById('linux-password') as HTMLInputElement;
        const toggleBtn = document.getElementById('toggle-password');

        if (!passwordField || !toggleBtn) return;

        const isVisible = passwordField.type === 'text';
        passwordField.type = isVisible ? 'password' : 'text';
        toggleBtn.textContent = isVisible ? '👁️' : '🙈';
        toggleBtn.title = isVisible ? 'Show password' : 'Hide password';
    }

    private async saveCredentials(): Promise<void> {
        const host = (document.getElementById('linux-host') as HTMLInputElement)?.value?.trim();
        const username = (document.getElementById('linux-username') as HTMLInputElement)?.value?.trim();
        const password = (document.getElementById('linux-password') as HTMLInputElement)?.value;

        if (!host || !username || !password) {
            this.showNotification('All fields are required', 'warning');
            return;
        }

        const newCredentials: LinuxCredentials = { host, username, password };

        try {
            this.credentials = newCredentials;
            await Storage.set('linux_credentials', newCredentials);
            this.updateUIStatus();
            this.showNotification('Credentials saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save credentials:', error);
            this.showNotification('Failed to save credentials', 'error');
        }
    }

    private async testConnection(): Promise<void> {
        if (!this.credentials) {
            this.showNotification('Please enter credentials first', 'warning');
            return;
        }

        this.setTestingState(true);

        try {
            const connectionId = await sshStateManager.connect({
                host: this.credentials.host,
                port: this.credentials.port || 22,
                username: this.credentials.username,
                password: this.credentials.password
            });

            this.status = {
                connected: true,
                lastTested: new Date(),
                connectionId
            };

            // Update the SSH config in storage for compatibility
            await Storage.set('ssh_config', {
                host: this.credentials.host,
                port: this.credentials.port || 22,
                username: this.credentials.username,
                password: this.credentials.password,
                useKeyAuth: false
            });

            this.updateUIStatus();
            this.showNotification('Connection successful!', 'success');

        } catch (error) {
            this.status = {
                connected: false,
                lastTested: new Date(),
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            };
            this.updateUIStatus();
            this.showNotification(`Connection failed: ${this.status.errorMessage}`, 'error');
        } finally {
            this.setTestingState(false);
        }
    }

    private async clearCredentials(): Promise<void> {
        if (!this.credentials) {
            this.showNotification('No credentials to clear', 'info');
            return;
        }

        await Storage.remove('linux_credentials');
        await Storage.remove('ssh_config'); // Clear legacy config too

        this.credentials = null;
        this.status = { connected: false };

        // Clear UI fields
        (document.getElementById('linux-host') as HTMLInputElement).value = '';
        (document.getElementById('linux-username') as HTMLInputElement).value = '';
        (document.getElementById('linux-password') as HTMLInputElement).value = '';

        this.updateUIStatus();
        this.showNotification('Credentials cleared', 'info');
    }

    private setTestingState(isTesting: boolean): void {
        const testBtn = document.getElementById('test-connection') as HTMLButtonElement;
        const statusIcon = document.getElementById('connection-status-icon') as HTMLElement;
        const statusText = document.getElementById('connection-status-text') as HTMLElement;

        if (!testBtn || !statusIcon || !statusText) return;

        if (isTesting) {
            testBtn.setAttribute('disabled', 'true');
            testBtn.textContent = 'Testing...';
            statusIcon.textContent = '🔄';
            statusText.textContent = 'Testing connection...';
        } else {
            testBtn.removeAttribute('disabled');
            testBtn.textContent = 'Test';
        }
    }

    private updateUIStatus(): void {
        const statusIcon = document.getElementById('connection-status-icon') as HTMLElement;
        const statusText = document.getElementById('connection-status-text') as HTMLElement;
        const connectionInfo = document.getElementById('connection-info') as HTMLElement;
        const lastTested = document.getElementById('last-tested') as HTMLElement;

        if (this.status.connected) {
            if (statusIcon) {
                statusIcon.textContent = '🟢';
                statusIcon.className = 'status-icon connected';
            }
            if (statusText) statusText.textContent = 'Connected';
            if (connectionInfo) {
                connectionInfo.textContent = `${this.credentials?.username}@${this.credentials?.host}`;
            }
        } else {
            if (statusIcon) {
                statusIcon.textContent = '🔴';
                statusIcon.className = 'status-icon disconnected';
            }
            if (statusText) statusText.textContent = 'Disconnected';
            if (connectionInfo) connectionInfo.textContent = '';
        }

        if (this.status.lastTested && lastTested) {
            const timeAgo = this.formatTimeAgo(this.status.lastTested);
            lastTested.textContent = `Last tested: ${timeAgo}`;
        }
    }

    private handleConnectionChange(connected: boolean, details?: any): void {
        this.status.connected = connected;
        if (connected && details) {
            this.status.connectionId = details.connectionId;
        } else if (!connected) {
            this.status.connectionId = undefined;
        }
        this.updateUIStatus();
    }

    private handleCredentialValidation(validation: any): void {
        // Handle async credential validation results if needed
        console.log('Credential validation:', validation);
    }

    private async attemptAutoConnect(): Promise<void> {
        if (!this.credentials) return;

        try {
            console.log('Attempting auto-connect...');
            await this.testConnection();
        } catch (error) {
            console.log('Auto-connect failed (will not show error to user):', error);
        }
    }

    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;
        const content = this.panel?.querySelector('.panel-content') as HTMLElement;
        const toggle = this.panel?.querySelector('.expand-toggle') as HTMLElement;

        if (content) {
            content.style.display = this.isExpanded ? 'block' : 'none';
        }
        if (toggle) {
            toggle.textContent = this.isExpanded ? '▼' : '▶';
        }
    }

    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hours ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days ago`;
    }

    private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Add to panel or body
        const target = this.panel || document.body;
        target.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Public API
    public getCredentials(): LinuxCredentials | null {
        return this.credentials;
    }

    public isConnected(): boolean {
        return this.status.connected;
    }

    public async setCredentials(credentials: LinuxCredentials): Promise<void> {
        this.credentials = credentials;
        await Storage.set('linux_credentials', credentials);
        this.populateFields();
        this.updateUIStatus();
    }

    public show(): void {
        this.panel?.style.setProperty('display', 'block');
    }

    public hide(): void {
        this.panel?.style.setProperty('display', 'none');
    }
}

// Global instance
export const connectionPanel = new ConnectionPanel();

export function initializeConnectionPanel(): void {
    console.log('Persistent connection panel initialized');
}

export function getConnectionPanel(): ConnectionPanel {
    return connectionPanel;
}

export default ConnectionPanel;
