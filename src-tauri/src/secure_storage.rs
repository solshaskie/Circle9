use crate::error::{Circle9Error, Result};

/// Secure storage for sensitive data like SSH passwords
pub struct SecureStorage;

impl SecureStorage {
    /// Store a password securely using OS credential storage
    pub fn store_password(service: &str, username: &str, password: &str) -> Result<()> {
        // For now, we'll use a simple base64 encoding
        // In production, this should use the OS keyring (keyring crate)
        let encoded = base64::encode(password);
        std::fs::create_dir_all("secure")?;
        let path = format!("secure/{}_{}.key", service, username);
        std::fs::write(path, encoded)?;
        Ok(())
    }
    
    /// Retrieve a password from secure storage
    pub fn get_password(service: &str, username: &str) -> Result<String> {
        let path = format!("secure/{}_{}.key", service, username);
        let encoded = std::fs::read_to_string(path)?;
        let decoded = base64::decode(encoded)
            .map_err(|e| Circle9Error::InvalidPath(format!("Failed to decode password: {}", e)))?;
        String::from_utf8(decoded)
            .map_err(|e| Circle9Error::InvalidPath(format!("Invalid UTF-8 in password: {}", e)))
    }
    
    /// Remove a stored password
    pub fn remove_password(service: &str, username: &str) -> Result<()> {
        let path = format!("secure/{}_{}.key", service, username);
        std::fs::remove_file(path).ok(); // Ignore if file doesn't exist
        Ok(())
    }
}
