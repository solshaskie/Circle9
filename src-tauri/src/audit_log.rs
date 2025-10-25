use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use anyhow::{Result, Context};
use chrono::{DateTime, Utc};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub operation: AuditOperation,
    pub user: String,
    pub source_path: Option<String>,
    pub dest_path: Option<String>,
    pub file_size: Option<u64>,
    pub success: bool,
    pub error_message: Option<String>,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditOperation {
    FileCopy,
    FileMove,
    FileDelete,
    DirectoryCreate,
    DirectoryDelete,
    PermissionChange,
    SSHConnect,
    SSHDisconnect,
    CaseConflictResolved,
    TransferStarted,
    TransferCompleted,
    TransferFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub entries: Vec<AuditEntry>,
    pub total_operations: usize,
    pub successful_operations: usize,
    pub failed_operations: usize,
    pub last_updated: DateTime<Utc>,
}

pub struct AuditLogger {
    log_file: PathBuf,
    session_id: String,
    current_user: String,
    writer: Mutex<BufWriter<std::fs::File>>,
}

impl AuditLogger {
    pub fn new() -> Result<Self> {
        let app_data_dir = Self::get_app_data_dir()?;
        std::fs::create_dir_all(&app_data_dir)?;
        
        let log_file = app_data_dir.join("audit.log");
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)?;
        
        let writer = BufWriter::new(file);
        
        Ok(Self {
            log_file,
            session_id: uuid::Uuid::new_v4().to_string(),
            current_user: whoami::username(),
            writer: Mutex::new(writer),
        })
    }

    /// Get the application data directory
    fn get_app_data_dir() -> Result<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            let app_data = std::env::var("APPDATA")
                .context("APPDATA environment variable not found")?;
            Ok(PathBuf::from(app_data).join("Circle9"))
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            let home = std::env::var("HOME")
                .context("HOME environment variable not found")?;
            Ok(PathBuf::from(home).join(".circle9"))
        }
    }

    /// Log an audit entry
    pub fn log_operation(
        &self,
        operation: AuditOperation,
        source_path: Option<String>,
        dest_path: Option<String>,
        file_size: Option<u64>,
        success: bool,
        error_message: Option<String>,
    ) -> Result<()> {
        let entry = AuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            operation,
            user: self.current_user.clone(),
            source_path,
            dest_path,
            file_size,
            success,
            error_message,
            session_id: self.session_id.clone(),
        };

        self.write_entry(&entry)?;
        Ok(())
    }

    /// Write an audit entry to the log file
    fn write_entry(&self, entry: &AuditEntry) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();
        let json_line = serde_json::to_string(entry)?;
        writeln!(writer, "{}", json_line)?;
        writer.flush()?;
        Ok(())
    }

    /// Read audit entries from the log file
    pub fn read_entries(&self, limit: Option<usize>) -> Result<Vec<AuditEntry>> {
        let content = std::fs::read_to_string(&self.log_file)?;
        let mut entries = Vec::new();
        
        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }
            
            let entry: AuditEntry = serde_json::from_str(line)?;
            entries.push(entry);
            
            if let Some(limit) = limit {
                if entries.len() >= limit {
                    break;
                }
            }
        }
        
        Ok(entries)
    }

    /// Get audit statistics
    pub fn get_statistics(&self) -> Result<AuditLog> {
        let entries = self.read_entries(None)?;
        let total_operations = entries.len();
        let successful_operations = entries.iter().filter(|e| e.success).count();
        let failed_operations = total_operations - successful_operations;
        
        Ok(AuditLog {
            entries,
            total_operations,
            successful_operations,
            failed_operations,
            last_updated: Utc::now(),
        })
    }

    /// Clear the audit log
    pub fn clear_log(&self) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();
        writer.get_mut().set_len(0)?;
        writer.flush()?;
        Ok(())
    }

    /// Export audit log to a file
    pub fn export_log(&self, export_path: &str) -> Result<()> {
        let entries = self.read_entries(None)?;
        let audit_log = AuditLog {
            entries,
            total_operations: 0, // Will be calculated
            successful_operations: 0, // Will be calculated
            failed_operations: 0, // Will be calculated
            last_updated: Utc::now(),
        };
        
        let json = serde_json::to_string_pretty(&audit_log)?;
        std::fs::write(export_path, json)?;
        Ok(())
    }

    /// Get the current session ID
    pub fn get_session_id(&self) -> &str {
        &self.session_id
    }

    /// Get the current user
    pub fn get_current_user(&self) -> &str {
        &self.current_user
    }
}

// Global audit logger instance
lazy_static::lazy_static! {
    pub static ref AUDIT_LOGGER: AuditLogger = AuditLogger::new().unwrap();
}

// Tauri commands for audit logging

#[tauri::command]
pub async fn log_file_operation(
    operation: String,
    source_path: Option<String>,
    dest_path: Option<String>,
    file_size: Option<u64>,
    success: bool,
    error_message: Option<String>,
) -> Result<(), String> {
    let audit_operation = match operation.as_str() {
        "file_copy" => AuditOperation::FileCopy,
        "file_move" => AuditOperation::FileMove,
        "file_delete" => AuditOperation::FileDelete,
        "directory_create" => AuditOperation::DirectoryCreate,
        "directory_delete" => AuditOperation::DirectoryDelete,
        "permission_change" => AuditOperation::PermissionChange,
        "ssh_connect" => AuditOperation::SSHConnect,
        "ssh_disconnect" => AuditOperation::SSHDisconnect,
        "case_conflict_resolved" => AuditOperation::CaseConflictResolved,
        "transfer_started" => AuditOperation::TransferStarted,
        "transfer_completed" => AuditOperation::TransferCompleted,
        "transfer_failed" => AuditOperation::TransferFailed,
        _ => return Err("Invalid operation type".to_string()),
    };

    AUDIT_LOGGER.log_operation(
        audit_operation,
        source_path,
        dest_path,
        file_size,
        success,
        error_message,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_audit_entries(limit: Option<usize>) -> Result<Vec<AuditEntry>, String> {
    AUDIT_LOGGER.read_entries(limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_audit_statistics() -> Result<AuditLog, String> {
    AUDIT_LOGGER.get_statistics()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_audit_log() -> Result<(), String> {
    AUDIT_LOGGER.clear_log()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_audit_log(export_path: String) -> Result<(), String> {
    AUDIT_LOGGER.export_log(&export_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_session_id() -> Result<String, String> {
    Ok(AUDIT_LOGGER.get_session_id().to_string())
}

#[tauri::command]
pub async fn get_current_user() -> Result<String, String> {
    Ok(AUDIT_LOGGER.get_current_user().to_string())
}
