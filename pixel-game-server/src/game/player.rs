struct Player {
    pub id: u32,
    pub position: (f32, f32),
    pub health: u32,
}

impl Player {
    pub fn new(id: u32, position: (f32, f32), health: u32) -> Self {
        Player { id, position, health }
    }

    pub fn move_to(&mut self, new_position: (f32, f32)) {
        self.position = new_position;
    }

    pub fn take_damage(&mut self, amount: u32) {
        if amount >= self.health {
            self.health = 0;
        } else {
            self.health -= amount;
        }
    }

    pub fn is_alive(&self) -> bool {
        self.health > 0
    }
}