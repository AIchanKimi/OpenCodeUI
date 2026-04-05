use std::path::{Path, PathBuf};

use crate::{config::Config, error::AppError};

pub async fn resolve_file_path(
    config: &Config,
    directory: Option<&str>,
    path: Option<&str>,
) -> Result<PathBuf, AppError> {
    let canonical = resolve_existing_path(config, directory, path).await?;

    if !canonical.is_file() {
        return Err(AppError::InvalidFileRequest);
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
        return Err(AppError::InvalidArchiveRequest);
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
    let candidate = resolve_inside(&workspace_root, Path::new(requested_path))?;
    let metadata = tokio::fs::symlink_metadata(&candidate)
        .await
        .map_err(|_| AppError::AccessDenied)?;

    if metadata.file_type().is_symlink() {
        return Err(AppError::AccessDenied);
    }

    let canonical = tokio::fs::canonicalize(&candidate)
        .await
        .map_err(|_| AppError::AccessDenied)?;
    ensure_inside(&workspace_root, &canonical)?;

    Ok(canonical)
}

async fn resolve_workspace_root(
    config: &Config,
    directory: Option<&str>,
) -> Result<PathBuf, AppError> {
    let base_path = config.base_path();

    let candidate = match directory {
        Some(directory) if directory.is_empty() || directory == "." => return Ok(base_path.clone()),
        Some(directory) => resolve_inside(base_path, Path::new(directory))?,
        None => base_path.clone(),
    };

    if candidate == *base_path {
        return Ok(base_path.clone());
    }

    let metadata = tokio::fs::symlink_metadata(&candidate)
        .await
        .map_err(|_| AppError::AccessDenied)?;

    if metadata.file_type().is_symlink() {
        return Err(AppError::AccessDenied);
    }

    let canonical = tokio::fs::canonicalize(&candidate)
        .await
        .map_err(|_| AppError::AccessDenied)?;
    ensure_inside(base_path, &canonical)?;
    Ok(canonical)
}

fn resolve_inside(base: &Path, input: &Path) -> Result<PathBuf, AppError> {
    let candidate = if input.is_absolute() {
        input.to_path_buf()
    } else {
        base.join(input)
    };
    ensure_inside(base, &candidate)?;
    Ok(candidate)
}

fn ensure_inside(base: &Path, target: &Path) -> Result<(), AppError> {
    let Ok(relative) = target.strip_prefix(base) else {
        if target == base {
            return Ok(());
        }
        return Err(AppError::AccessDenied);
    };

    if relative
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(AppError::AccessDenied);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::ensure_inside;

    #[test]
    fn keeps_paths_inside_workspace() {
        assert!(
            ensure_inside(
                Path::new("/workspace"),
                Path::new("/workspace/demo/file.txt")
            )
            .is_ok()
        );
    }

    #[test]
    fn rejects_paths_outside_workspace() {
        assert!(ensure_inside(Path::new("/workspace"), Path::new("/tmp/file.txt")).is_err());
    }
}
