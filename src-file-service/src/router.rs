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
    use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
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

    #[tokio::test]
    async fn returns_guidance_for_access_denied_requests() {
        let workspace = tempdir().expect("create temp workspace");
        let outside = tempdir().expect("create outside workspace");
        let outside_file = outside.path().join("secret.txt");
        tokio::fs::write(&outside_file, "secret")
            .await
            .expect("write file");

        let app = app(Arc::new(Config::for_test(workspace.path().to_path_buf())));

        let response = app
            .oneshot(
                Request::builder()
                    .uri(format!(
                        "/file/download?directory={}&path=secret.txt",
                        utf8_percent_encode(
                            outside.path().to_string_lossy().as_ref(),
                            NON_ALPHANUMERIC,
                        )
                    ))
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 403);

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: Value = serde_json::from_slice(&bytes).expect("parse json");

        assert_eq!(json["code"], "access_denied");
        assert!(
            json["error"]
                .as_str()
                .unwrap_or_default()
                .contains("outside the allowed base path")
        );
        assert!(json["details"]["path"].is_null());
        assert_eq!(
            json["details"]["reason"],
            "requested directory is outside the allowed base path"
        );
        assert_eq!(json["details"]["basePath"], "<file-service-base-path>");
        let reported_directory = json["details"]["directory"]
            .as_str()
            .expect("directory detail should be a string");
        let expected_suffix = outside
            .path()
            .file_name()
            .and_then(|value| value.to_str())
            .expect("temp directory name should be valid utf-8");
        assert!(reported_directory.ends_with(expected_suffix));
    }

    #[tokio::test]
    async fn returns_size_limit_details_for_large_preview_requests() {
        let workspace = tempdir().expect("create temp workspace");
        let file_path = workspace.path().join("large.txt");
        tokio::fs::write(&file_path, b"1234567890")
            .await
            .expect("write file");

        let mut config = Config::for_test(workspace.path().to_path_buf());
        config.set_max_read_bytes_for_test(4);
        let app = app(Arc::new(config));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/file/content?path=large.txt")
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 413);

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: Value = serde_json::from_slice(&bytes).expect("parse json");

        assert_eq!(json["code"], "file_too_large");
        assert!(
            json["error"]
                .as_str()
                .unwrap_or_default()
                .contains("exceeds the preview size limit")
        );
        assert_eq!(json["details"]["path"], "large.txt");
        assert_eq!(json["details"]["sizeBytes"], 10);
        assert_eq!(json["details"]["maxReadBytes"], 4);
    }

    #[tokio::test]
    async fn returns_structured_unauthorized_errors() {
        let workspace = tempdir().expect("create temp workspace");
        let mut config = Config::for_test(workspace.path().to_path_buf());
        config.set_password_for_test("secret".to_string());
        let app = app(Arc::new(config));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/file/content?path=note.txt")
                    .body(body::Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), 401);

        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: Value = serde_json::from_slice(&bytes).expect("parse json");

        assert_eq!(json["code"], "unauthorized");
        assert!(
            json["error"]
                .as_str()
                .unwrap_or_default()
                .contains("Missing or invalid Basic authentication")
        );
        assert_eq!(json["details"]["scheme"], "Basic");
        assert_eq!(json["details"]["realm"], "OpenCodeUI file-service");
    }
}
