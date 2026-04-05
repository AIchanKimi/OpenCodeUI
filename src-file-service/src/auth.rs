use axum::http::{HeaderMap, StatusCode, header};
use base64::{Engine as _, engine::general_purpose::STANDARD};

use crate::config::Config;

pub fn is_authorized(headers: &HeaderMap, config: &Config) -> bool {
    if config.password().is_empty() {
        return true;
    }

    let Some(header_value) = headers.get(header::AUTHORIZATION) else {
        return false;
    };
    let Ok(header_value) = header_value.to_str() else {
        return false;
    };
    let Some(encoded) = header_value.strip_prefix("Basic ") else {
        return false;
    };
    let Ok(decoded) = STANDARD.decode(encoded) else {
        return false;
    };
    let Ok(decoded) = String::from_utf8(decoded) else {
        return false;
    };
    let Some((username, password)) = decoded.split_once(':') else {
        return false;
    };

    username == config.username() && password == config.password()
}

pub fn unauthorized_response() -> (
    StatusCode,
    [(header::HeaderName, &'static str); 1],
    &'static str,
) {
    (
        StatusCode::UNAUTHORIZED,
        [(
            header::WWW_AUTHENTICATE,
            "Basic realm=\"OpenCodeUI file-service\"",
        )],
        "Unauthorized",
    )
}
