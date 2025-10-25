import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import { createFivePaneLayout } from './Components/Layout/FivePaneLayout';
import { initializeSSHConnection } from './Service/ssh_state';
import { initializeTransferQueue } from './Service/transfer_queue';
import { initializeDragDrop } from './Components/Transfer/DragDropHandler';
import { initializeConnectionPanel } from './Components/Connection/ConnectionPanel';
import { initializeStatusBar } from './Components/StatusBar/StatusBar';
import { initializeWindowsFiles } from './Components/Windows/WindowsFiles';
import { initializeLinuxFiles } from './Components/Linux/LinuxFiles';
import Storage from './Service/storage';
import { listenUpdateTheme } from './Service/window';
import { Resizer } from './Components/Layout/resizer';
import { MAIN_BOX_ELEMENT } from './Util/constants';

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Circle9 - Windows-Linux File Bridge starting...');
    
    // Read user preferences
    const preference = await Storage.get('preference');
    const sshConfig = await Storage.get('ssh_config');
    
    // Initialize window manager
    windowManager();
    
    // Create five-pane layout with terminal log
    createFivePaneLayout();
    
    // Initialize SSH connection if auto_connect is enabled
    if (preference?.auto_connect !== false && sshConfig) {
        try {
            await initializeSSHConnection(sshConfig);
            console.log('SSH connection established');
        } catch (error) {
            console.error('Failed to establish SSH connection:', error);
        }
    }
    
    // Initialize transfer queue
    initializeTransferQueue();
    
    // Initialize drag and drop
    initializeDragDrop();

    // Initialize persistent connection panel
    initializeConnectionPanel();

    // Initialize status bar
    initializeStatusBar();

    // Initialize Windows file browsing
    initializeWindowsFiles();

    // Initialize Linux file browsing
    initializeLinuxFiles();

    // Update theme
    if (preference?.custom_style_sheet) {
        updateTheme('root', preference.custom_style_sheet);
    } else {
        updateTheme('root');
    }

    // Initialize sidebar resizer
    new Resizer();
    
    // Listen to update theme event
    listenUpdateTheme(async () => {
        await Storage.get('theme', true);
        await Storage.get('extensions', true);
        updateTheme('*');
    });
    
    console.log('Circle9 initialization complete');
});
