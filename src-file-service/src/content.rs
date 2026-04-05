use axum::{
    Json,
    extract::{Query, State},
    http::HeaderMap,
    response::{IntoResponse, Response},
};
use base64::Engine as _;
use serde::{Deserialize, Serialize};

use crate::{
    auth::{is_authorized, unauthorized_response},
    error::AppError,
    mime::{detect_mime_type, should_read_as_text},
    pathing::resolve_file_path,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct FileQuery {
    pub(crate) directory: Option<String>,
    pub(crate) path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FileWriteRequest {
    content: String,
    #[serde(rename = "expectedContent")]
    expected_content: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FileReadResponse {
    #[serde(rename = "type")]
    response_type: &'static str,
    content: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    encoding: Option<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct FileWriteResponse {
    path: String,
    #[serde(rename = "savedAt")]
    saved_at: String,
}

pub async fn get_file_content(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FileQuery>,
) -> Response {
    if !is_authorized(&headers, state.config().as_ref()) {
        return unauthorized_response().into_response();
    }

    let target_path = match resolve_file_path(
        state.config().as_ref(),
        query.directory.as_deref(),
        query.path.as_deref(),
    )
    .await
    {
        Ok(path) => path,
        Err(error) => return error.into_response(),
    };
    let mime_type = detect_mime_type(&target_path);
    let metadata = match tokio::fs::metadata(&target_path).await {
        Ok(metadata) => metadata,
        Err(error) => {
            log::error!(
                "failed to stat file content {}: {error}",
                target_path.display()
            );
            return AppError::Internal.into_response();
        }
    };
    if metadata.len() > state.config().max_read_bytes() {
        return AppError::FileTooLarge.into_response();
    }

    if should_read_as_text(&mime_type) {
        let content = match tokio::fs::read_to_string(&target_path).await {
            Ok(content) => content,
            Err(error) => {
                log::error!(
                    "failed to read text file content {}: {error}",
                    target_path.display()
                );
                return AppError::Internal.into_response();
            }
        };

        return Json(FileReadResponse {
            response_type: "text",
            content,
            mime_type,
            encoding: None,
        })
        .into_response();
    }

    let bytes = match tokio::fs::read(&target_path).await {
        Ok(bytes) => bytes,
        Err(error) => {
            log::error!(
                "failed to read binary file content {}: {error}",
                target_path.display()
            );
            return AppError::Internal.into_response();
        }
    };
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);
    base64::engine::general_purpose::STANDARD.encode_string(bytes, &mut encoded);

    Json(FileReadResponse {
        response_type: "text",
        content: encoded,
        mime_type,
        encoding: Some("base64"),
    })
    .into_response()
}

pub async fn put_file_content(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileWriteRequest>,
) -> Response {
    if !is_authorized(&headers, state.config().as_ref()) {
        return unauthorized_response().into_response();
    }

    let target_path = match resolve_file_path(
        state.config().as_ref(),
        query.directory.as_deref(),
        query.path.as_deref(),
    )
    .await
    {
        Ok(path) => path,
        Err(error) => return error.into_response(),
    };

    if let Some(expected_content) = payload.expected_content.as_deref() {
        let current_content = match tokio::fs::read_to_string(&target_path).await {
            Ok(content) => content,
            Err(error) => {
                log::error!(
                    "failed to read file before write {}: {error}",
                    target_path.display()
                );
                return AppError::Internal.into_response();
            }
        };

        if expected_content != current_content {
            return AppError::Conflict.into_response();
        }
    }

    if let Err(error) = tokio::fs::write(&target_path, payload.content).await {
        log::error!(
            "failed to write file content {}: {error}",
            target_path.display()
        );
        return AppError::Internal.into_response();
    }

    Json(FileWriteResponse {
        path: query
            .path
            .unwrap_or_else(|| target_path.to_string_lossy().into_owned()),
        saved_at: chrono_like_timestamp(),
    })
    .into_response()
}

fn chrono_like_timestamp() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}
