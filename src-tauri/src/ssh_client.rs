use ssh2::{Session, Sftp};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::interval;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use once_cell::sync::OnceCell;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub key_path: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SSHConnection {
    pub session: Session,
    pub sftp: Sftp,
    pub last_activity: Instant,
    pub config: SSHConfig,
}

pub struct SSHClient {
    connections: Arc<Mutex<HashMap<String, SSHConnection>>>,
    keepalive_interval: Duration,
    app_handle: Arc<AppHandle>,
}

impl SSHClient {
    pub fn new(app_handle: Arc<AppHandle>) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            keepalive_interval: Duration::from_secs(60),
            app_handle,
        }
    }

    pub async fn connect(&self, config: SSHConfig) -> Result<String> {
        let connection_id = format!("{}@{}:{}", config.username, config.host, config.port);
        
        // Check if connection already exists
        {
            let connections = self.connections.lock()
                .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
            if connections.contains_key(&connection_id) {
                return Ok(connection_id);
            }
        }

        // Create new connection
        let tcp = TcpStream::connect(format!("{}:{}", config.host, config.port))
            .context("Failed to connect to SSH server")?;
        
        let mut session = Session::new()
            .context("Failed to create SSH session")?;
        
        session.set_tcp_stream(tcp);
        session.handshake()
            .context("SSH handshake failed")?;

        // Authentication
        if let Some(key_path) = &config.key_path {
            let key_path = Path::new(key_path);
            session.userauth_pubkey_file(&config.username, None, key_path, None)
                .context("SSH key authentication failed")?;
        } else if let Some(password) = &config.password {
            session.userauth_password(&config.username, password)
                .context("SSH password authentication failed")?;
        } else {
            return Err(anyhow::anyhow!("No authentication method provided"));
        }

        if !session.authenticated() {
            return Err(anyhow::anyhow!("SSH authentication failed"));
        }

        // Create SFTP subsystem
        let sftp = session.sftp()
            .context("Failed to create SFTP subsystem")?;

        let connection = SSHConnection {
            session,
            sftp,
            last_activity: Instant::now(),
            config: config.clone(),
        };

        // Store connection
        {
            let mut connections = self.connections.lock()
                .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
            connections.insert(connection_id.clone(), connection);
        }

        // Emit connected event
        if let Err(e) = self.app_handle.emit_all("ssh-connected", &connection_id) {
            eprintln!("Failed to emit ssh-connected: {}", e);
        }

        // Start keepalive for this connection
        self.start_keepalive(connection_id.clone()).await;

        Ok(connection_id)
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<SSHConnection> {
        let mut connections = self.connections.lock()
            .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))
            .unwrap();
        if let Some(conn) = connections.get_mut(connection_id) {
            conn.last_activity = Instant::now();
            Some(conn.clone())
        } else {
            None
        }
    }

    pub fn disconnect(&self, connection_id: &str) {
        let mut connections = self.connections.lock()
            .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))
            .unwrap();
        connections.remove(connection_id);

        // Emit disconnect event
        if let Err(e) = self.app_handle.emit_all("ssh-disconnected", connection_id) {
            eprintln!("Failed to emit ssh-disconnected: {}", e);
        }
    }

    async fn start_keepalive(&self, connection_id: String) {
        let connections = Arc::clone(&self.connections);
        let keepalive_interval = self.keepalive_interval;
        
        tokio::spawn(async move {
            let mut interval = interval(keepalive_interval);
            loop {
                interval.tick().await;
                
                let should_disconnect = {
                    let mut connections = connections.lock()
                        .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?;
                    if let Some(conn) = connections.get(&connection_id) {
                        // Check if connection is stale (no activity for 5 minutes)
                        conn.last_activity.elapsed() > Duration::from_secs(300)
                    } else {
                        true // Connection was removed
                    }
                };

                if should_disconnect {
                    connections.lock()
                        .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?
                        .remove(&connection_id);
                    break;
                }

                // Send keepalive
                if let Some(conn) = connections.lock()
                    .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))?
                    .get_mut(&connection_id) {
                    // SSH keepalive is handled automatically by the ssh2 library
                    conn.last_activity = Instant::now();
                }
            }
        });
    }

    pub fn is_connected(&self, connection_id: &str) -> bool {
        let connections = self.connections.lock()
            .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))
            .unwrap();
        connections.contains_key(connection_id)
    }

    pub fn list_connections(&self) -> Vec<String> {
        let connections = self.connections.lock()
            .map_err(|e| anyhow::anyhow!("Mutex poisoned: {}", e))
            .unwrap();
        connections.keys().cloned().collect()
    }
}

impl Default for SSHClient {
    fn default() -> Self {
        Self::new()
    }
}

// Global SSH client instance
static SSH_CLIENT: OnceCell<SSHClient> = OnceCell::new();
