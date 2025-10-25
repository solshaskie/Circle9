use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseConflict {
    pub original_name: String,
    pub conflict_name: String,
    pub resolution: CaseResolution,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CaseResolution {
    AutoRename(String),
    UserPrompt,
    Skip,
    Overwrite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseConflictLog {
    pub conflicts: Vec<CaseConflict>,
    pub total_conflicts: usize,
    pub auto_resolved: usize,
    pub user_prompts: usize,
}

pub struct CaseAgent {
    conflict_log: CaseConflictLog,
    case_mapping: HashMap<String, String>, // Maps original names to resolved names
}

impl CaseAgent {
    pub fn new() -> Self {
        Self {
            conflict_log: CaseConflictLog {
                conflicts: Vec::new(),
                total_conflicts: 0,
                auto_resolved: 0,
                user_prompts: 0,
            },
            case_mapping: HashMap::new(),
        }
    }

    /// Check for case conflicts when copying from Windows to Linux
    pub fn check_windows_to_linux_conflict(
        &mut self,
        windows_path: &Path,
        linux_path: &Path,
    ) -> Result<Option<CaseConflict>> {
        let windows_name = windows_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        let linux_name = linux_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        // Check if names differ only in case
        if windows_name.to_lowercase() == linux_name.to_lowercase() && windows_name != linux_name {
            let conflict = CaseConflict {
                original_name: windows_name.to_string(),
                conflict_name: linux_name.to_string(),
                resolution: CaseResolution::AutoRename(self.generate_unique_name(linux_path)?),
                timestamp: Utc::now(),
            };

            self.log_conflict(&conflict);
            return Ok(Some(conflict));
        }

        Ok(None)
    }

    /// Check for case conflicts when copying from Linux to Windows
    pub fn check_linux_to_windows_conflict(
        &mut self,
        linux_path: &Path,
        windows_path: &Path,
    ) -> Result<Option<CaseConflict>> {
        let linux_name = linux_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        let windows_name = windows_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        // Windows is case-insensitive, so we need to check if a file with the same name exists
        if std::path::Path::new(windows_path).exists() {
            let conflict = CaseConflict {
                original_name: linux_name.to_string(),
                conflict_name: windows_name.to_string(),
                resolution: CaseResolution::UserPrompt,
                timestamp: Utc::now(),
            };

            self.log_conflict(&conflict);
            return Ok(Some(conflict));
        }

        Ok(None)
    }

    /// Generate a unique name to avoid conflicts
    fn generate_unique_name(&self, path: &Path) -> Result<String> {
        let parent = path.parent().unwrap_or(Path::new("."));
        let stem = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();

        let mut counter = 1;
        loop {
            let new_name = format!("{}_{}{}", stem, counter, extension);
            let new_path = parent.join(&new_name);
            
            if !new_path.exists() {
                return Ok(new_name);
            }
            
            counter += 1;
            if counter > 1000 { // Prevent infinite loop
                return Err(anyhow::anyhow!("Could not generate unique name after 1000 attempts"));
            }
        }
    }

    /// Log a case conflict
    fn log_conflict(&mut self, conflict: &CaseConflict) {
        self.conflict_log.conflicts.push(conflict.clone());
        self.conflict_log.total_conflicts += 1;
        
        match conflict.resolution {
            CaseResolution::AutoRename(_) => {
                self.conflict_log.auto_resolved += 1;
            }
            CaseResolution::UserPrompt => {
                self.conflict_log.user_prompts += 1;
            }
            _ => {}
        }
    }

    /// Get the resolved name for a file (if it was renamed due to case conflicts)
    pub fn get_resolved_name(&self, original_name: &str) -> Option<&String> {
        self.case_mapping.get(original_name)
    }

    /// Record a name resolution
    pub fn record_resolution(&mut self, original_name: String, resolved_name: String) {
        self.case_mapping.insert(original_name, resolved_name);
    }

    /// Get the conflict log
    pub fn get_conflict_log(&self) -> &CaseConflictLog {
        &self.conflict_log
    }

    /// Clear the conflict log
    pub fn clear_conflict_log(&mut self) {
        self.conflict_log = CaseConflictLog {
            conflicts: Vec::new(),
            total_conflicts: 0,
            auto_resolved: 0,
            user_prompts: 0,
        };
    }

    /// Check if a filename is case-sensitive (Linux) vs case-insensitive (Windows)
    pub fn is_case_sensitive_system() -> bool {
        #[cfg(target_os = "windows")]
        { false }
        #[cfg(not(target_os = "windows"))]
        { true }
    }

    /// Normalize filename for case-insensitive comparison
    pub fn normalize_filename(filename: &str) -> String {
        filename.to_lowercase()
    }

    /// Check if two filenames are the same when case is ignored
    pub fn filenames_equal_ignore_case(name1: &str, name2: &str) -> bool {
        name1.to_lowercase() == name2.to_lowercase()
    }
}

// Global case agent instance
lazy_static::lazy_static! {
    pub static ref CASE_AGENT: std::sync::Mutex<CaseAgent> = std::sync::Mutex::new(CaseAgent::new());
}

// Tauri commands for case conflict handling

#[tauri::command]
pub async fn check_case_conflict(
    source_path: String,
    dest_path: String,
    direction: String, // "windows_to_linux" or "linux_to_windows"
) -> Result<Option<CaseConflict>, String> {
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    let mut agent = CASE_AGENT.lock().unwrap();
    
    match direction.as_str() {
        "windows_to_linux" => {
            agent.check_windows_to_linux_conflict(source, dest)
                .map_err(|e| e.to_string())
        }
        "linux_to_windows" => {
            agent.check_linux_to_windows_conflict(source, dest)
                .map_err(|e| e.to_string())
        }
        _ => Err("Invalid direction. Use 'windows_to_linux' or 'linux_to_windows'".to_string()),
    }
}

#[tauri::command]
pub async fn resolve_case_conflict(
    original_name: String,
    resolved_name: String,
) -> Result<(), String> {
    let mut agent = CASE_AGENT.lock().unwrap();
    agent.record_resolution(original_name, resolved_name);
    Ok(())
}

#[tauri::command]
pub async fn get_case_conflict_log() -> Result<CaseConflictLog, String> {
    let agent = CASE_AGENT.lock().unwrap();
    Ok(agent.get_conflict_log().clone())
}

#[tauri::command]
pub async fn clear_case_conflict_log() -> Result<(), String> {
    let mut agent = CASE_AGENT.lock().unwrap();
    agent.clear_conflict_log();
    Ok(())
}

#[tauri::command]
pub async fn is_system_case_sensitive() -> Result<bool, String> {
    Ok(CaseAgent::is_case_sensitive_system())
}

#[tauri::command]
pub async fn normalize_filename(filename: String) -> Result<String, String> {
    Ok(CaseAgent::normalize_filename(&filename))
}

#[tauri::command]
pub async fn filenames_equal_ignore_case(name1: String, name2: String) -> Result<bool, String> {
    Ok(CaseAgent::filenames_equal_ignore_case(&name1, &name2))
}
