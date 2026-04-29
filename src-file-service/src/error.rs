use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("invalid file request")]
    InvalidFileRequest {
        path: Option<String>,
        directory: Option<String>,
        resolved_path: Option<String>,
        reason: &'static str,
    },
    #[error("invalid archive request")]
    InvalidArchiveRequest {
        path: Option<String>,
        directory: Option<String>,
        resolved_path: Option<String>,
        reason: &'static str,
    },
    #[error("file too large to preview")]
    FileTooLarge {
        path: Option<String>,
        size_bytes: u64,
        max_read_bytes: u64,
    },
    #[error("archive too large to download")]
    ArchiveTooLarge {
        path: Option<String>,
        size_bytes: u64,
        max_archive_bytes: u64,
    },
    #[error("access denied")]
    AccessDenied {
        path: Option<String>,
        directory: Option<String>,
        base_path: String,
        reason: &'static str,
    },
    #[error("file content changed on disk")]
    Conflict { path: Option<String> },
    #[error("too many concurrent archive requests")]
    TooManyConcurrentArchives { max_concurrent_archives: usize },
    #[error("internal server error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorPayload {
    code: &'static str,
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, payload) = match self {
            Self::InvalidFileRequest {
                path,
                directory,
                resolved_path,
                reason,
            } => (
                StatusCode::BAD_REQUEST,
                ErrorPayload {
                    code: "invalid_file_request",
                    error: format!("Invalid file request: {reason}"),
                    details: Some(json!({
                        "path": path,
                        "directory": directory,
                        "resolvedPath": resolved_path,
                        "reason": reason,
                    })),
                },
            ),
            Self::InvalidArchiveRequest {
                path,
                directory,
                resolved_path,
                reason,
            } => (
                StatusCode::BAD_REQUEST,
                ErrorPayload {
                    code: "invalid_archive_request",
                    error: format!("Invalid archive request: {reason}"),
                    details: Some(json!({
                        "path": path,
                        "directory": directory,
                        "resolvedPath": resolved_path,
                        "reason": reason,
                    })),
                },
            ),
            Self::FileTooLarge {
                path,
                size_bytes,
                max_read_bytes,
            } => (
                StatusCode::PAYLOAD_TOO_LARGE,
                ErrorPayload {
                    code: "file_too_large",
                    error: format!(
                        "File exceeds the preview size limit ({} bytes > {} bytes)",
                        size_bytes, max_read_bytes
                    ),
                    details: Some(json!({
                        "path": path,
                        "sizeBytes": size_bytes,
                        "maxReadBytes": max_read_bytes,
                        "reason": "file exceeds the preview size limit",
                    })),
                },
            ),
            Self::ArchiveTooLarge {
                path,
                size_bytes,
                max_archive_bytes,
            } => (
                StatusCode::PAYLOAD_TOO_LARGE,
                ErrorPayload {
                    code: "archive_too_large",
                    error: format!(
                        "Archive exceeds the download size limit ({} bytes > {} bytes)",
                        size_bytes, max_archive_bytes
                    ),
                    details: Some(json!({
                        "path": path,
                        "sizeBytes": size_bytes,
                        "maxArchiveBytes": max_archive_bytes,
                        "reason": "archive exceeds the download size limit",
                    })),
                },
            ),
            Self::AccessDenied {
                path,
                directory,
                base_path,
                reason,
            } => (
                StatusCode::FORBIDDEN,
                ErrorPayload {
                    code: "access_denied",
                    error: format!("Access denied: {reason}"),
                    details: Some(json!({
                        "path": path,
                        "directory": directory,
                        "basePath": base_path,
                        "reason": reason,
                    })),
                },
            ),
            Self::Conflict { path } => (
                StatusCode::CONFLICT,
                ErrorPayload {
                    code: "content_conflict",
                    error: "File content changed on disk since the editor loaded it".to_string(),
                    details: Some(json!({
                        "path": path,
                        "reason": "expected content does not match current file content",
                    })),
                },
            ),
            Self::TooManyConcurrentArchives {
                max_concurrent_archives,
            } => (
                StatusCode::TOO_MANY_REQUESTS,
                ErrorPayload {
                    code: "too_many_concurrent_archives",
                    error: "Too many concurrent archive requests are already running".to_string(),
                    details: Some(json!({
                        "maxConcurrentArchives": max_concurrent_archives,
                        "reason": "archive concurrency limit reached",
                    })),
                },
            ),
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                ErrorPayload {
                    code: "internal_error",
                    error: "Internal server error while processing the file-service request"
                        .to_string(),
                    details: Some(json!({
                        "reason": "unexpected server-side failure",
                    })),
                },
            ),
        };

        (status, Json(payload)).into_response()
    }
}
