mod archive;
mod auth;
mod config;
mod content;
mod error;
mod mime;
mod pathing;
mod router;
mod state;
mod transfer;

use std::{net::SocketAddr, sync::Arc};

use config::Config;
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL_ALLOCATOR: MiMalloc = MiMalloc;

#[tokio::main]
async fn main() {
    env_logger::init();

    let config = Arc::new(Config::from_env());
    let app = router::app(Arc::clone(&config));
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port()));

    log::info!("Rust file service starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind Rust file service");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("failed to run Rust file service");
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        log::error!("failed to listen for shutdown signal: {error}");
    }
}
