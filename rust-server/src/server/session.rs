use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message as WsMessage;

use crate::config::GameConfig;
use crate::game::state::{GameMatch, MatchStatus};
use crate::network::handler;
use crate::network::messages::{ClientMessage, ServerMessage};

type WsStream = tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>;
type WsSender = SplitSink<WsStream, WsMessage>;
type WsReceiver = SplitStream<WsStream>;

/// A player waiting in the lobby for an opponent.
pub struct WaitingPlayer {
    pub id: String,
    pub name: String,
    pub sender: WsSender,
    pub receiver: WsReceiver,
}

/// Send a JSON-encoded ServerMessage over WebSocket.
pub async fn send_msg(sender: &mut WsSender, msg: &ServerMessage) {
    if let Ok(json) = serde_json::to_string(msg) {
        let _ = sender.send(WsMessage::Text(json.into())).await;
    }
}

/// Run a full match between two players until someone wins or disconnects.
pub async fn run_match(p1: WaitingPlayer, p2: WaitingPlayer, config: GameConfig) {
    let WaitingPlayer {
        id: p1_id,
        name: p1_name,
        sender: mut p1_tx,
        receiver: mut p1_rx,
    } = p1;
    let WaitingPlayer {
        id: p2_id,
        name: p2_name,
        sender: mut p2_tx,
        receiver: mut p2_rx,
    } = p2;

    // Create the match (generates world, places items + dragon)
    let mut game = GameMatch::new(
        p1_id.clone(),
        p1_name.clone(),
        p2_id.clone(),
        p2_name.clone(),
        &config,
    );

    let spawns = game.world.get_spawn_positions();

    let tiles = game.world.tiles_compact();

    // Tell both players the match is starting
    send_msg(
        &mut p1_tx,
        &ServerMessage::MatchStart {
            seed: game.seed,
            world_width: config.world_width,
            world_height: config.world_height,
            spawn_x: spawns[0].0,
            spawn_y: spawns[0].1,
            opponent_name: p2_name.clone(),
            tiles: tiles.clone(),
        },
    )
    .await;

    send_msg(
        &mut p2_tx,
        &ServerMessage::MatchStart {
            seed: game.seed,
            world_width: config.world_width,
            world_height: config.world_height,
            spawn_x: spawns[1].0,
            spawn_y: spawns[1].1,
            opponent_name: p1_name.clone(),
            tiles: tiles,
        },
    )
    .await;

    println!(
        "Match started: '{}' vs '{}' | seed: {} | dragon at ({}, {})",
        p1_name, p2_name, game.seed, game.dragon.x, game.dragon.y
    );

    // ─── Main game loop: wait for input from either player ───────────
    loop {
        tokio::select! {
            msg = p1_rx.next() => {
                if !handle_ws_msg(msg, &p1_id, &p2_id, &mut game, &mut p1_tx, &mut p2_tx).await {
                    return;
                }
            }
            msg = p2_rx.next() => {
                if !handle_ws_msg(msg, &p2_id, &p1_id, &mut game, &mut p2_tx, &mut p1_tx).await {
                    return;
                }
            }
        }
    }
}

/// Handle a single WebSocket message from a player.
/// Returns `false` if the match should end.
async fn handle_ws_msg(
    msg: Option<Result<WsMessage, tokio_tungstenite::tungstenite::Error>>,
    player_id: &str,
    opponent_id: &str,
    game: &mut GameMatch,
    player_tx: &mut WsSender,
    opponent_tx: &mut WsSender,
) -> bool {
    match msg {
        Some(Ok(WsMessage::Text(text))) => {
            if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                // Run game logic
                let responses = handler::process_message(game, player_id, client_msg);
                for (target_id, server_msg) in responses {
                    if target_id == player_id {
                        send_msg(player_tx, &server_msg).await;
                    } else {
                        send_msg(opponent_tx, &server_msg).await;
                    }
                }

                // Send state updates to both players
                if let Some(update) = handler::build_state_update(game, player_id) {
                    send_msg(player_tx, &update).await;
                }
                if let Some(update) = handler::build_state_update(game, opponent_id) {
                    send_msg(opponent_tx, &update).await;
                }

                // Check for match end
                if let MatchStatus::Finished { ref winner_id } = game.status {
                    let winner_name = game
                        .get_player(winner_id)
                        .map(|p| p.name.clone())
                        .unwrap_or_default();
                    let end_msg = ServerMessage::MatchEnd {
                        winner: winner_name.clone(),
                    };
                    send_msg(player_tx, &end_msg).await;
                    send_msg(opponent_tx, &end_msg).await;
                    println!("Match ended! Winner: {}", winner_name);
                    return false;
                }
            }
            true
        }
        Some(Ok(WsMessage::Close(_))) | None => {
            send_msg(opponent_tx, &ServerMessage::OpponentDisconnected).await;
            println!("Player {} disconnected", player_id);
            false
        }
        _ => true,
    }
}
