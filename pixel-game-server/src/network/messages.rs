// This file defines the message types used for communication between the server and clients, including serialization and deserialization methods.

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum Message {
    Connect { player_name: String },
    Disconnect { player_id: u32 },
    Move { player_id: u32, x: f32, y: f32 },
    Chat { player_id: u32, message: String },
    GameState { state: GameState },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GameState {
    pub players: Vec<PlayerState>,
    pub world: WorldState,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PlayerState {
    pub id: u32,
    pub name: String,
    pub position: (f32, f32),
    pub health: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WorldState {
    pub tiles: Vec<TileState>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TileState {
    pub position: (i32, i32),
    pub tile_type: String,
}