use ssh2::{Session, Sftp};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::interval;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, State};
use crate::error::{Circle9Error, Result};
use crate::types::ConnectionId;
use crate::utils::with_timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub key_path: Option<String>,
    pub password: Option<String>,
}

pub struct SSHConnection {
    pub session: Arc<Mutex<Session>>,
    pub sftp: Arc<Mutex<Sftp>>,
    pub last_activity: Arc<Mutex<Instant>>,
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

    pub async fn connect(&self, config: SSHConfig) -> Result<ConnectionId> {
        let connection_id = ConnectionId::new(&config.username, &config.host, config.port);
        tracing::info!("Attempting SSH connection to {}@{}:{}", config.username, config.host, config.port);
        
        // Check if connection already exists
        {
            let connections = self.connections.lock()
                .map_err(|_| Circle9Error::MutexPoisoned)?;
            if connections.contains_key(connection_id.as_str()) {
                return Ok(connection_id);
            }
        }

        // Create new connection with timeout
        let tcp = with_timeout(
            Duration::from_secs(30),
            async {
                TcpStream::connect(format!("{}:{}", config.host, config.port))
                    .map_err(|e| Circle9Error::SSHError(format!("Failed to connect to SSH server: {}", e)))
            }
        ).await?;
        
        let mut session = Session::new()
            .map_err(|e| Circle9Error::SSHError(format!("Failed to create SSH session: {}", e)))?;
        
        session.set_tcp_stream(tcp);
        with_timeout(
            Duration::from_secs(30),
            async {
                session.handshake()
                    .map_err(|e| Circle9Error::SSHError(format!("SSH handshake failed: {}", e)))
            }
        ).await?;

        // Authentication with timeout
        with_timeout(
            Duration::from_secs(30),
            async {
                if let Some(key_path) = &config.key_path {
                    let key_path = Path::new(key_path);
                    session.userauth_pubkey_file(&config.username, None, key_path, None)
                        .map_err(|e| Circle9Error::SSHError(format!("SSH key authentication failed: {}", e)))?;
                } else if let Some(password) = &config.password {
                    session.userauth_password(&config.username, password)
                        .map_err(|e| Circle9Error::SSHError(format!("SSH password authentication failed: {}", e)))?;
                } else {
                    return Err(Circle9Error::SSHError("No authentication method provided".to_string()));
                }
                Ok(())
            }
        ).await?;

        if !session.authenticated() {
            return Err(Circle9Error::SSHError("SSH authentication failed".to_string()));
        }

        // Create SFTP subsystem with timeout
        let sftp = with_timeout(
            Duration::from_secs(10),
            async {
                session.sftp()
                    .map_err(|e| Circle9Error::SSHError(format!("Failed to create SFTP subsystem: {}", e)))
            }
        ).await?;

        let connection = SSHConnection {
            session: Arc::new(Mutex::new(session)),
            sftp: Arc::new(Mutex::new(sftp)),
            last_activity: Arc::new(Mutex::new(Instant::now())),
            config: config.clone(),
        };

        // Store connection
        {
            let mut connections = self.connections.lock()
                .map_err(|_| Circle9Error::MutexPoisoned)?;
            connections.insert(connection_id.as_str().to_string(), connection);
        }

        // Emit connected event
        if let Err(e) = self.app_handle.emit_all("ssh-connected", connection_id.as_str()) {
            tracing::error!("Failed to emit ssh-connected: {}", e);
        } else {
            tracing::info!("SSH connection established: {}", connection_id.as_str());
        }

        // Start keepalive for this connection
        self.start_keepalive(connection_id.clone()).await;

        Ok(connection_id)
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<SSHConnection> {
        let mut connections = self.connections.lock()
            .map_err(|_| Circle9Error::MutexPoisoned)
            .ok()?;
        if let Some(conn) = connections.get_mut(connection_id) {
            *conn.last_activity.lock().unwrap() = Instant::now();
            Some(SSHConnection {
                session: conn.session.clone(),
                sftp: conn.sftp.clone(),
                last_activity: conn.last_activity.clone(),
                config: conn.config.clone(),
            })
        } else {
            None
        }
    }

    pub fn disconnect(&self, connection_id: &str) {
        let mut connections = self.connections.lock()
            .map_err(|_| Circle9Error::MutexPoisoned)
            .unwrap_or_else(|_| return);
        connections.remove(connection_id);

        // Emit disconnect event
        if let Err(e) = self.app_handle.emit_all("ssh-disconnected", connection_id) {
            eprintln!("Failed to emit ssh-disconnected: {}", e);
        }
    }

    async fn start_keepalive(&self, connection_id: ConnectionId) {
        let connections = Arc::clone(&self.connections);
        let keepalive_interval = self.keepalive_interval;
        let connection_id_str = connection_id.as_str().to_string();
        
        tokio::spawn(async move {
            let mut interval = interval(keepalive_interval);
            loop {
                interval.tick().await;
                
                let should_disconnect = {
                    let connections = connections.lock()
                        .map_err(|_| Circle9Error::MutexPoisoned)
                        .unwrap_or_else(|_| return);
                    if let Some(conn) = connections.get(&connection_id_str) {
                        // Check if connection is stale (no activity for 5 minutes)
                        conn.last_activity.lock().unwrap().elapsed() > Duration::from_secs(300)
                    } else {
                        true // Connection was removed
                    }
                };

                if should_disconnect {
                    connections.lock()
                        .map_err(|_| Circle9Error::MutexPoisoned)
                        .unwrap_or_else(|_| return)
                        .remove(&connection_id_str);
                    break;
                }

                // Send keepalive
                if let Some(conn) = connections.lock()
                    .map_err(|_| Circle9Error::MutexPoisoned)
                    .unwrap_or_else(|_| return)
                    .get_mut(&connection_id_str) {
                    // SSH keepalive is handled automatically by the ssh2 library
                    *conn.last_activity.lock().unwrap() = Instant::now();
                }
            }
        });
    }

    pub fn is_connected(&self, connection_id: &str) -> bool {
        let connections = self.connections.lock()
            .map_err(|_| Circle9Error::MutexPoisoned)
            .unwrap_or_else(|_| return false);
        connections.contains_key(connection_id)
    }

    pub fn list_connections(&self) -> Vec<String> {
        let connections = self.connections.lock()
            .map_err(|_| Circle9Error::MutexPoisoned)
            .unwrap_or_else(|_| return Vec::new());
        connections.keys().cloned().collect()
    }
}

// Remove Default implementation since SSHClient requires AppHandle
// Remove global static - will use Tauri managed state instead
