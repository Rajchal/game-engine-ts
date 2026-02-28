// This file manages player sessions, including session state and player management. 
// It may include methods for starting and ending sessions.

use std::collections::HashMap;

pub struct Session {
    pub players: HashMap<String, Player>,
    pub session_id: String,
}

impl Session {
    pub fn new(session_id: String) -> Self {
        Session {
            players: HashMap::new(),
            session_id,
        }
    }

    pub fn add_player(&mut self, player: Player) {
        self.players.insert(player.id.clone(), player);
    }

    pub fn remove_player(&mut self, player_id: &str) {
        self.players.remove(player_id);
    }

    pub fn get_player(&self, player_id: &str) -> Option<&Player> {
        self.players.get(player_id)
    }

    pub fn start(&self) {
        // Logic to start the session
    }

    pub fn end(&self) {
        // Logic to end the session
    }
}

pub struct Player {
    pub id: String,
    pub name: String,
    pub position: (f32, f32),
    pub health: u32,
}

impl Player {
    pub fn new(id: String, name: String) -> Self {
        Player {
            id,
            name,
            position: (0.0, 0.0),
            health: 100,
        }
    }

    pub fn move_to(&mut self, x: f32, y: f32) {
        self.position = (x, y);
    }
}