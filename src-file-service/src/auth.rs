use axum::{
    Json,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::Serialize;

use crate::config::Config;

#[derive(Serialize)]
struct UnauthorizedPayload {
    code: &'static str,
    error: &'static str,
    details: UnauthorizedDetails,
}

#[derive(Serialize)]
struct UnauthorizedDetails {
    scheme: &'static str,
    realm: &'static str,
    reason: &'static str,
}

const AUTH_REALM: &str = "OpenCodeUI file-service";

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

pub fn unauthorized_response() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        [(
            header::WWW_AUTHENTICATE,
            "Basic realm=\"OpenCodeUI file-service\"",
        )],
        Json(UnauthorizedPayload {
            code: "unauthorized",
            error: "Missing or invalid Basic authentication for the file service",
            details: UnauthorizedDetails {
                scheme: "Basic",
                realm: AUTH_REALM,
                reason: "provide the configured file-service username and password",
            },
        }),
    )
        .into_response()
}
