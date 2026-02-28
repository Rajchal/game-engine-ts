// This file defines the configuration structure for the server, including settings such as port number and game parameters.
// It may include functions to load configuration from a file.

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub max_players: usize,
    pub game_name: String,
}

impl Config {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let mut file = File::open(path)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        let config: Config = toml::de::from_str(&contents)?;
        Ok(config)
    }
}