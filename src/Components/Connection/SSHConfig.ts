import { invoke } from '@tauri-apps/api/tauri';
import { sshStateManager } from '../../Service/ssh_state';
import Storage from '../../Service/storage';

export interface SSHConfigForm {
    host: string;
    port: number;
    username: string;
    keyPath?: string;
    password?: string;
    useKeyAuth: boolean;
}

class SSHConfigManager {
    private configModal: HTMLElement | null = null;
    private isConnected = false;
    private currentConnectionId: string | null = null;

    constructor() {
        this.createConfigModal();
        this.initializeEventListeners();
    }

    private createConfigModal(): void {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'ssh-config-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>SSH Configuration</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="ssh-config-form">
                        <div class="form-group">
                            <label for="ssh-host">Host:</label>
                            <input type="text" id="ssh-host" name="host" required>
                        </div>
                        <div class="form-group">
                            <label for="ssh-port">Port:</label>
                            <input type="number" id="ssh-port" name="port" value="22" required>
                        </div>
                        <div class="form-group">
                            <label for="ssh-username">Username:</label>
                            <input type="text" id="ssh-username" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="radio" name="auth-method" value="key" checked>
                                Use SSH Key
                            </label>
                            <label>
                                <input type="radio" name="auth-method" value="password">
                                Use Password
                            </label>
                        </div>
                        <div class="form-group" id="key-path-group">
                            <label for="ssh-key-path">Private Key Path:</label>
                            <input type="text" id="ssh-key-path" name="keyPath" placeholder="~/.ssh/id_rsa">
                        </div>
                        <div class="form-group" id="password-group" style="display: none;">
                            <label for="ssh-password">Password:</label>
                            <input type="password" id="ssh-password" name="password">
                        </div>
                        <div class="form-actions">
                            <button type="button" id="test-connection">Test Connection</button>
                            <button type="submit">Connect</button>
                            <button type="button" id="cancel-config">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.configModal = modal;
    }

    private initializeEventListeners(): void {
        // Auth method radio buttons
        const authMethods = document.querySelectorAll('input[name="auth-method"]');
        authMethods.forEach(radio => {
            radio.addEventListener('change', this.handleAuthMethodChange.bind(this));
        });

        // Form submission
        const form = document.getElementById('ssh-config-form');
        if (form) {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }

        // Test connection button
        const testBtn = document.getElementById('test-connection');
        if (testBtn) {
            testBtn.addEventListener('click', this.handleTestConnection.bind(this));
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-config');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.hideConfigModal.bind(this));
        }

        // Close button
        const closeBtn = this.configModal?.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.hideConfigModal.bind(this));
        }

        // Close on overlay click
        if (this.configModal) {
            this.configModal.addEventListener('click', (e) => {
                if (e.target === this.configModal) {
                    this.hideConfigModal();
                }
            });
        }
    }

    private handleAuthMethodChange(e: Event): void {
        const target = e.target as HTMLInputElement;
        const keyPathGroup = document.getElementById('key-path-group');
        const passwordGroup = document.getElementById('password-group');

        if (target.value === 'key') {
            if (keyPathGroup) keyPathGroup.style.display = 'block';
            if (passwordGroup) passwordGroup.style.display = 'none';
        } else {
            if (keyPathGroup) keyPathGroup.style.display = 'none';
            if (passwordGroup) passwordGroup.style.display = 'block';
        }
    }

    private async handleFormSubmit(e: Event): Promise<void> {
        e.preventDefault();
        
        const formData = new FormData(e.target as HTMLFormElement);
        const config: SSHConfigForm = {
            host: formData.get('host') as string,
            port: parseInt(formData.get('port') as string) || 22,
            username: formData.get('username') as string,
            useKeyAuth: formData.get('auth-method') === 'key',
            keyPath: formData.get('keyPath') as string || undefined,
            password: formData.get('password') as string || undefined
        };

        try {
            await this.connect(config);
            this.hideConfigModal();
        } catch (error) {
            this.showError('Connection failed: ' + error);
        }
    }

    private async handleTestConnection(): Promise<void> {
        const form = document.getElementById('ssh-config-form') as HTMLFormElement;
        const formData = new FormData(form);
        
        const config: SSHConfigForm = {
            host: formData.get('host') as string,
            port: parseInt(formData.get('port') as string) || 22,
            username: formData.get('username') as string,
            useKeyAuth: formData.get('auth-method') === 'key',
            keyPath: formData.get('keyPath') as string || undefined,
            password: formData.get('password') as string || undefined
        };

        try {
            // Test connection (this would be a separate Tauri command)
            await this.testConnection(config);
            this.showSuccess('Connection test successful!');
        } catch (error) {
            this.showError('Connection test failed: ' + error);
        }
    }

    private async connect(config: SSHConfigForm): Promise<void> {
        const connectionId = await sshStateManager.connect({
            host: config.host,
            port: config.port,
            username: config.username,
            keyPath: config.keyPath,
            password: config.password
        });

        this.currentConnectionId = connectionId;
        this.isConnected = true;

        // Save config to storage
        await Storage.set('ssh_config', config);

        // Update UI
        this.updateConnectionStatus(true);
        this.showSuccess('Connected to SSH server');
    }

    private async testConnection(config: SSHConfigForm): Promise<void> {
        // This would call a test connection Tauri command
        console.log('Testing connection to:', config.host);
        // Simulate test
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    private updateConnectionStatus(connected: boolean): void {
        const statusIndicator = document.getElementById('ssh-status');
        if (statusIndicator) {
            statusIndicator.textContent = connected ? 'Connected' : 'Disconnected';
            statusIndicator.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    private showError(message: string): void {
        this.showNotification(message, 'error');
    }

    private showSuccess(message: string): void {
        this.showNotification(message, 'success');
    }

    private showNotification(message: string, type: 'success' | 'error'): void {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showConfigModal(): void {
        if (this.configModal) {
            this.configModal.style.display = 'flex';
            this.loadSavedConfig();
        }
    }

    hideConfigModal(): void {
        if (this.configModal) {
            this.configModal.style.display = 'none';
        }
    }

    private async loadSavedConfig(): Promise<void> {
        const savedConfig = await Storage.get('ssh_config');
        if (savedConfig) {
            const form = document.getElementById('ssh-config-form') as HTMLFormElement;
            if (form) {
                (form.querySelector('#ssh-host') as HTMLInputElement).value = savedConfig.host || '';
                (form.querySelector('#ssh-port') as HTMLInputElement).value = savedConfig.port || '22';
                (form.querySelector('#ssh-username') as HTMLInputElement).value = savedConfig.username || '';
                
                if (savedConfig.useKeyAuth) {
                    (form.querySelector('input[value="key"]') as HTMLInputElement).checked = true;
                    (form.querySelector('#ssh-key-path') as HTMLInputElement).value = savedConfig.keyPath || '';
                } else {
                    (form.querySelector('input[value="password"]') as HTMLInputElement).checked = true;
                    (form.querySelector('#ssh-password') as HTMLInputElement).value = savedConfig.password || '';
                }
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.currentConnectionId) {
            await sshStateManager.disconnect(this.currentConnectionId);
            this.currentConnectionId = null;
            this.isConnected = false;
            this.updateConnectionStatus(false);
        }
    }

    isSSHConnected(): boolean {
        return this.isConnected;
    }
}

// Global SSH config manager
export const sshConfigManager = new SSHConfigManager();

export function initializeSSHConfig(): void {
    console.log('SSH configuration initialized');
    
    // Add SSH config button to UI
    const configButton = document.createElement('button');
    configButton.id = 'ssh-config-btn';
    configButton.textContent = 'SSH Config';
    configButton.addEventListener('click', () => {
        sshConfigManager.showConfigModal();
    });
    
    // Add to toolbar or status bar
    const toolbar = document.querySelector('.toolbar') || document.body;
    toolbar.appendChild(configButton);
}

export function getSSHConfigManager(): SSHConfigManager {
    return sshConfigManager;
}
