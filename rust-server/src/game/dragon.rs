/// The dragon boss that players race to defeat.
#[derive(Debug, Clone)]
pub struct Dragon {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub hp: u32,
    pub max_hp: u32,
    pub damage: u32,
}

impl Dragon {
    pub fn new(x: i32, y: i32, width: u32, height: u32, hp: u32, damage: u32) -> Self {
        Dragon {
            x,
            y,
            width,
            height,
            hp,
            max_hp: hp,
            damage,
        }
    }

    /// Deal damage to the dragon. Returns true if the dragon dies.
    pub fn take_damage(&mut self, amount: u32) -> bool {
        if amount >= self.hp {
            self.hp = 0;
            true
        } else {
            self.hp -= amount;
            false
        }
    }

    pub fn is_alive(&self) -> bool {
        self.hp > 0
    }

    /// True if the given tile lies within the dragon's footprint.
    pub fn contains(&self, tx: i32, ty: i32) -> bool {
        let w = self.width as i32;
        let h = self.height as i32;
        tx >= self.x && tx < self.x + w && ty >= self.y && ty < self.y + h
    }
}
