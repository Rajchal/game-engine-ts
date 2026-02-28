use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::game::items::Item;

/// A player in a match.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub hp: u32,
    pub max_hp: u32,
    pub inventory: HashSet<Item>,
    pub dragon_killed: bool,
}

impl Player {
    pub fn new(id: String, name: String, x: i32, y: i32, hp: u32) -> Self {
        Player {
            id,
            name,
            x,
            y,
            hp,
            max_hp: hp,
            inventory: HashSet::new(),
            dragon_killed: false,
        }
    }

    /// Whether the player has all three holy items.
    pub fn has_all_items(&self) -> bool {
        self.inventory.contains(&Item::HolySword)
            && self.inventory.contains(&Item::HolyArmor)
            && self.inventory.contains(&Item::DragonMap)
    }

    pub fn has_sword(&self) -> bool {
        self.inventory.contains(&Item::HolySword)
    }

    pub fn has_armor(&self) -> bool {
        self.inventory.contains(&Item::HolyArmor)
    }

    pub fn pick_up(&mut self, item: Item) {
        self.inventory.insert(item);
    }

    pub fn take_damage(&mut self, amount: u32) {
        if amount >= self.hp {
            self.hp = 0;
        } else {
            self.hp -= amount;
        }
    }

    pub fn is_alive(&self) -> bool {
        self.hp > 0
    }
}
