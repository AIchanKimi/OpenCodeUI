use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("invalid file request")]
    InvalidFileRequest,
    #[error("invalid archive request")]
    InvalidArchiveRequest,
    #[error("file too large to preview")]
    FileTooLarge,
    #[error("archive too large to download")]
    ArchiveTooLarge,
    #[error("access denied")]
    AccessDenied,
    #[error("file content changed on disk")]
    Conflict,
    #[error("too many concurrent archive requests")]
    TooManyConcurrentArchives,
    #[error("internal server error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorPayload<'a> {
    error: &'a str,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::InvalidFileRequest => (StatusCode::BAD_REQUEST, "Invalid file request"),
            Self::InvalidArchiveRequest => (StatusCode::BAD_REQUEST, "Invalid archive request"),
            Self::FileTooLarge => (StatusCode::PAYLOAD_TOO_LARGE, "File too large to preview"),
            Self::ArchiveTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "Archive too large to download",
            ),
            Self::AccessDenied => (StatusCode::FORBIDDEN, "Access denied"),
            Self::Conflict => (StatusCode::CONFLICT, "File content changed on disk"),
            Self::TooManyConcurrentArchives => (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many concurrent archive requests",
            ),
            Self::Internal => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        (status, Json(ErrorPayload { error: message })).into_response()
    }
}
