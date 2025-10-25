use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::{Result, Context};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowsFileAttributes {
    pub read_only: bool,
    pub hidden: bool,
    pub system: bool,
    pub archive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinuxPermissions {
    pub owner_read: bool,
    pub owner_write: bool,
    pub owner_execute: bool,
    pub group_read: bool,
    pub group_write: bool,
    pub group_execute: bool,
    pub other_read: bool,
    pub other_write: bool,
    pub other_execute: bool,
}

pub struct PermissionAgent;

impl PermissionAgent {
    /// Map Windows file attributes to Linux permissions
    pub fn windows_to_linux(attrs: &WindowsFileAttributes) -> LinuxPermissions {
        LinuxPermissions {
            owner_read: true,  // Always readable by owner
            owner_write: !attrs.read_only,
            owner_execute: !attrs.read_only, // Executable if not read-only
            group_read: !attrs.hidden, // Readable by group unless hidden
            group_write: !attrs.read_only && !attrs.hidden,
            group_execute: !attrs.read_only && !attrs.hidden,
            other_read: !attrs.hidden && !attrs.system, // Others can read unless hidden/system
            other_write: false, // Others never get write by default
            other_execute: !attrs.hidden && !attrs.system,
        }
    }

    /// Map Linux permissions to Windows file attributes
    pub fn linux_to_windows(perms: &LinuxPermissions) -> WindowsFileAttributes {
        WindowsFileAttributes {
            read_only: !perms.owner_write,
            hidden: !perms.other_read, // Hidden if others can't read
            system: !perms.other_execute, // System if others can't execute
            archive: true, // Always archive on Windows
        }
    }

    /// Convert Linux permissions to octal notation
    pub fn linux_to_octal(perms: &LinuxPermissions) -> u32 {
        let mut octal = 0u32;
        
        if perms.owner_read { octal |= 0o400; }
        if perms.owner_write { octal |= 0o200; }
        if perms.owner_execute { octal |= 0o100; }
        
        if perms.group_read { octal |= 0o040; }
        if perms.group_write { octal |= 0o020; }
        if perms.group_execute { octal |= 0o010; }
        
        if perms.other_read { octal |= 0o004; }
        if perms.other_write { octal |= 0o002; }
        if perms.other_execute { octal |= 0o001; }
        
        octal
    }

    /// Convert octal notation to Linux permissions
    pub fn octal_to_linux(octal: u32) -> LinuxPermissions {
        LinuxPermissions {
            owner_read: (octal & 0o400) != 0,
            owner_write: (octal & 0o200) != 0,
            owner_execute: (octal & 0o100) != 0,
            group_read: (octal & 0o040) != 0,
            group_write: (octal & 0o020) != 0,
            group_execute: (octal & 0o010) != 0,
            other_read: (octal & 0o004) != 0,
            other_write: (octal & 0o002) != 0,
            other_execute: (octal & 0o001) != 0,
        }
    }

    /// Get Windows file attributes from a file path
    pub fn get_windows_attributes(path: &Path) -> Result<WindowsFileAttributes> {
        let metadata = std::fs::metadata(path)
            .context("Failed to get file metadata")?;
        
        let attrs = metadata.permissions();
        
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::fs::MetadataExt;
            let win_attrs = metadata.file_attributes();
            
            Ok(WindowsFileAttributes {
                read_only: (win_attrs & 0x1) != 0,
                hidden: (win_attrs & 0x2) != 0,
                system: (win_attrs & 0x4) != 0,
                archive: (win_attrs & 0x20) != 0,
            })
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows systems, simulate basic attributes
            Ok(WindowsFileAttributes {
                read_only: !attrs.readonly(),
                hidden: path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false),
                system: false,
                archive: true,
            })
        }
    }

    /// Set Windows file attributes on a file path
    pub fn set_windows_attributes(path: &Path, attrs: &WindowsFileAttributes) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::fs::MetadataExt;
            use std::fs::File;
            
            let file = File::open(path)?;
            let metadata = file.metadata()?;
            let mut win_attrs = metadata.file_attributes();
            
            if attrs.read_only { win_attrs |= 0x1; } else { win_attrs &= !0x1; }
            if attrs.hidden { win_attrs |= 0x2; } else { win_attrs &= !0x2; }
            if attrs.system { win_attrs |= 0x4; } else { win_attrs &= !0x4; }
            if attrs.archive { win_attrs |= 0x20; } else { win_attrs &= !0x20; }
            
            // Note: Setting file attributes requires additional Windows API calls
            // This is a simplified version
        }
        
        Ok(())
    }

    /// Preserve timestamps during file transfer
    pub fn preserve_timestamps(
        source_path: &Path,
        dest_path: &Path,
    ) -> Result<()> {
        let source_metadata = std::fs::metadata(source_path)?;
        
        // Get timestamps from source
        let modified = source_metadata.modified()?;
        let accessed = source_metadata.accessed()?;
        
        // Set timestamps on destination
        filetime::set_file_times(dest_path, accessed, modified)?;
        
        Ok(())
    }
}

// Tauri commands for permission operations

#[tauri::command]
pub async fn map_windows_to_linux_attrs(
    read_only: bool,
    hidden: bool,
    system: bool,
    archive: bool,
) -> Result<u32, String> {
    let attrs = WindowsFileAttributes {
        read_only,
        hidden,
        system,
        archive,
    };
    
    let linux_perms = PermissionAgent::windows_to_linux(&attrs);
    let octal = PermissionAgent::linux_to_octal(&linux_perms);
    
    Ok(octal)
}

#[tauri::command]
pub async fn map_linux_to_windows_attrs(octal_permissions: u32) -> Result<WindowsFileAttributes, String> {
    let linux_perms = PermissionAgent::octal_to_linux(octal_permissions);
    let windows_attrs = PermissionAgent::linux_to_windows(&linux_perms);
    
    Ok(windows_attrs)
}

#[tauri::command]
pub async fn get_windows_file_attrs(path: String) -> Result<WindowsFileAttributes, String> {
    let path = Path::new(&path);
    PermissionAgent::get_windows_attributes(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_windows_file_attrs(
    path: String,
    attrs: WindowsFileAttributes,
) -> Result<(), String> {
    let path = Path::new(&path);
    PermissionAgent::set_windows_attributes(path, &attrs)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn preserve_file_timestamps(
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    PermissionAgent::preserve_timestamps(source, dest)
        .map_err(|e| e.to_string())
}
