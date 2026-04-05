use std::{
    io,
    path::{Path, PathBuf},
    process::Stdio,
};

use tempfile::TempDir;
use tokio::process::Command;

use crate::config::Config;

pub struct ArchiveFile {
    pub temp_dir: TempDir,
    pub archive_path: PathBuf,
}

pub async fn create_archive_file(target_path: &Path, config: &Config) -> io::Result<ArchiveFile> {
    let temp_dir = tempfile::Builder::new()
        .prefix("opencodeui-archive-")
        .tempdir()?;
    let archive_name = target_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "archive".to_string());
    let archive_path = temp_dir.path().join(format!("{archive_name}.zip"));

    let entry_name = target_path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "archive entry missing"))?;
    let parent_dir = target_path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "archive parent missing"))?;

    let output = tokio::time::timeout(
        std::time::Duration::from_millis(config.archive_timeout_ms()),
        Command::new("zip")
            .arg("-q1yr")
            .arg(&archive_path)
            .arg(entry_name)
            .current_dir(parent_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "zip command timed out"))??;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = stderr.chars().take(2048).collect::<String>();
        let error = if message.is_empty() {
            "zip command failed".to_string()
        } else {
            format!("zip command failed: {message}")
        };
        return Err(io::Error::other(error));
    }

    Ok(ArchiveFile {
        temp_dir,
        archive_path,
    })
}
