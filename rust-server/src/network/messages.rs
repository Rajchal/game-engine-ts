use serde::{Deserialize, Serialize};

use crate::game::items::Item;

// ─── Client → Server ─────────────────────────────────────────────────────────

/// Messages sent from the client to the server.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    /// First message a client sends after connecting.
    Join { player_name: String },
    /// Move one tile in a direction.
    Move { direction: Direction },
    /// Attack the dragon (must be adjacent and have all 3 items).
    Attack,
}

/// Movement directions (tile-based, one tile per move).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

impl Direction {
    /// Convert to a (dx, dy) delta. Up = -Y because row 0 is the top.
    pub fn to_delta(self) -> (i32, i32) {
        match self {
            Direction::Up => (0, -1),
            Direction::Down => (0, 1),
            Direction::Left => (-1, 0),
            Direction::Right => (1, 0),
        }
    }
}

// ─── Server → Client ─────────────────────────────────────────────────────────

/// Messages sent from the server to the client.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    /// Sent after a client sends Join.
    Welcome { player_id: String },
    /// Waiting in lobby for a second player.
    WaitingForOpponent,
    /// A match has been created. Includes the full tile map.
    MatchStart {
        seed: u64,
        world_width: u32,
        world_height: u32,
        spawn_x: i32,
        spawn_y: i32,
        opponent_name: String,
        /// Compact tile string: G=Grass W=Water L=Wall F=Forest S=Sand, row-major.
        tiles: String,
    },
    /// Periodic state update sent after every action.
    StateUpdate {
        your_x: i32,
        your_y: i32,
        your_hp: u32,
        your_inventory: Vec<Item>,
        opponent_x: i32,
        opponent_y: i32,
        opponent_hp: u32,
        opponent_item_count: u32,
        dragon_visible: bool,
        dragon_x: Option<i32>,
        dragon_y: Option<i32>,
        dragon_width: Option<u32>,
        dragon_height: Option<u32>,
        dragon_hp: Option<u32>,
    },
    /// Sent when a move is rejected (e.g. tile not walkable).
    MoveDenied { reason: String },
    /// Player picked up a holy item.
    ItemPickedUp { item: Item },
    /// All 3 items collected — dragon location revealed!
    DragonRevealed {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    },
    /// Result of attacking the dragon.
    AttackResult {
        damage_dealt: u32,
        damage_taken: u32,
        your_hp: u32,
        dragon_hp: u32,
    },
    /// The match is over.
    MatchEnd { winner: String },
    /// The other player disconnected.
    OpponentDisconnected,
    /// Generic error.
    Error { message: String },
}
