use std::sync::{Mutex, MutexGuard};
use std::time::Duration;
use crate::error::{Circle9Error, Result};

/// Common mutex locking pattern with proper error handling
pub fn lock_or_error<T>(mutex: &Mutex<T>) -> Result<MutexGuard<T>> {
    mutex.lock().map_err(|_| Circle9Error::MutexPoisoned)
}

/// Calculate transfer progress
pub fn calculate_progress(transferred: u64, total: u64, elapsed: Duration) -> (f64, u64) {
    let percentage = if total > 0 {
        (transferred as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    
    let speed = if elapsed.as_secs_f64() > 0.0 {
        (transferred as f64 / elapsed.as_secs_f64()) as u64
    } else {
        0
    };
    
    (percentage, speed)
}

/// Validate file path to prevent path traversal attacks
pub fn validate_path(path: &str) -> Result<std::path::PathBuf> {
    let path = std::path::PathBuf::from(path);
    
    // Prevent path traversal
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(Circle9Error::InvalidPath("Path traversal detected".to_string()));
    }
    
    // Normalize path
    let canonical = path.canonicalize()
        .map_err(|e| Circle9Error::InvalidPath(format!("Invalid path: {}", e)))?;
    Ok(canonical)
}

/// Add timeout wrapper for async operations
pub async fn with_timeout<F, T>(duration: Duration, future: F) -> Result<T>
where
    F: std::future::Future<Output = Result<T>>,
{
    tokio::time::timeout(duration, future)
        .await
        .map_err(|_| Circle9Error::Timeout)?
}
