use serde::{Deserialize, Serialize};

/// The types of tiles that make up the world.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TileType {
    Grass,
    Water,
    Wall,
    Sand,
    Forest,
}

impl TileType {
    /// Whether a player can walk on this tile type.
    pub fn is_walkable(&self) -> bool {
        matches!(self, TileType::Grass | TileType::Sand | TileType::Forest)
    }
}
