use std::path::Path;

use axum::{
    body::Body,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use futures_util::StreamExt;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use tokio_util::io::ReaderStream;

use crate::{
    archive,
    auth::{is_authorized, unauthorized_response},
    content::FileQuery,
    error::AppError,
    mime::detect_mime_type,
    pathing::{resolve_directory_path, resolve_file_path},
    state::AppState,
};

pub async fn download_file(
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

    let file = match tokio::fs::File::open(&target_path).await {
        Ok(file) => file,
        Err(error) => {
            log::error!("failed to open file for download: {error}");
            return AppError::Internal.into_response();
        }
    };
    let metadata = match file.metadata().await {
        Ok(metadata) => metadata,
        Err(error) => {
            log::error!("failed to stat file for download: {error}");
            return AppError::Internal.into_response();
        }
    };

    let file_name = basename_for_download(&target_path, "download");
    build_download_response(
        Body::from_stream(ReaderStream::with_capacity(
            file,
            state.config().stream_buffer_bytes(),
        )),
        metadata.len(),
        &detect_mime_type(&target_path),
        &file_name,
    )
}

pub async fn download_archive(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FileQuery>,
) -> Response {
    if !is_authorized(&headers, state.config().as_ref()) {
        return unauthorized_response().into_response();
    }

    let permit = match state.archive_slots().clone().try_acquire_owned() {
        Ok(permit) => permit,
        Err(_) => return AppError::TooManyConcurrentArchives.into_response(),
    };

    let target_path = match resolve_directory_path(
        state.config().as_ref(),
        query.directory.as_deref(),
        query.path.as_deref(),
    )
    .await
    {
        Ok(path) => path,
        Err(error) => {
            drop(permit);
            return error.into_response();
        }
    };
    let archive_name = format!("{}.zip", basename_for_download(&target_path, "archive"));
    let archive_file =
        match archive::create_archive_file(&target_path, state.config().as_ref()).await {
            Ok(archive_file) => archive_file,
            Err(error) => {
                drop(permit);
                log::error!(
                    "failed to create archive {}: {error}",
                    target_path.display()
                );
                return AppError::Internal.into_response();
            }
        };

    let file = match tokio::fs::File::open(&archive_file.archive_path).await {
        Ok(file) => file,
        Err(error) => {
            drop(permit);
            log::error!(
                "failed to open archive {}: {error}",
                archive_file.archive_path.display()
            );
            return AppError::Internal.into_response();
        }
    };
    let metadata = match file.metadata().await {
        Ok(metadata) => metadata,
        Err(error) => {
            drop(permit);
            log::error!(
                "failed to stat archive {}: {error}",
                archive_file.archive_path.display()
            );
            return AppError::Internal.into_response();
        }
    };
    if metadata.len() > state.config().max_archive_bytes() {
        drop(permit);
        log::error!(
            "archive exceeds configured size limit: {} > {}",
            metadata.len(),
            state.config().max_archive_bytes()
        );
        return AppError::ArchiveTooLarge.into_response();
    }

    let body = stream_archive_file(
        file,
        archive_file,
        permit,
        state.config().stream_buffer_bytes(),
    );

    build_download_response(body, metadata.len(), "application/zip", &archive_name)
}

fn build_download_response(
    body: Body,
    content_length: u64,
    content_type: &str,
    file_name: &str,
) -> Response {
    let mut response = Response::new(body);
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&build_content_disposition(file_name))
            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    if content_length > 0 {
        response.headers_mut().insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&content_length.to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("0")),
        );
    }
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn basename_for_download(path: &Path, fallback: &str) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn build_content_disposition(file_name: &str) -> String {
    let fallback = file_name
        .chars()
        .filter(|value| value.is_ascii() && !matches!(value, '\r' | '\n' | '"' | '\\'))
        .collect::<String>();
    let safe_name = if fallback.is_empty() {
        "download".to_string()
    } else {
        fallback
    };
    let encoded = utf8_percent_encode(file_name, NON_ALPHANUMERIC).to_string();
    format!("attachment; filename=\"{safe_name}\"; filename*=UTF-8''{encoded}")
}

fn stream_archive_file(
    file: tokio::fs::File,
    archive_file: archive::ArchiveFile,
    permit: tokio::sync::OwnedSemaphorePermit,
    buffer_size: usize,
) -> Body {
    let stream = async_stream::stream! {
        let _permit = permit;
        let _temp_dir = archive_file.temp_dir;
        let mut stream = ReaderStream::with_capacity(file, buffer_size);

        while let Some(chunk) = stream.next().await {
            yield Result::<_, std::io::Error>::Ok(chunk?);
        }
    };

    Body::from_stream(stream)
}
