use rand::{seq::SliceRandom, Rng, SeedableRng};
use rand_chacha::ChaCha12Rng;

use crate::game::items::{Item, ItemSpawn};
use crate::game::tile::TileType;

/// The game world — a 2D grid of tiles generated from a seed.
pub struct World {
    pub width: u32,
    pub height: u32,
    pub seed: u64,
    pub tiles: Vec<Vec<TileType>>,
}

impl World {
    fn chacha_from_seed(seed: u64) -> ChaCha12Rng {
        let mut seed_bytes = [0u8; 32];
        seed_bytes[..8].copy_from_slice(&seed.to_le_bytes());
        ChaCha12Rng::from_seed(seed_bytes)
    }

    /// Generate a world deterministically from a seed.
    /// Both the Rust server and the TypeScript client can reproduce
    /// the same tile grid from the same seed using the same algorithm.
    pub fn generate(seed: u64, width: u32, height: u32) -> Self {
        let mut rng = Self::chacha_from_seed(seed);
        let mut tiles = vec![vec![TileType::Grass; width as usize]; height as usize];

        // --- Water bodies ---
        for _ in 0..8 {
            let cx = rng.gen_range(5..width as i32 - 5);
            let cy = rng.gen_range(5..height as i32 - 5);
            let radius = rng.gen_range(3..8);
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if nx >= 0
                        && nx < width as i32
                        && ny >= 0
                        && ny < height as i32
                        && dx * dx + dy * dy <= radius * radius
                    {
                        tiles[ny as usize][nx as usize] = TileType::Water;
                    }
                }
            }
        }

        // --- Wall clusters (mountains) ---
        for _ in 0..6 {
            let cx = rng.gen_range(5..width as i32 - 5);
            let cy = rng.gen_range(5..height as i32 - 5);
            let size = rng.gen_range(2..6);
            for dy in -size..=size {
                for dx in -size..=size {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if nx >= 0
                        && nx < width as i32
                        && ny >= 0
                        && ny < height as i32
                        && rng.gen_bool(0.6)
                    {
                        tiles[ny as usize][nx as usize] = TileType::Wall;
                    }
                }
            }
        }

        // --- Forest patches ---
        for _ in 0..10 {
            let cx = rng.gen_range(3..width as i32 - 3);
            let cy = rng.gen_range(3..height as i32 - 3);
            let radius = rng.gen_range(2..5);
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if nx >= 0
                        && nx < width as i32
                        && ny >= 0
                        && ny < height as i32
                        && tiles[ny as usize][nx as usize] == TileType::Grass
                        && rng.gen_bool(0.7)
                    {
                        tiles[ny as usize][nx as usize] = TileType::Forest;
                    }
                }
            }
        }

        // --- Clear spawn area around center ---
        let cx = width as i32 / 2;
        let cy = height as i32 / 2;
        for dy in -3..=3 {
            for dx in -3..=3 {
                let nx = cx + dx;
                let ny = cy + dy;
                if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                    tiles[ny as usize][nx as usize] = TileType::Grass;
                }
            }
        }

        World {
            width,
            height,
            seed,
            tiles,
        }
    }

    /// Check if a tile coordinate is walkable.
    pub fn is_walkable(&self, x: i32, y: i32) -> bool {
        if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
            return false;
        }
        self.tiles[y as usize][x as usize].is_walkable()
    }

    /// Get the tile type at a coordinate.
    pub fn get_tile(&self, x: i32, y: i32) -> Option<TileType> {
        if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
            return None;
        }
        Some(self.tiles[y as usize][x as usize])
    }

    /// Place the three holy items on random walkable tiles, at least 10 tiles from spawn.
    pub fn place_items<R: Rng + ?Sized>(&self, rng: &mut R) -> Vec<ItemSpawn> {
        let spawn_x = self.width as i32 / 2;
        let spawn_y = self.height as i32 / 2;
        let mut spawns = Vec::new();

        // Precompute candidates so we don't loop forever if forests are sparse.
        let mut forest_candidates = Vec::new();
        let mut walkable_candidates = Vec::new();

        for y in 0..self.height as i32 {
            for x in 0..self.width as i32 {
                let dist2 = (x - spawn_x).pow(2) + (y - spawn_y).pow(2);
                if dist2 <= 100 {
                    continue; // keep items away from spawn (dist > 10)
                }
                if !self.is_walkable(x, y) {
                    continue;
                }
                walkable_candidates.push((x, y));
                if self.tiles[y as usize][x as usize] == TileType::Forest {
                    forest_candidates.push((x, y));
                }
            }
        }

        // Fallback to any walkable tiles if no forests exist (should be rare).
        let primary = if forest_candidates.is_empty() {
            &walkable_candidates
        } else {
            &forest_candidates
        };

        for item in Item::all() {
            let mut chosen = None;

            // Shuffle view of candidates to vary placement across items.
            let mut shuffled = primary.clone();
            shuffled.shuffle(rng);

            for (x, y) in shuffled {
                let too_close = spawns.iter().any(|s: &ItemSpawn| {
                    let dx = x - s.x;
                    let dy = y - s.y;
                    dx * dx + dy * dy < 25 // keep items at least 5 tiles apart
                });

                if !too_close {
                    chosen = Some((x, y));
                    break;
                }
            }

            // If forests were too cramped, fall back to any walkable tile.
            if chosen.is_none() && primary.len() != walkable_candidates.len() {
                let mut shuffled = walkable_candidates.clone();
                shuffled.shuffle(rng);
                for (x, y) in shuffled {
                    let too_close = spawns.iter().any(|s: &ItemSpawn| {
                        let dx = x - s.x;
                        let dy = y - s.y;
                        dx * dx + dy * dy < 25
                    });
                    if !too_close {
                        chosen = Some((x, y));
                        break;
                    }
                }
            }

            if let Some((x, y)) = chosen {
                spawns.push(ItemSpawn { item, x, y });
            }
        }

        spawns
    }

    /// Place the dragon on a walkable tile far from spawn (at least 40 tiles).
    pub fn place_dragon<R: Rng + ?Sized>(&self, rng: &mut R, size: u32) -> (i32, i32) {
        let spawn_x = self.width as i32 / 2;
        let spawn_y = self.height as i32 / 2;
        let size_i = size as i32;

        loop {
            let max_x = self.width as i32 - size_i;
            let max_y = self.height as i32 - size_i;
            let x = rng.gen_range(0..=max_x);
            let y = rng.gen_range(0..=max_y);

            // Check footprint is fully walkable.
            let mut all_walkable = true;
            'outer: for dy in 0..size_i {
                for dx in 0..size_i {
                    if !self.is_walkable(x + dx, y + dy) {
                        all_walkable = false;
                        break 'outer;
                    }
                }
            }
            if !all_walkable {
                continue;
            }

            // Keep dragon far from spawn (use center of footprint).
            let center_x = x + size_i / 2;
            let center_y = y + size_i / 2;
            let dist = (((center_x - spawn_x).pow(2) + (center_y - spawn_y).pow(2)) as f32).sqrt();
            if dist > 40.0 {
                return (x, y);
            }
        }
    }

    /// Serialize the tile grid to a compact string (one char per tile).
    /// G=Grass, W=Water, L=Wall, F=Forest, S=Sand. Row-major order.
    pub fn tiles_compact(&self) -> String {
        let mut s = String::with_capacity((self.width * self.height) as usize);
        for row in &self.tiles {
            for tile in row {
                s.push(match tile {
                    TileType::Grass => 'G',
                    TileType::Water => 'W',
                    TileType::Wall => 'L',
                    TileType::Forest => 'F',
                    TileType::Sand => 'S',
                });
            }
        }
        s
    }

    /// Spawn positions for the 2 players (near center, side by side).
    pub fn get_spawn_positions(&self) -> [(i32, i32); 2] {
        let cx = self.width as i32 / 2;
        let cy = self.height as i32 / 2;
        [(cx - 1, cy), (cx + 1, cy)]
    }
}
