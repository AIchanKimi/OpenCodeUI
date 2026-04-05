use std::sync::Arc;

use tokio::sync::Semaphore;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    config: Arc<Config>,
    archive_slots: Arc<Semaphore>,
}

impl AppState {
    pub fn new(config: Arc<Config>) -> Self {
        Self {
            archive_slots: Arc::new(Semaphore::new(config.max_concurrent_archives())),
            config,
        }
    }

    pub fn config(&self) -> &Arc<Config> {
        &self.config
    }

    pub fn archive_slots(&self) -> &Arc<Semaphore> {
        &self.archive_slots
    }
}
