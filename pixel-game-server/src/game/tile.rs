pub struct Tile {
    pub tile_type: TileType,
    pub walkable: bool,
}

impl Tile {
    pub fn new(tile_type: TileType, walkable: bool) -> Self {
        Tile { tile_type, walkable }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum TileType {
    Grass,
    Water,
    Wall,
    Sand,
}