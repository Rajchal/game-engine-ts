/// Server and game configuration.
#[derive(Debug, Clone)]
pub struct GameConfig {
    /// Port the WebSocket server listens on.
    pub port: u16,
    /// World width in tiles.
    pub world_width: u32,
    /// World height in tiles.
    pub world_height: u32,
    /// Tile size in pixels (16x16).
    pub tile_size: u32,
    /// Viewport width in tiles (640 / 16 = 40).
    pub viewport_width: u32,
    /// Viewport height in tiles (360 / 16 ≈ 22).
    pub viewport_height: u32,
    /// Starting player HP.
    pub player_hp: u32,
    /// Dragon HP.
    pub dragon_hp: u32,
    /// Damage the dragon deals per hit.
    pub dragon_damage: u32,
    /// Damage the player deals with the Holy Sword.
    pub sword_damage: u32,
    /// Damage reduction when wearing Holy Armor.
    pub armor_reduction: u32,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            world_width: 100,
            world_height: 100,
            tile_size: 16,
            viewport_width: 40,  // 640 / 16
            viewport_height: 22, // 360 / 16 ≈ 22
            player_hp: 100,
            dragon_hp: 300,
            dragon_damage: 20,
            sword_damage: 50,
            armor_reduction: 10,
        }
    }
}
