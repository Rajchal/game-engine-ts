import {
    ACTOR_DIR_ROW,
    DRAGON_FRAMES,
    DRAGON_FRAME_MS,
    DRAGON_PINGPONG,
    Dir,
    DRAGON_TILES_H,
    DRAGON_TILES_W,
    SPRITE_PX,
    TILE_COLORS,
    TILE_PX,
    VIEWPORT_HEIGHT_PX,
    VIEWPORT_TILES_X,
    VIEWPORT_TILES_Y,
    VIEWPORT_WIDTH_PX,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from "./constants";
import { currentFrame, directionRow, gameState } from "./state";
import { Controls } from "./types";
import { SpriteSheets, drawActorFrame, drawDragonFrame } from "./sprites";

let renderScale = 1;
let minimapScale = 1;
const ACTOR_DRAW_W = TILE_PX;
const ACTOR_DRAW_H = 24;
const ACTOR_HEAD_GAP = ACTOR_DRAW_H - TILE_PX;

export function resizeCanvases(controls: Controls) {
    const dpr = window.devicePixelRatio || 1;
    const maxFit = Math.min(window.innerWidth / VIEWPORT_WIDTH_PX, window.innerHeight / VIEWPORT_HEIGHT_PX);
    renderScale = Math.max(1, Math.min(Math.floor(maxFit), 3));

    controls.canvas.width = Math.round(VIEWPORT_WIDTH_PX * dpr * renderScale);
    controls.canvas.height = Math.round(VIEWPORT_HEIGHT_PX * dpr * renderScale);
    controls.canvas.style.width = `${VIEWPORT_WIDTH_PX * renderScale}px`;
    controls.canvas.style.height = `${VIEWPORT_HEIGHT_PX * renderScale}px`;

    // Minimap
    minimapScale = renderScale;
    const baseSize = 200;
    controls.minimap.width = Math.round(baseSize * dpr * minimapScale);
    controls.minimap.height = Math.round(baseSize * dpr * minimapScale);
    controls.minimap.style.width = `${baseSize * minimapScale}px`;
    controls.minimap.style.height = `${baseSize * minimapScale}px`;
    gameState.minimapBase = null;
}

export function draw(controls: Controls, sprites: SpriteSheets) {
    if (!gameState.world) return;
    const c = controls.canvas;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(renderScale * dpr, 0, 0, renderScale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const tilesX = VIEWPORT_TILES_X;
    const tilesY = VIEWPORT_TILES_Y;

    const camX = Math.floor(gameState.renderYou.x) - Math.floor(tilesX / 2);
    const camY = Math.floor(gameState.renderYou.y) - Math.floor(tilesY / 2);

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH_PX, VIEWPORT_HEIGHT_PX);

    for (let r = 0; r < tilesY; r++) {
        for (let col = 0; col < tilesX; col++) {
            const wx = camX + col;
            const wy = camY + r;
            if (!gameState.world[0] || wx < 0 || wy < 0 || wy >= gameState.world.length || wx >= gameState.world[0].length)
                continue;
            const tile = gameState.world[wy][wx];
            if (sprites.readyTiles && sprites.tiles) {
                const map = tileSprite(tile);
                if (map) {
                    ctx.drawImage(
                        sprites.tiles,
                        map.sx * SPRITE_PX,
                        map.sy * SPRITE_PX,
                        SPRITE_PX,
                        SPRITE_PX,
                        col * TILE_PX,
                        r * TILE_PX,
                        TILE_PX,
                        TILE_PX,
                    );
                    continue;
                }
            }
            ctx.fillStyle = TILE_COLORS[tile] ?? "#333";
            ctx.fillRect(col * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX);
        }
    }

    if (gameState.dragon) {
        const dx = (gameState.dragon.x - camX) * TILE_PX;
        const dy = (gameState.dragon.y - camY) * TILE_PX;
        const dw = gameState.dragon.w * TILE_PX || DRAGON_TILES_W * TILE_PX;
        const dh = gameState.dragon.h * TILE_PX || DRAGON_TILES_H * TILE_PX;
        const dragonDir = dragonFacingPlayer();
        const frame = currentDragonFrame();
        const row = ACTOR_DIR_ROW[dragonDir];
        const drawn = drawDragonFrame(ctx, sprites, frame, row, dx, dy, dw, dh);
        if (!drawn && sprites.readyDragon && sprites.dragon) {
            ctx.drawImage(sprites.dragon, 0, 0, sprites.dragon.width, sprites.dragon.height, dx, dy, dw, dh);
        } else if (!drawn) {
            ctx.fillStyle = "rgba(220,38,38,0.45)";
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.strokeRect(dx, dy, dw, dh);
        }
    }

    drawOpponent(ctx, sprites, camX, camY);
    drawYou(ctx, sprites, camX, camY);

    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("YOU", (gameState.renderYou.x - camX) * TILE_PX, (gameState.renderYou.y - camY) * TILE_PX - TILE_PX - 2);

    drawMiniMap(controls, sprites);
}

function currentDragonFrame() {
    if (DRAGON_FRAMES <= 1) return 0;
    const step = Math.floor(performance.now() / DRAGON_FRAME_MS);
    if (!DRAGON_PINGPONG) return step % DRAGON_FRAMES;
    const period = DRAGON_FRAMES * 2 - 2;
    const idx = step % period;
    return idx < DRAGON_FRAMES ? idx : period - idx;
}

function dragonFacingPlayer(): Dir {
    if (!gameState.dragon) return "Down";
    const dragonCenterX = gameState.dragon.x + gameState.dragon.w / 2;
    const dragonCenterY = gameState.dragon.y + gameState.dragon.h / 2;
    const dx = gameState.you.x - dragonCenterX;
    const dy = gameState.you.y - dragonCenterY;

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx >= 0 ? "Right" : "Left";
    }
    return dy >= 0 ? "Down" : "Up";
}

function drawYou(ctx: CanvasRenderingContext2D, sprites: SpriteSheets, camX: number, camY: number) {
    const frame = currentFrame(gameState.anim.you);
    const row = directionRow(gameState.anim.you);
    const drawX = (gameState.renderYou.x - camX) * TILE_PX;
    const drawY = (gameState.renderYou.y - camY) * TILE_PX - ACTOR_HEAD_GAP;
    const drawn = drawActorFrame(
        ctx,
        sprites,
        frame,
        row,
        drawX,
        drawY,
        ACTOR_DRAW_W,
        ACTOR_DRAW_H,
    );
    if (!drawn) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(drawX, drawY, ACTOR_DRAW_W, ACTOR_DRAW_H);
    }
}

function drawOpponent(ctx: CanvasRenderingContext2D, sprites: SpriteSheets, camX: number, camY: number) {
    const frame = currentFrame(gameState.anim.opp);
    const row = directionRow(gameState.anim.opp);
    const drawX = (gameState.renderOpp.x - camX) * TILE_PX;
    const drawY = (gameState.renderOpp.y - camY) * TILE_PX - ACTOR_HEAD_GAP;
    const drawn = drawActorFrame(
        ctx,
        sprites,
        frame,
        row,
        drawX,
        drawY,
        ACTOR_DRAW_W,
        ACTOR_DRAW_H,
    );
    if (!drawn) {
        ctx.fillStyle = "#a855f7";
        ctx.fillRect(drawX, drawY, ACTOR_DRAW_W, ACTOR_DRAW_H);
    }
}

function drawMiniMap(controls: Controls, sprites: SpriteSheets) {
    if (!gameState.world) return;
    const ctx = controls.minimap.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const mw = controls.minimap.width;
    const mh = controls.minimap.height;
    if (!gameState.minimapBase) buildMinimapBase(mw, mh);

    if (gameState.minimapBase) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(gameState.minimapBase, 0, 0, mw, mh);
    } else {
        ctx.fillStyle = "#0f131a";
        ctx.fillRect(0, 0, mw, mh);
    }

    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;

    if (gameState.dragon) {
        ctx.fillStyle = "rgba(239,68,68,0.8)";
        ctx.fillRect(gameState.dragon.x * sx, gameState.dragon.y * sy, Math.max(1, gameState.dragon.w * sx), Math.max(1, gameState.dragon.h * sy));
    }

    ctx.fillStyle = "#a855f7";
    ctx.fillRect(gameState.opp.x * sx, gameState.opp.y * sy, Math.max(2, sx), Math.max(2, sy * 2));

    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(gameState.you.x * sx, gameState.you.y * sy, Math.max(2, sx), Math.max(2, sy * 2));
}

function buildMinimapBase(mw: number, mh: number) {
    if (!gameState.world) return;
    const base = document.createElement("canvas");
    base.width = mw;
    base.height = mh;
    const ctx = base.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    ctx.fillStyle = "#0f131a";
    ctx.fillRect(0, 0, mw, mh);

    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            const tile = gameState.world[y]?.[x] ?? "Grass";
            ctx.fillStyle = TILE_COLORS[tile] ?? "#333";
            ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        }
    }

    gameState.minimapBase = base;
}

function tileSprite(tile: string) {
    const map: Record<string, { sx: number; sy: number }> = {
        // Sheet columns: 0=Water, 1=Sand, 2=Grass, 3=Wall, 4=Forest (row 0)
        Water: { sx: 1, sy: 0 },
        Sand: { sx: 4, sy: 0 },
        Grass: { sx: 0, sy: 0 },
        Wall: { sx: 2, sy: 0 },
        Forest: { sx: 3, sy: 0 },
    };
    return map[tile];
}
