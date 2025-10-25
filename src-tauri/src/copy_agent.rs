use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::io::{Read, Write};
use crate::error::{Circle9Error, Result};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use tokio::sync::mpsc;
use tauri::{AppHandle, State};
use crate::utils::lock_or_error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferTask {
    pub id: String,
    pub source_path: String,
    pub dest_path: String,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferDirection {
    WindowsToLinux,
    LinuxToWindows,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub task_id: String,
    pub filename: String,
    pub direction: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub speed_bytes_per_sec: u64,
    pub estimated_remaining_secs: u64,
}

pub struct CopyAgent {
    active_transfers: Arc<Mutex<HashMap<String, TransferTask>>>,
    max_concurrent_transfers: usize,
    sender: mpsc::UnboundedSender<String>,
    receiver: mpsc::UnboundedReceiver<String>,
    app_handle: Arc<AppHandle>,
}

impl CopyAgent {
    pub fn new(app_handle: Arc<AppHandle>) -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();
        Self {
            active_transfers: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent_transfers: 3,
            sender,
            receiver,
            app_handle,
        }
    }

    /// Create a new transfer task
    pub fn create_transfer_task(
        &self,
        source_path: String,
        dest_path: String,
        direction: TransferDirection,
    ) -> Result<String> {
        let task_id = Uuid::new_v4().to_string();
        tracing::info!("Creating transfer task {}: {} -> {}", task_id, source_path, dest_path);
        let total_bytes = self.get_file_size(&source_path)?;

        let task = TransferTask {
            id: task_id.clone(),
            source_path,
            dest_path,
            direction,
            status: TransferStatus::Pending,
            total_bytes,
            transferred_bytes: 0,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
        };

        {
            let mut transfers = self.active_transfers.lock()
                .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
            transfers.insert(task_id.clone(), task);
        }

        // Send to queue
        if let Err(_) = self.sender.send(task_id.clone()) {
            return Err(anyhow::anyhow!("Failed to queue transfer task"));
        }

        Ok(task_id)
    }

    /// Start processing the transfer queue
    pub async fn process_queue(&self) -> Result<()> {
        loop {
            // Wait for a new task
            let task_id = self.receiver.recv().await
                .ok_or_else(|| anyhow::anyhow!("Channel closed"))?;

            let current_transfers = {
                let transfers = self.active_transfers.lock()
                    .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
                transfers.values()
                    .filter(|t| matches!(t.status, TransferStatus::InProgress))
                    .count()
            };

            if current_transfers < self.max_concurrent_transfers {
                self.start_transfer(task_id).await?;
            }
        }
    }


    /// Start a transfer task
    async fn start_transfer(&self, task_id: String) -> Result<()> {
        let mut task = {
            let mut transfers = self.active_transfers.lock()
                .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
            transfers.get_mut(&task_id).cloned()
        };

        if let Some(mut task) = task {
            task.status = TransferStatus::InProgress;
            task.started_at = Some(Utc::now());

            {
                let mut transfers = self.active_transfers.lock()
                    .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
                transfers.insert(task_id.clone(), task.clone());
            }

            // Execute the transfer based on direction
            let result = match task.direction {
                TransferDirection::WindowsToLinux => {
                    self.transfer_windows_to_linux(&task).await
                }
                TransferDirection::LinuxToWindows => {
                    self.transfer_linux_to_windows(&task).await
                }
            };

            // Update task status
            {
                let mut transfers = self.active_transfers.lock()
                    .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
                if let Some(task) = transfers.get_mut(&task_id) {
                    match result {
                        Ok(_) => {
                            task.status = TransferStatus::Completed;
                            task.completed_at = Some(Utc::now());
                        }
                        Err(e) => {
                            task.status = TransferStatus::Failed;
                            task.error = Some(e.to_string());
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Transfer file from Windows to Linux
    async fn transfer_windows_to_linux(&self, task: &TransferTask) -> Result<()> {
        let source_file = std::fs::File::open(&task.source_path)?;
        let mut reader = std::io::BufReader::new(source_file);
        
        // Create destination directory if it doesn't exist
        if let Some(parent) = Path::new(&task.dest_path).parent() {
            std::fs::create_dir_all(parent)?;
        }

        let dest_file = std::fs::File::create(&task.dest_path)?;
        let mut writer = std::io::BufWriter::new(dest_file);

        let chunk_size = 8192;
        let mut buffer = vec![0u8; chunk_size];
        let mut transferred = 0u64;
        let start_time = std::time::Instant::now();

        loop {
            let bytes_read = reader.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }

            writer.write_all(&buffer[..bytes_read])?;
            transferred += bytes_read as u64;

            // Calculate progress
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (transferred as f64 / elapsed) as u64
            } else {
                0
            };
            let remaining_bytes = task.total_bytes.saturating_sub(transferred);
            let estimated_remaining = if speed > 0 {
                remaining_bytes / speed
            } else {
                0
            };

            // Update task progress
            {
                let mut transfers = self.active_transfers.lock()
                    .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
                if let Some(task) = transfers.get_mut(&task.id) {
                    task.transferred_bytes = transferred;
                }
            }

            // Emit progress event (this would be handled by the Tauri app)
            let progress = TransferProgress {
                task_id: task.id.clone(),
                filename: Path::new(&task.source_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                direction: "upload".to_string(),
                bytes_transferred: transferred,
                total_bytes: task.total_bytes,
                percentage: (transferred as f64 / task.total_bytes as f64) * 100.0,
                speed_bytes_per_sec: speed,
                estimated_remaining_secs: estimated_remaining,
            };

            // Emit the progress event to the frontend
            if let Err(e) = self.app_handle.emit_all("transfer_progress", &progress) {
                eprintln!("Failed to emit transfer progress: {}", e);
            }
        }

        writer.flush()?;
        Ok(())
    }

    /// Transfer file from Linux to Windows
    async fn transfer_linux_to_windows(&self, task: &TransferTask) -> Result<()> {
        // This would use the SSH client to download the file
        // For now, this is a placeholder implementation
        Err(anyhow::anyhow!("Linux to Windows transfer not implemented yet"))
    }

    /// Get file size
    fn get_file_size(&self, path: &str) -> Result<u64> {
        let metadata = std::fs::metadata(path)?;
        Ok(metadata.len())
    }

    /// Get transfer progress
    pub fn get_transfer_progress(&self, task_id: &str) -> Option<TransferProgress> {
        let transfers = lock_or_error(&self.active_transfers).ok()?;
        if let Some(task) = transfers.get(task_id) {
            let percentage = if task.total_bytes > 0 {
                (task.transferred_bytes as f64 / task.total_bytes as f64) * 100.0
            } else {
                0.0
            };

            Some(TransferProgress {
                task_id: task.id.clone(),
                filename: Path::new(&task.source_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                direction: match task.direction {
                    TransferDirection::WindowsToLinux => "upload".to_string(),
                    TransferDirection::LinuxToWindows => "download".to_string(),
                },
                bytes_transferred: task.transferred_bytes,
                total_bytes: task.total_bytes,
                percentage,
                speed_bytes_per_sec: 0, // Would need to calculate this
                estimated_remaining_secs: 0, // Would need to calculate this
            })
        } else {
            None
        }
    }

    /// Get all active transfers
    pub fn get_active_transfers(&self) -> Vec<TransferTask> {
        let transfers = lock_or_error(&self.active_transfers).unwrap_or_else(|_| return Vec::new());
        transfers.values().cloned().collect()
    }

    /// Cancel a transfer
    pub fn cancel_transfer(&self, task_id: &str) -> Result<()> {
        let mut transfers = lock_or_error(&self.active_transfers)?;
        if let Some(task) = transfers.get_mut(task_id) {
            task.status = TransferStatus::Cancelled;
        }
        Ok(())
    }

    /// Retry a failed transfer
    pub fn retry_transfer(&self, task_id: &str) -> Result<()> {
        let mut transfers = lock_or_error(&self.active_transfers)?;
        if let Some(task) = transfers.get_mut(task_id) {
            task.status = TransferStatus::Pending;
            task.error = None;
            task.transferred_bytes = 0;
        }

        // Send task to queue via channel
        if let Err(e) = self.sender.send(task_id.to_string()) {
            tracing::error!("Failed to send task to queue: {}", e);
        } else {
            tracing::debug!("Task {} queued for processing", task_id);
        }

        Ok(())
    }
}

// Global copy agent instance removed - using Tauri managed state instead

// Tauri commands for copy operations

#[tauri::command]
pub async fn create_transfer_task(
    copy_agent: State<'_, CopyAgent>,
    source_path: String,
    dest_path: String,
    direction: String,
) -> Result<String, String> {
    let direction = match direction.as_str() {
        "windows_to_linux" => crate::copy_agent::TransferDirection::WindowsToLinux,
        "linux_to_windows" => crate::copy_agent::TransferDirection::LinuxToWindows,
        _ => return Err("Invalid direction".to_string()),
    };

    copy_agent.create_transfer_task(source_path, dest_path, direction)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transfer_progress(
    copy_agent: State<'_, CopyAgent>,
    task_id: String
) -> Result<Option<TransferProgress>, String> {
    Ok(copy_agent.get_transfer_progress(&task_id))
}

#[tauri::command]
pub async fn get_active_transfers(
    copy_agent: State<'_, CopyAgent>
) -> Result<Vec<TransferTask>, String> {
    Ok(copy_agent.get_active_transfers())
}

#[tauri::command]
pub async fn cancel_transfer(
    copy_agent: State<'_, CopyAgent>,
    task_id: String
) -> Result<(), String> {
    copy_agent.cancel_transfer(&task_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retry_transfer(
    copy_agent: State<'_, CopyAgent>,
    task_id: String
) -> Result<(), String> {
    copy_agent.retry_transfer(&task_id)
        .map_err(|e| e.to_string())
}
