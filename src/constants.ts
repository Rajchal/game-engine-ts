export type TileType = "Grass" | "Water" | "Wall" | "Forest" | "Sand";
export type Dir = "Up" | "Down" | "Left" | "Right";

export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 100;
export const VIEWPORT_TILES_X = 40;
export const VIEWPORT_TILES_Y = 22;
export const TILE_PX = 16;
export const VIEWPORT_WIDTH_PX = VIEWPORT_TILES_X * TILE_PX;
export const VIEWPORT_HEIGHT_PX = VIEWPORT_TILES_Y * TILE_PX;

export const MOVE_REPEAT_MS = 120;
export const ATTACK_COOLDOWN_MS = 120;
export const POS_LERP = 0.2;

export const TILE_COLORS: Record<TileType, string> = {
    Grass: "#2d8a4e",
    Water: "#1d8cd6",
    Wall: "#8b95a5",
    Forest: "#1b7a3d",
    Sand: "#dbb544",
};

export const TILE_CHAR: Record<string, TileType> = {
    G: "Grass",
    W: "Water",
    L: "Wall",
    F: "Forest",
    S: "Sand",
};

export const SPRITE_PX = 16;
export const TILE_SPRITE_PATH = "./sprites/tiles.png";
export const ACTOR_SPRITE_PATH = "./sprites/actors.png";
export const ACTOR_FRAMES = 3;
export const ACTOR_FRAME_MS = 140;
export const ACTOR_DIR_ROW: Record<Dir, number> = {
    Down: 0,
    Left: 1,
    Right: 2,
    Up: 3,
};
