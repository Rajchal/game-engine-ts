// This file contains unit tests for the game logic, ensuring that game mechanics function as expected.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_player_initialization() {
        let player = Player::new("Player1", 100);
        assert_eq!(player.name, "Player1");
        assert_eq!(player.health, 100);
    }

    #[test]
    fn test_tile_creation() {
        let tile = Tile::new(TileType::Grass);
        assert_eq!(tile.tile_type, TileType::Grass);
    }

    #[test]
    fn test_game_state_update() {
        let mut game_state = GameState::new();
        let player = Player::new("Player1", 100);
        game_state.add_player(player);
        assert_eq!(game_state.active_players.len(), 1);
    }

    #[test]
    fn test_world_update() {
        let mut world = World::new();
        world.add_tile(0, 0, Tile::new(TileType::Water));
        assert_eq!(world.get_tile(0, 0).tile_type, TileType::Water);
    }
}