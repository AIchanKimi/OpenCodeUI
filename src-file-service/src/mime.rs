pub fn detect_mime_type(path: &std::path::Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
    {
        "txt" | "ts" | "tsx" | "rs" | "go" | "toml" => "text/plain; charset=utf-8",
        "md" => "text/markdown; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "js" | "jsx" => "text/javascript; charset=utf-8",
        "py" => "text/x-python; charset=utf-8",
        "yaml" | "yml" => "text/yaml; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub fn should_read_as_text(mime_type: &str) -> bool {
    mime_type.starts_with("text/")
        || matches!(
            mime_type,
            "application/json; charset=utf-8"
                | "text/javascript; charset=utf-8"
                | "text/x-python; charset=utf-8"
                | "text/yaml; charset=utf-8"
                | "image/svg+xml"
        )
}
