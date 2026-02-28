struct GameState {
    active_players: Vec<Player>,
    game_objects: Vec<GameObject>,
}

impl GameState {
    pub fn new() -> Self {
        GameState {
            active_players: Vec::new(),
            game_objects: Vec::new(),
        }
    }

    pub fn add_player(&mut self, player: Player) {
        self.active_players.push(player);
    }

    pub fn remove_player(&mut self, player_id: u32) {
        self.active_players.retain(|player| player.id != player_id);
    }

    pub fn update(&mut self) {
        // Update game objects and players
    }
}

struct Player {
    id: u32,
    position: (f32, f32),
    health: u32,
}

struct GameObject {
    id: u32,
    position: (f32, f32),
    // Other properties
}