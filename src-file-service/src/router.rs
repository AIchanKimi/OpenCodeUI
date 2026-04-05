use std::sync::Arc;

use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::{config::Config, content, state::AppState, transfer};

#[derive(Debug, Serialize)]
struct HealthPayload {
    ok: bool,
}

pub fn app(config: Arc<Config>) -> Router {
    let state = AppState::new(config);

    Router::new()
        .route("/health", get(health))
        .route(
            "/file/content",
            get(content::get_file_content).put(content::put_file_content),
        )
        .route("/file/download", get(transfer::download_file))
        .route("/file/archive", get(transfer::download_archive))
        .with_state(state)
}

async fn health() -> Json<HealthPayload> {
    Json(HealthPayload { ok: true })
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::{body, http::Request};
    use serde_json::Value;
    use tempfile::tempdir;
    use tower::util::ServiceExt;

    use super::app;
    use crate::config::Config;

    #[tokio::test]
    async fn downloads_file_with_attachment_headers() {
        let workspace = tempdir().expect("create temp workspace");
        let file_path = workspace.path().join("hello.txt");
        tokio::fs::write(&file_path, "hello rust")
            .await
            .expect("write file");

        let app = app(Arc::new(Config::for_test(workspace.path().to_path_buf())));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/file/download?path=hello.txt")
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 200);

        let disposition = response
            .headers()
            .get(axum::http::header::CONTENT_DISPOSITION)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(disposition.contains("hello.txt"));

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        assert_eq!(bytes.as_ref(), b"hello rust");
    }

    #[tokio::test]
    async fn archives_directory_as_zip_payload() {
        let workspace = tempdir().expect("create temp workspace");
        let folder = workspace.path().join("demo");
        tokio::fs::create_dir(&folder).await.expect("create dir");
        tokio::fs::write(folder.join("a.txt"), "alpha")
            .await
            .expect("write file");

        let app = app(Arc::new(Config::for_test(workspace.path().to_path_buf())));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/file/archive?path=demo")
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 200);

        let disposition = response
            .headers()
            .get(axum::http::header::CONTENT_DISPOSITION)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(disposition.contains("demo.zip"));

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        assert!(bytes.starts_with(b"PK"));
        assert!(bytes.windows(4).any(|window| window == b"PK\x05\x06"));
    }

    #[tokio::test]
    async fn reads_binary_content_as_base64_json() {
        let workspace = tempdir().expect("create temp workspace");
        let file_path = workspace.path().join("logo.bin");
        tokio::fs::write(&file_path, [0_u8, 1, 2, 3, 4])
            .await
            .expect("write file");

        let app = app(Arc::new(Config::for_test(workspace.path().to_path_buf())));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/file/content?path=logo.bin")
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 200);

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: Value = serde_json::from_slice(&bytes).expect("parse json");

        assert_eq!(json["type"], "text");
        assert_eq!(json["encoding"], "base64");
        assert_eq!(json["content"], "AAECAwQ=");
    }

    #[tokio::test]
    async fn writes_text_content_without_expected_content() {
        let workspace = tempdir().expect("create temp workspace");
        let file_path = workspace.path().join("note.txt");
        tokio::fs::write(&file_path, "old value")
            .await
            .expect("write file");

        let app = app(Arc::new(Config::for_test(workspace.path().to_path_buf())));

        let response = app
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri("/file/content?path=note.txt")
                    .header("content-type", "application/json")
                    .body(body::Body::from(r#"{"content":"new value"}"#))
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 200);

        let saved = tokio::fs::read_to_string(&file_path)
            .await
            .expect("read file");
        assert_eq!(saved, "new value");
    }
}
