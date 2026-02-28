// This file contains functions for handling incoming messages and routing them to the appropriate game logic.

use crate::network::messages::Message;

pub fn handle_message(message: Message) {
    match message {
        Message::Connect { player_name } => handle_join(player_name),
        Message::Disconnect { player_id } => handle_disconnect(player_id),
        Message::Move { player_id, x, y } => handle_move(player_id, x, y),
        Message::Chat { player_id, message: msg } => handle_chat(player_id, msg),
        Message::GameState { state } => {
            // Handle full game state sync
        }
    }
}

fn handle_join(player_name: String) {
    // Logic for handling a player joining the game
    println!("Player joined: {}", player_name);
}

fn handle_disconnect(player_id: u32) {
    // Logic for handling a player disconnecting
    println!("Player disconnected: {}", player_id);
}

fn handle_move(player_id: u32, x: f32, y: f32) {
    // Logic for handling player movement
    println!("Player {} moved to ({}, {})", player_id, x, y);
}

fn handle_chat(player_id: u32, message: String) {
    // Logic for handling chat messages
    println!("Player {} says: {}", player_id, message);
}