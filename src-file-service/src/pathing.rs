use std::path::{Path, PathBuf};

use crate::{config::Config, error::AppError};

const FILE_SERVICE_BASE_PATH_LABEL: &str = "<file-service-base-path>";

pub async fn resolve_file_path(
    config: &Config,
    directory: Option<&str>,
    path: Option<&str>,
) -> Result<PathBuf, AppError> {
    let canonical = resolve_existing_path(config, directory, path).await?;

    if !canonical.is_file() {
        return Err(AppError::InvalidFileRequest {
            path: path.map(ToOwned::to_owned),
            directory: directory.map(ToOwned::to_owned),
            resolved_path: Some(relative_display(config.base_path(), &canonical)),
            reason: "resolved target is not a file",
        });
    }

    Ok(canonical)
}

pub async fn resolve_directory_path(
    config: &Config,
    directory: Option<&str>,
    path: Option<&str>,
) -> Result<PathBuf, AppError> {
    let canonical = resolve_existing_path(config, directory, path).await?;

    if !canonical.is_dir() {
        return Err(AppError::InvalidArchiveRequest {
            path: path.map(ToOwned::to_owned),
            directory: directory.map(ToOwned::to_owned),
            resolved_path: Some(relative_display(config.base_path(), &canonical)),
            reason: "resolved target is not a directory",
        });
    }

    Ok(canonical)
}

async fn resolve_existing_path(
    config: &Config,
    directory: Option<&str>,
    path: Option<&str>,
) -> Result<PathBuf, AppError> {
    let workspace_root = resolve_workspace_root(config, directory).await?;
    let requested_path = path.unwrap_or(".");
    let candidate = resolve_inside(
        &workspace_root,
        Path::new(requested_path),
        directory,
        Some(requested_path),
        config,
        "requested path escapes the allowed base path",
    )?;
    let metadata = tokio::fs::symlink_metadata(&candidate)
        .await
        .map_err(|error| {
            access_denied_from_io(error.kind(), config, directory, Some(requested_path))
        })?;

    if metadata.file_type().is_symlink() {
        return Err(AppError::AccessDenied {
            path: Some(requested_path.to_string()),
            directory: directory.map(ToOwned::to_owned),
            base_path: FILE_SERVICE_BASE_PATH_LABEL.to_string(),
            reason: "symbolic links are not allowed",
        });
    }

    let canonical = tokio::fs::canonicalize(&candidate).await.map_err(|error| {
        access_denied_from_io(error.kind(), config, directory, Some(requested_path))
    })?;
    ensure_inside(
        &workspace_root,
        &canonical,
        directory,
        Some(requested_path),
        config,
        "requested path resolves outside the allowed base path",
    )?;

    Ok(canonical)
}

async fn resolve_workspace_root(
    config: &Config,
    directory: Option<&str>,
) -> Result<PathBuf, AppError> {
    let base_path = config.base_path();

    let candidate = match directory {
        Some(directory) if directory.is_empty() || directory == "." => return Ok(base_path.clone()),
        Some(directory) => resolve_inside(
            base_path,
            Path::new(directory),
            Some(directory),
            None,
            config,
            "requested directory is outside the allowed base path",
        )?,
        None => base_path.clone(),
    };

    if candidate == *base_path {
        return Ok(base_path.clone());
    }

    let metadata = tokio::fs::symlink_metadata(&candidate)
        .await
        .map_err(|error| access_denied_from_io(error.kind(), config, directory, None))?;

    if metadata.file_type().is_symlink() {
        return Err(AppError::AccessDenied {
            path: None,
            directory: Some(candidate.to_string_lossy().into_owned()),
            base_path: FILE_SERVICE_BASE_PATH_LABEL.to_string(),
            reason: "symbolic links are not allowed for the directory parameter",
        });
    }

    let canonical = tokio::fs::canonicalize(&candidate)
        .await
        .map_err(|error| access_denied_from_io(error.kind(), config, directory, None))?;
    ensure_inside(
        base_path,
        &canonical,
        Some(candidate.to_string_lossy().as_ref()),
        None,
        config,
        "requested directory is outside the allowed base path",
    )?;
    Ok(canonical)
}

fn resolve_inside(
    base: &Path,
    input: &Path,
    directory: Option<&str>,
    path: Option<&str>,
    config: &Config,
    outside_reason: &'static str,
) -> Result<PathBuf, AppError> {
    let candidate = if input.is_absolute() {
        input.to_path_buf()
    } else {
        base.join(input)
    };
    ensure_inside(base, &candidate, directory, path, config, outside_reason)?;
    Ok(candidate)
}

fn ensure_inside(
    base: &Path,
    target: &Path,
    directory: Option<&str>,
    path: Option<&str>,
    _config: &Config,
    outside_reason: &'static str,
) -> Result<(), AppError> {
    let Ok(relative) = target.strip_prefix(base) else {
        if target == base {
            return Ok(());
        }
        return Err(AppError::AccessDenied {
            path: path.map(ToOwned::to_owned),
            directory: directory.map(ToOwned::to_owned),
            base_path: FILE_SERVICE_BASE_PATH_LABEL.to_string(),
            reason: outside_reason,
        });
    };

    if relative
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(AppError::AccessDenied {
            path: path.map(ToOwned::to_owned),
            directory: directory.map(ToOwned::to_owned),
            base_path: FILE_SERVICE_BASE_PATH_LABEL.to_string(),
            reason: "path traversal segments are not allowed",
        });
    }

    Ok(())
}

fn access_denied_from_io(
    kind: std::io::ErrorKind,
    _config: &Config,
    directory: Option<&str>,
    path: Option<&str>,
) -> AppError {
    let reason = match kind {
        std::io::ErrorKind::NotFound => {
            "requested path does not exist inside the allowed base path"
        }
        std::io::ErrorKind::PermissionDenied => {
            "insufficient filesystem permissions for the requested path"
        }
        _ => "requested path could not be resolved inside the allowed base path",
    };

    AppError::AccessDenied {
        path: path.map(ToOwned::to_owned),
        directory: directory.map(ToOwned::to_owned),
        base_path: FILE_SERVICE_BASE_PATH_LABEL.to_string(),
        reason,
    }
}

fn relative_display(base: &Path, target: &Path) -> String {
    target
        .strip_prefix(base)
        .ok()
        .map(|relative| {
            let display = relative.to_string_lossy().replace('\\', "/");
            if display.is_empty() {
                ".".to_string()
            } else {
                display
            }
        })
        .unwrap_or_else(|| ".".to_string())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use crate::config::Config;

    use super::ensure_inside;

    #[test]
    fn keeps_paths_inside_workspace() {
        assert!(
            ensure_inside(
                Path::new("/workspace"),
                Path::new("/workspace/demo/file.txt"),
                None,
                Some("demo/file.txt"),
                &Config::for_test(Path::new("/workspace").to_path_buf()),
                "outside"
            )
            .is_ok()
        );
    }

    #[test]
    fn rejects_paths_outside_workspace() {
        assert!(
            ensure_inside(
                Path::new("/workspace"),
                Path::new("/tmp/file.txt"),
                None,
                Some("/tmp/file.txt"),
                &Config::for_test(Path::new("/workspace").to_path_buf()),
                "outside"
            )
            .is_err()
        );
    }
}
