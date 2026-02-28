// This file contains functions for handling incoming messages and routing them to the appropriate game logic.

use crate::network::messages::{Message, MessageType};
use crate::game::state::GameState;
use crate::server::session::Session;

pub fn handle_message(message: Message, game_state: &mut GameState, session: &mut Session) {
    match message.message_type {
        MessageType::Join => handle_join(message, game_state, session),
        MessageType::Move => handle_move(message, game_state, session),
        MessageType::Chat => handle_chat(message, game_state, session),
        // Add more message types as needed
    }
}

fn handle_join(message: Message, game_state: &mut GameState, session: &mut Session) {
    // Logic for handling a player joining the game
}

fn handle_move(message: Message, game_state: &mut GameState, session: &mut Session) {
    // Logic for handling player movement
}

fn handle_chat(message: Message, game_state: &mut GameState, session: &mut Session) {
    // Logic for handling chat messages
}