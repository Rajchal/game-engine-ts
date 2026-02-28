use rand::SeedableRng;
use rand_chacha::ChaCha12Rng;

use crate::config::GameConfig;
use crate::game::dragon::Dragon;
use crate::game::items::{Item, ItemSpawn};
use crate::game::player::Player;
use crate::game::world::World;

/// Current status of a match.
#[derive(Debug, Clone, PartialEq)]
pub enum MatchStatus {
    Active,
    Finished { winner_id: String },
}

/// The complete state of a single 2-player match.
pub struct GameMatch {
    pub seed: u64,
    pub world: World,
    pub players: Vec<Player>,
    pub dragon: Dragon,
    pub items: Vec<ItemSpawn>,
    pub status: MatchStatus,
    pub config: GameConfig,
}

impl GameMatch {
    fn chacha_from_seed(seed: u64) -> ChaCha12Rng {
        let mut seed_bytes = [0u8; 32];
        seed_bytes[..8].copy_from_slice(&seed.to_le_bytes());
        ChaCha12Rng::from_seed(seed_bytes)
    }

    /// Create a new match between two players.
    pub fn new(
        p1_id: String,
        p1_name: String,
        p2_id: String,
        p2_name: String,
        config: &GameConfig,
    ) -> Self {
        let seed: u64 = rand::random();
        let world = World::generate(seed, config.world_width, config.world_height);

        // Use a separate RNG stream for secret placement (items + dragon)
        let mut rng = Self::chacha_from_seed(seed.wrapping_add(1));
        let items = world.place_items(&mut rng);
        let (dragon_x, dragon_y) = world.place_dragon(&mut rng);
        let dragon = Dragon::new(dragon_x, dragon_y, config.dragon_hp, config.dragon_damage);

        let spawns = world.get_spawn_positions();
        let p1 = Player::new(p1_id, p1_name, spawns[0].0, spawns[0].1, config.player_hp);
        let p2 = Player::new(p2_id, p2_name, spawns[1].0, spawns[1].1, config.player_hp);

        GameMatch {
            seed,
            world,
            players: vec![p1, p2],
            dragon,
            items,
            status: MatchStatus::Active,
            config: config.clone(),
        }
    }

    pub fn get_player(&self, id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == id)
    }

    pub fn get_player_mut(&mut self, id: &str) -> Option<&mut Player> {
        self.players.iter_mut().find(|p| p.id == id)
    }

    pub fn get_opponent(&self, id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id != id)
    }

    /// Try to move a player one tile in (dx, dy). Returns true if the move was valid.
    pub fn try_move(&mut self, player_id: &str, dx: i32, dy: i32) -> bool {
        let player = match self.get_player(player_id) {
            Some(p) => p,
            None => return false,
        };
        let new_x = player.x + dx;
        let new_y = player.y + dy;

        if !self.world.is_walkable(new_x, new_y) {
            return false;
        }

        let player = self.get_player_mut(player_id).unwrap();
        player.x = new_x;
        player.y = new_y;
        true
    }

    /// Check if the player is standing on an item and pick it up.
    /// Items are per-player: both players can collect the same item independently.
    pub fn check_item_pickup(&mut self, player_id: &str) -> Option<Item> {
        let player = self.get_player(player_id)?;
        let px = player.x;
        let py = player.y;

        let item = self
            .items
            .iter()
            .find(|i| i.x == px && i.y == py)
            .map(|i| i.item);

        if let Some(item) = item {
            let player = self.get_player_mut(player_id)?;
            if !player.inventory.contains(&item) {
                player.pick_up(item);
                return Some(item);
            }
        }

        None
    }

    /// Player attacks the dragon.
    /// Returns `Some((damage_dealt, damage_taken, dragon_dead))` or `None` if attack is invalid.
    pub fn attack_dragon(&mut self, player_id: &str) -> Option<(u32, u32, bool)> {
        // --- Check preconditions (immutable borrow) ---
        {
            let player = self.get_player(player_id)?;
            if !player.has_all_items() {
                return None;
            }
            let dist_x = (player.x - self.dragon.x).abs();
            let dist_y = (player.y - self.dragon.y).abs();
            if dist_x > 1 || dist_y > 1 {
                return None;
            }
        }

        // --- Player attacks dragon ---
        let damage = self.config.sword_damage;
        let dragon_dead = self.dragon.take_damage(damage);

        // --- Dragon attacks back ---
        let has_armor = self
            .get_player(player_id)
            .map(|p| p.has_armor())
            .unwrap_or(false);
        let reduction = if has_armor {
            self.config.armor_reduction
        } else {
            0
        };
        let actual_dmg = self.dragon.damage.saturating_sub(reduction);

        // --- Apply damage to player ---
        {
            let player = self.get_player_mut(player_id)?;
            player.take_damage(actual_dmg);
            if dragon_dead {
                player.dragon_killed = true;
            }
        }

        // --- Determine match outcome ---
        let player_alive = self
            .get_player(player_id)
            .map(|p| p.is_alive())
            .unwrap_or(false);

        if dragon_dead {
            // Player killed the dragon — they win (even if they also died)
            self.status = MatchStatus::Finished {
                winner_id: player_id.to_string(),
            };
        } else if !player_alive {
            // Player died to the dragon — opponent wins
            let opponent_id = self.get_opponent(player_id).map(|p| p.id.clone());
            if let Some(opp_id) = opponent_id {
                self.status = MatchStatus::Finished { winner_id: opp_id };
            }
        }

        Some((damage, actual_dmg, dragon_dead))
    }
}
