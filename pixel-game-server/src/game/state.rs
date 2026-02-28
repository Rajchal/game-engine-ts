pub struct GameState {
    pub active_players: Vec<Player>,
    pub game_objects: Vec<GameObject>,
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

pub struct Player {
    pub id: u32,
    pub position: (f32, f32),
    pub health: u32,
}

pub struct GameObject {
    pub id: u32,
    pub position: (f32, f32),
}