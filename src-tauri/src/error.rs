use thiserror::Error;

#[derive(Error, Debug)]
pub enum Circle9Error {
    #[error("SSH connection failed: {0}")]
    SSHError(String),
    
    #[error("File transfer failed: {0}")]
    TransferError(String),
    
    #[error("Mutex poisoned")]
    MutexPoisoned,
    
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    
    #[error("Operation timeout")]
    Timeout,
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("SSH2 error: {0}")]
    Ssh2Error(#[from] ssh2::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Anyhow error: {0}")]
    AnyhowError(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, Circle9Error>;
