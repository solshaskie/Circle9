#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod ssh_client;
mod linux_files;
mod permission_agent;
mod case_agent;
mod copy_agent;
mod audit_log;
mod error;
mod types;
mod utils;
mod secure_storage;

use clap::{Arg, ArgMatches, Command as ClapCommand};
use std::env;
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;

#[cfg(not(target_os = "linux"))]
use window_shadows::set_shadow;
#[cfg(not(target_os = "linux"))]
use window_vibrancy::{
    apply_acrylic, apply_blur, clear_acrylic, clear_blur
};

lazy_static::lazy_static! {
    pub static ref ARGS_STRUCT: ArgMatches = {
        const VERSION: &str = env!("CARGO_PKG_VERSION");
        ClapCommand::new("Circle9")
            .version(VERSION)
            .about("Circle9 - Windows-Linux File Bridge")
            .arg(
                Arg::new("reveal")
                    .short('r')
                    .long("reveal")
                    .help("Reveal file in Circle9")
                    .takes_value(false),
            )
            .arg(
                Arg::new("directory")
                    .short('d')
                    .long("directory")
                    .help("Open directory in Circle9")
                    .takes_value(true),
            )
            .get_matches()
    };
}

fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main")
                .ok_or_else(|| "Main window not found".to_string())?;

            #[cfg(not(target_os = "linux"))]
            {
                if let Err(e) = set_shadow(&window, true) {
                    eprintln!("Failed to set window shadow: {}", e);
                }
            }

            // Initialize managed state
            app.manage(ssh_client::SSHClient::new(app.handle()));
            app.manage(copy_agent::CopyAgent::new(app.handle()));
            app.manage(case_agent::CaseAgent::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // SSH connection commands
            linux_files::connect_ssh,
            linux_files::disconnect_ssh,
            linux_files::is_ssh_connected,
            linux_files::list_ssh_connections,
            
            // Linux file operations
            linux_files::list_linux_dir,
            linux_files::copy_to_linux,
            linux_files::copy_from_linux,
            linux_files::delete_linux_file,
            linux_files::get_linux_permissions,
            linux_files::set_linux_permissions,
            
            // Permission mapping commands
            permission_agent::map_windows_to_linux_attrs,
            permission_agent::map_linux_to_windows_attrs,
            permission_agent::get_windows_file_attrs,
            permission_agent::set_windows_file_attrs,
            permission_agent::preserve_file_timestamps,
            
            // Case conflict handling
            case_agent::check_case_conflict,
            case_agent::resolve_case_conflict,
            case_agent::get_case_conflict_log,
            case_agent::clear_case_conflict_log,
            case_agent::is_system_case_sensitive,
            case_agent::normalize_filename,
            case_agent::filenames_equal_ignore_case,
            
            // Copy operations
            copy_agent::create_transfer_task,
            copy_agent::get_transfer_progress,
            copy_agent::get_active_transfers,
            copy_agent::cancel_transfer,
            copy_agent::retry_transfer,
            
            // Audit logging
            audit_log::log_file_operation,
            audit_log::get_audit_entries,
            audit_log::get_audit_statistics,
            audit_log::clear_audit_log,
            audit_log::export_audit_log,
            audit_log::get_session_id,
            audit_log::get_current_user,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
