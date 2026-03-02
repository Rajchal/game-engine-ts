import {
    ACTOR_SPRITE_PATH,
    DRAGON_FRAMES,
    DRAGON_SPRITE_PATH,
    DRAGON_TILES_H,
    DRAGON_TILES_W,
    SPRITE_PX,
    TILE_SPRITE_PATH,
} from "./constants";

export interface SpriteSheets {
    tiles: HTMLImageElement | null;
    actors: HTMLImageElement | null;
    dragon: HTMLImageElement | null;
    readyTiles: boolean;
    readyActors: boolean;
    readyDragon: boolean;
}

export const spriteSheets: SpriteSheets = {
    tiles: null,
    actors: null,
    dragon: null,
    readyTiles: false,
    readyActors: false,
    readyDragon: false,
};

export function loadSprites(onReady?: () => void) {
    loadOne(TILE_SPRITE_PATH, img => {
        spriteSheets.tiles = img;
        spriteSheets.readyTiles = true;
        onReady?.();
    });

    loadOne(ACTOR_SPRITE_PATH, img => {
        spriteSheets.actors = img;
        spriteSheets.readyActors = true;
        onReady?.();
    });

    loadOne(DRAGON_SPRITE_PATH, img => {
        spriteSheets.dragon = img;
        spriteSheets.readyDragon = true;
        onReady?.();
    });
}

function loadOne(src: string, done: (img: HTMLImageElement) => void) {
    const img = new Image();
    img.src = src;
    img.onload = () => done(img);
    img.onerror = () => {
        console.warn("Sprite sheet not found at", src, "— falling back to colors");
    };
}

export function drawActorFrame(
    ctx: CanvasRenderingContext2D,
    sprites: SpriteSheets,
    frame: number,
    row: number,
    dx: number,
    dy: number,
    w: number,
    h: number,
) {
    if (!sprites.readyActors || !sprites.actors) return false;
    ctx.drawImage(sprites.actors, frame * SPRITE_PX, row * SPRITE_PX, SPRITE_PX, SPRITE_PX, dx, dy, w, h);
    return true;
}

export function drawDragonFrame(
    ctx: CanvasRenderingContext2D,
    sprites: SpriteSheets,
    frame: number,
    row: number,
    dx: number,
    dy: number,
    w: number,
    h: number,
) {
    if (!sprites.readyDragon || !sprites.dragon) return false;
    const srcW = DRAGON_TILES_W * SPRITE_PX;
    const srcH = DRAGON_TILES_H * SPRITE_PX;
    const needW = srcW * DRAGON_FRAMES;
    const needH = srcH * 4;
    if (sprites.dragon.width < needW || sprites.dragon.height < needH) return false;

    ctx.drawImage(sprites.dragon, frame * srcW, row * srcH, srcW, srcH, dx, dy, w, h);
    return true;
}
