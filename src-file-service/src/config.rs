use std::{env, path::PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    base_path: PathBuf,
    port: u16,
    username: String,
    password: String,
    max_concurrent_archives: usize,
    archive_timeout_ms: u64,
    max_read_bytes: u64,
    stream_buffer_bytes: usize,
    max_archive_bytes: u64,
}

impl Config {
    pub fn from_env() -> Self {
        let configured_base_path = PathBuf::from(
            env::var("FILE_SERVICE_BASE_PATH").unwrap_or_else(|_| "/workspace".to_string()),
        );

        Self {
            base_path: std::fs::canonicalize(&configured_base_path).unwrap_or(configured_base_path),
            port: env::var("FILE_SERVICE_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .unwrap_or(4097),
            username: env::var("OPENCODE_SERVER_USERNAME")
                .unwrap_or_else(|_| "opencode".to_string()),
            password: env::var("OPENCODE_SERVER_PASSWORD").unwrap_or_default(),
            max_concurrent_archives: env::var("FILE_SERVICE_MAX_CONCURRENT_ARCHIVES")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(3),
            archive_timeout_ms: env::var("FILE_SERVICE_ARCHIVE_TIMEOUT_MS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(120_000),
            max_read_bytes: env::var("FILE_SERVICE_MAX_READ_BYTES")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(2 * 1024 * 1024),
            stream_buffer_bytes: env::var("FILE_SERVICE_STREAM_BUFFER_BYTES")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(1024 * 1024),
            max_archive_bytes: env::var("FILE_SERVICE_MAX_ARCHIVE_BYTES")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(2 * 1024 * 1024 * 1024),
        }
    }

    #[cfg(test)]
    pub fn for_test(base_path: PathBuf) -> Self {
        Self {
            base_path: std::fs::canonicalize(&base_path).unwrap_or(base_path),
            port: 4097,
            username: "opencode".to_string(),
            password: String::new(),
            max_concurrent_archives: 3,
            archive_timeout_ms: 120_000,
            max_read_bytes: 2 * 1024 * 1024,
            stream_buffer_bytes: 1024 * 1024,
            max_archive_bytes: 2 * 1024 * 1024 * 1024,
        }
    }

    pub fn base_path(&self) -> &PathBuf {
        &self.base_path
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn username(&self) -> &str {
        &self.username
    }

    pub fn password(&self) -> &str {
        &self.password
    }

    pub fn max_concurrent_archives(&self) -> usize {
        self.max_concurrent_archives.max(1)
    }

    pub fn archive_timeout_ms(&self) -> u64 {
        self.archive_timeout_ms.max(1_000)
    }

    pub fn max_read_bytes(&self) -> u64 {
        self.max_read_bytes
    }

    pub fn stream_buffer_bytes(&self) -> usize {
        self.stream_buffer_bytes.max(64 * 1024)
    }

    pub fn max_archive_bytes(&self) -> u64 {
        self.max_archive_bytes
    }
}
