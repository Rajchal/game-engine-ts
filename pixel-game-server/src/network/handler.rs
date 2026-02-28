use crate::game::state::{GameMatch, MatchStatus};
use crate::network::messages::{ClientMessage, ServerMessage};

/// Process a client message and return (target_player_id, response) pairs.
/// The caller is responsible for actually sending them over WebSocket.
pub fn process_message(
    game: &mut GameMatch,
    player_id: &str,
    msg: ClientMessage,
) -> Vec<(String, ServerMessage)> {
    if game.status != MatchStatus::Active {
        return vec![];
    }

    let mut responses = Vec::new();

    match msg {
        ClientMessage::Join { .. } => {
            // Already joined — ignore duplicate
        }

        ClientMessage::Move { direction } => {
            let (dx, dy) = direction.to_delta();
            if game.try_move(player_id, dx, dy) {
                // Check item pickup after moving
                if let Some(item) = game.check_item_pickup(player_id) {
                    responses.push((
                        player_id.to_string(),
                        ServerMessage::ItemPickedUp { item },
                    ));
                    // Did the player just complete their collection?
                    if let Some(player) = game.get_player(player_id) {
                        if player.has_all_items() {
                            responses.push((
                                player_id.to_string(),
                                ServerMessage::DragonRevealed {
                                    x: game.dragon.x,
                                    y: game.dragon.y,
                                },
                            ));
                        }
                    }
                }
            } else {
                responses.push((
                    player_id.to_string(),
                    ServerMessage::MoveDenied {
                        reason: "Cannot walk there".to_string(),
                    },
                ));
            }
        }

        ClientMessage::Attack => match game.attack_dragon(player_id) {
            Some((damage_dealt, damage_taken, _dragon_dead)) => {
                let player_hp = game.get_player(player_id).map(|p| p.hp).unwrap_or(0);
                responses.push((
                    player_id.to_string(),
                    ServerMessage::AttackResult {
                        damage_dealt,
                        damage_taken,
                        your_hp: player_hp,
                        dragon_hp: game.dragon.hp,
                    },
                ));
            }
            None => {
                responses.push((
                    player_id.to_string(),
                    ServerMessage::Error {
                        message: "Cannot attack: not near dragon or missing items".to_string(),
                    },
                ));
            }
        },
    }

    responses
}

/// Build a StateUpdate message for a specific player.
pub fn build_state_update(game: &GameMatch, player_id: &str) -> Option<ServerMessage> {
    let player = game.get_player(player_id)?;
    let opponent = game.get_opponent(player_id)?;
    let dragon_visible = player.has_all_items();

    Some(ServerMessage::StateUpdate {
        your_x: player.x,
        your_y: player.y,
        your_hp: player.hp,
        your_inventory: player.inventory.iter().cloned().collect(),
        opponent_x: opponent.x,
        opponent_y: opponent.y,
        opponent_hp: opponent.hp,
        opponent_item_count: opponent.inventory.len() as u32,
        dragon_visible,
        dragon_x: if dragon_visible {
            Some(game.dragon.x)
        } else {
            None
        },
        dragon_y: if dragon_visible {
            Some(game.dragon.y)
        } else {
            None
        },
        dragon_hp: if dragon_visible {
            Some(game.dragon.hp)
        } else {
            None
        },
    })
}
