use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

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
    /// Generate a world deterministically from a seed.
    /// Both the Rust server and the TypeScript client can reproduce
    /// the same tile grid from the same seed using the same algorithm.
    pub fn generate(seed: u64, width: u32, height: u32) -> Self {
        let mut rng = StdRng::seed_from_u64(seed);
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
    pub fn place_items(&self, rng: &mut StdRng) -> Vec<ItemSpawn> {
        let spawn_x = self.width as i32 / 2;
        let spawn_y = self.height as i32 / 2;
        let mut spawns = Vec::new();

        for item in Item::all() {
            loop {
                let x = rng.gen_range(0..self.width as i32);
                let y = rng.gen_range(0..self.height as i32);
                let dist = (((x - spawn_x).pow(2) + (y - spawn_y).pow(2)) as f32).sqrt();
                if self.is_walkable(x, y) && dist > 10.0 {
                    let too_close = spawns.iter().any(|s: &ItemSpawn| {
                        (((x - s.x).pow(2) + (y - s.y).pow(2)) as f32).sqrt() < 5.0
                    });
                    if !too_close {
                        spawns.push(ItemSpawn { item, x, y });
                        break;
                    }
                }
            }
        }

        spawns
    }

    /// Place the dragon on a walkable tile far from spawn (at least 40 tiles).
    pub fn place_dragon(&self, rng: &mut StdRng) -> (i32, i32) {
        let spawn_x = self.width as i32 / 2;
        let spawn_y = self.height as i32 / 2;
        loop {
            let x = rng.gen_range(0..self.width as i32);
            let y = rng.gen_range(0..self.height as i32);
            let dist = (((x - spawn_x).pow(2) + (y - spawn_y).pow(2)) as f32).sqrt();
            if self.is_walkable(x, y) && dist > 40.0 {
                return (x, y);
            }
        }
    }

    /// Spawn positions for the 2 players (near center, side by side).
    pub fn get_spawn_positions(&self) -> [(i32, i32); 2] {
        let cx = self.width as i32 / 2;
        let cy = self.height as i32 / 2;
        [(cx - 1, cy), (cx + 1, cy)]
    }
}
