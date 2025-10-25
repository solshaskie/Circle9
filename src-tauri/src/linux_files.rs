use crate::ssh_client::{SSH_CLIENT, SSHConfig};
use ssh2::{FileType, Permissions};
use std::path::Path;
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use std::time::SystemTime;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinuxFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub permissions: String,
    pub owner: String,
    pub group: String,
    pub modified: DateTime<Utc>,
    pub accessed: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub filename: String,
    pub direction: String, // "upload" or "download"
}

// Tauri commands for Linux file operations

#[tauri::command]
pub async fn connect_ssh(
    host: String,
    port: u16,
    username: String,
    key_path: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let config = SSHConfig {
        host,
        port,
        username,
        key_path,
        password,
    };

    match SSH_CLIENT.connect(config).await {
        Ok(connection_id) => Ok(connection_id),
        Err(e) => Err(format!("Failed to connect: {}", e)),
    }
}

#[tauri::command]
pub async fn disconnect_ssh(connection_id: String) -> Result<(), String> {
    SSH_CLIENT.disconnect(&connection_id);
    Ok(())
}

#[tauri::command]
pub async fn list_linux_dir(connection_id: String, path: String) -> Result<Vec<LinuxFileInfo>, String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    let mut files = Vec::new();
    
    match connection.sftp.readdir(Path::new(&path)) {
        Ok(entries) => {
            for (path, stat) in entries {
                let file_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let is_dir = stat.file_type() == FileType::Directory;
                let size = stat.size().unwrap_or(0);
                let permissions = format_permissions(stat.permissions());
                let owner = stat.uid().unwrap_or(0).to_string();
                let group = stat.gid().unwrap_or(0).to_string();
                
                // Convert timestamps
                let modified = stat.mtime().and_then(|mtime| {
                    SystemTime::UNIX_EPOCH.checked_add(Duration::from_secs(mtime as u64))
                }).map(|st| DateTime::<Utc>::from(st))
                .unwrap_or_else(|| Utc::now());

                let accessed = stat.atime().and_then(|atime| {
                    SystemTime::UNIX_EPOCH.checked_add(Duration::from_secs(atime as u64))
                }).map(|st| DateTime::<Utc>::from(st))
                .unwrap_or_else(|| Utc::now());

                files.push(LinuxFileInfo {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    size,
                    is_dir,
                    permissions,
                    owner,
                    group,
                    modified,
                    accessed,
                });
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }

    Ok(files)
}

#[tauri::command]
pub async fn copy_to_linux(
    connection_id: String,
    local_path: String,
    remote_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    // Read local file
    let local_file = std::fs::read(&local_path)
        .map_err(|e| format!("Failed to read local file: {}", e))?;

    // Create remote file
    let mut remote_file = connection.sftp.create(Path::new(&remote_path))
        .map_err(|e| format!("Failed to create remote file: {}", e))?;

    // Write file in chunks for progress tracking
    let chunk_size = 8192;
    let total_size = local_file.len() as u64;
    let mut bytes_written = 0;

    for chunk in local_file.chunks(chunk_size) {
        remote_file.write_all(chunk)
            .map_err(|e| format!("Failed to write to remote file: {}", e))?;
        
        bytes_written += chunk.len() as u64;
        
        // Emit progress event
        let progress = TransferProgress {
            bytes_transferred: bytes_written,
            total_bytes: total_size,
            filename: Path::new(&local_path).file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string(),
            direction: "upload".to_string(),
        };

        app_handle.emit_all("transfer_progress", &progress)
            .unwrap_or_default();
    }

    remote_file.sync_all()
        .map_err(|e| format!("Failed to sync remote file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn copy_from_linux(
    connection_id: String,
    remote_path: String,
    local_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    // Open remote file
    let mut remote_file = connection.sftp.open(Path::new(&remote_path))
        .map_err(|e| format!("Failed to open remote file: {}", e))?;

    // Get file size for progress tracking
    let stat = connection.sftp.stat(Path::new(&remote_path))
        .map_err(|e| format!("Failed to get file stats: {}", e))?;
    let total_size = stat.size().unwrap_or(0);

    // Create local file
    let mut local_file = std::fs::File::create(&local_path)
        .map_err(|e| format!("Failed to create local file: {}", e))?;

    // Read file in chunks
    let chunk_size = 8192;
    let mut buffer = vec![0u8; chunk_size];
    let mut bytes_read = 0;

    loop {
        let bytes = remote_file.read(&mut buffer)
            .map_err(|e| format!("Failed to read from remote file: {}", e))?;
        
        if bytes == 0 {
            break;
        }

        local_file.write_all(&buffer[..bytes])
            .map_err(|e| format!("Failed to write to local file: {}", e))?;
        
        bytes_read += bytes as u64;
        
        // Emit progress event
        let progress = TransferProgress {
            bytes_transferred: bytes_read,
            total_bytes,
            filename: Path::new(&remote_path).file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string(),
            direction: "download".to_string(),
        };

        app_handle.emit_all("transfer_progress", &progress)
            .unwrap_or_default();
    }

    local_file.sync_all()
        .map_err(|e| format!("Failed to sync local file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_linux_file(connection_id: String, path: String) -> Result<(), String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    let path = Path::new(&path);
    
    // Check if it's a directory or file
    let stat = connection.sftp.stat(path)
        .map_err(|e| format!("Failed to get file stats: {}", e))?;

    if stat.file_type() == FileType::Directory {
        connection.sftp.rmdir(path)
            .map_err(|e| format!("Failed to remove directory: {}", e))?;
    } else {
        connection.sftp.unlink(path)
            .map_err(|e| format!("Failed to remove file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_linux_permissions(connection_id: String, path: String) -> Result<String, String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    let stat = connection.sftp.stat(Path::new(&path))
        .map_err(|e| format!("Failed to get file stats: {}", e))?;

    Ok(format_permissions(stat.permissions()))
}

#[tauri::command]
pub async fn set_linux_permissions(
    connection_id: String,
    path: String,
    permissions: u32,
) -> Result<(), String> {
    let connection = SSH_CLIENT.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    connection.sftp.setstat(Path::new(&path), |stat| {
        stat.set_permissions(Permissions::from_bits(permissions).unwrap_or_default());
    }).map_err(|e| format!("Failed to set permissions: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn is_ssh_connected(connection_id: String) -> Result<bool, String> {
    Ok(SSH_CLIENT.is_connected(&connection_id))
}

#[tauri::command]
pub async fn list_ssh_connections() -> Result<Vec<String>, String> {
    Ok(SSH_CLIENT.list_connections())
}

// Helper functions

fn format_permissions(permissions: Permissions) -> String {
    let mode = permissions.bits();
    format!("{:o}", mode)
}

use std::io::{Read, Write};
use std::time::Duration;
