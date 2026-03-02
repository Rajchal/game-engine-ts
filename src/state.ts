import {
    ACTOR_DIR_ROW,
    ACTOR_FRAME_MS,
    ACTOR_FRAMES,
    ACTOR_MOVE_GRACE_MS,
    ACTOR_PINGPONG,
    Dir,
    POS_LERP,
    TILE_PX,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from "./constants";
import { AnimState, DragonState, GameState, OpponentState, PlayerState } from "./types";

export const gameState: GameState = {
    world: null,
    you: { x: 0, y: 0, hp: 0, inv: [], dir: "Down" },
    opp: { x: 0, y: 0, hp: 0, invCount: 0, dir: "Down" },
    renderYou: { x: 0, y: 0 },
    renderOpp: { x: 0, y: 0 },
    dragon: null,
    minimapBase: null,
    anim: {
        you: { dir: "Down", moving: false, elapsed: 0, moveGraceMs: 0 },
        opp: { dir: "Down", moving: false, elapsed: 0, moveGraceMs: 0 },
    },
    prev: null,
};

export function resetForMatch(spawnX: number, spawnY: number) {
    gameState.you.x = spawnX;
    gameState.you.y = spawnY;
    gameState.you.hp = 0;
    gameState.you.inv = [];
    gameState.you.dir = "Down";

    gameState.opp.x = spawnX + 1;
    gameState.opp.y = spawnY;
    gameState.opp.hp = 0;
    gameState.opp.invCount = 0;
    gameState.opp.dir = "Down";

    gameState.renderYou.x = gameState.you.x;
    gameState.renderYou.y = gameState.you.y;
    gameState.renderOpp.x = gameState.opp.x;
    gameState.renderOpp.y = gameState.opp.y;
    gameState.dragon = null;
    gameState.minimapBase = null;
    gameState.anim.you = { dir: "Down", moving: false, elapsed: 0, moveGraceMs: 0 };
    gameState.anim.opp = { dir: "Down", moving: false, elapsed: 0, moveGraceMs: 0 };
    gameState.prev = {
        you: { x: gameState.you.x, y: gameState.you.y },
        opp: { x: gameState.opp.x, y: gameState.opp.y },
    };
}

export function setWorld(world: GameState["world"]) {
    gameState.world = world;
    gameState.minimapBase = null;
}

export function applyLocalMove(direction: Dir) {
    const prevX = gameState.you.x;
    const prevY = gameState.you.y;
    const { nx, ny } = nextPos(gameState.you.x, gameState.you.y, direction);

    if ((nx !== prevX || ny !== prevY) && !canOccupy(nx, ny)) {
        setAnim(gameState.anim.you, direction, false);
        return;
    }

    gameState.you.x = nx;
    gameState.you.y = ny;
    gameState.you.dir = direction;
    setAnim(gameState.anim.you, direction, nx !== prevX || ny !== prevY);
    if (gameState.prev) gameState.prev.you = { x: nx, y: ny };
}

export function applyStateUpdate(update: {
    your_x: number;
    your_y: number;
    your_hp: number;
    your_inventory: string[];
    opponent_x: number;
    opponent_y: number;
    opponent_hp: number;
    opponent_item_count: number;
    dragon_visible: boolean;
    dragon_x: number | null;
    dragon_y: number | null;
    dragon_width: number | null;
    dragon_height: number | null;
    dragon_hp: number | null;
}) {
    const prevYou = { x: gameState.you.x, y: gameState.you.y };
    const prevOpp = { x: gameState.opp.x, y: gameState.opp.y };

    gameState.you.x = update.your_x;
    gameState.you.y = update.your_y;
    gameState.you.hp = update.your_hp;
    gameState.you.inv = update.your_inventory;

    gameState.opp.x = update.opponent_x;
    gameState.opp.y = update.opponent_y;
    gameState.opp.hp = update.opponent_hp;
    gameState.opp.invCount = update.opponent_item_count;

    const youDir = dirFromDelta(prevYou.x, prevYou.y, gameState.you.x, gameState.you.y, gameState.you.dir);
    const oppDir = dirFromDelta(prevOpp.x, prevOpp.y, gameState.opp.x, gameState.opp.y, gameState.opp.dir);

    gameState.you.dir = youDir;
    gameState.opp.dir = oppDir;

    setAnim(gameState.anim.you, youDir, moved(prevYou, gameState.you));
    setAnim(gameState.anim.opp, oppDir, moved(prevOpp, gameState.opp));

    if (update.dragon_visible && update.dragon_x != null && update.dragon_y != null) {
        gameState.dragon = {
            x: update.dragon_x,
            y: update.dragon_y,
            w: update.dragon_width ?? 1,
            h: update.dragon_height ?? 1,
            hp: update.dragon_hp ?? 0,
        } as DragonState;
    }

    gameState.prev = {
        you: { x: gameState.you.x, y: gameState.you.y },
        opp: { x: gameState.opp.x, y: gameState.opp.y },
    };
}

export function tickState(dtMs: number) {
    // Interpolate render positions
    const lerp = POS_LERP;
    gameState.renderYou.x = smoothApproach(gameState.renderYou.x, gameState.you.x, lerp);
    gameState.renderYou.y = smoothApproach(gameState.renderYou.y, gameState.you.y, lerp);
    gameState.renderOpp.x = smoothApproach(gameState.renderOpp.x, gameState.opp.x, lerp);
    gameState.renderOpp.y = smoothApproach(gameState.renderOpp.y, gameState.opp.y, lerp);

    // Animation advance
    advanceAnim(gameState.anim.you, isMoving(gameState.renderYou, gameState.you), dtMs);
    advanceAnim(gameState.anim.opp, isMoving(gameState.renderOpp, gameState.opp), dtMs);
}

export function currentFrame(anim: AnimState) {
    if (!anim.moving) return 1; // idle frame (middle)
    const step = Math.floor(anim.elapsed / ACTOR_FRAME_MS);
    if (ACTOR_PINGPONG && ACTOR_FRAMES > 1) {
        const period = ACTOR_FRAMES * 2 - 2; // e.g., 3 frames => 0 1 2 1
        const idx = step % period;
        return idx < ACTOR_FRAMES ? idx : period - idx;
    }
    return step % ACTOR_FRAMES;
}

export function directionRow(anim: AnimState) {
    return ACTOR_DIR_ROW[anim.dir];
}

function isMoving(renderPos: { x: number; y: number }, target: { x: number; y: number }) {
    return Math.abs(renderPos.x - target.x) > 0.05 || Math.abs(renderPos.y - target.y) > 0.05;
}

function advanceAnim(anim: AnimState, moving: boolean, dtMs: number) {
    const shouldAnimate = moving || anim.moveGraceMs > 0;
    if (shouldAnimate) {
        anim.elapsed += dtMs;
        anim.moving = true;
        if (moving) anim.moveGraceMs = ACTOR_MOVE_GRACE_MS;
        else anim.moveGraceMs = Math.max(0, anim.moveGraceMs - dtMs);
    } else {
        anim.elapsed = 0;
        anim.moving = false;
        anim.moveGraceMs = 0;
    }
}

function setAnim(anim: AnimState, dir: Dir, moving: boolean) {
    anim.dir = dir;
    if (moving) {
        anim.moving = true;
        anim.moveGraceMs = ACTOR_MOVE_GRACE_MS;
    } else {
        anim.moving = false;
    }
}

function dirFromDelta(px: number, py: number, x: number, y: number, fallback: Dir): Dir {
    const dx = x - px;
    const dy = y - py;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) return "Right";
        if (dx < 0) return "Left";
    } else if (Math.abs(dy) > 0) {
        if (dy > 0) return "Down";
        if (dy < 0) return "Up";
    }
    return fallback;
}

function moved(a: { x: number; y: number }, b: { x: number; y: number }) {
    return a.x !== b.x || a.y !== b.y;
}

function nextPos(x: number, y: number, dir: Dir) {
    const dx = dir === "Left" ? -1 : dir === "Right" ? 1 : 0;
    const dy = dir === "Up" ? -1 : dir === "Down" ? 1 : 0;
    const nx = clamp(x + dx, 0, WORLD_WIDTH - 1);
    const ny = clamp(y + dy, 0, WORLD_HEIGHT - 1);
    return { nx, ny };
}

function canOccupy(x: number, y: number) {
    const tile = gameState.world?.[y]?.[x];
    if (!tile) return true;
    return tile !== "Wall" && tile !== "Water";
}

function smoothApproach(current: number, target: number, lerp: number) {
    const next = current + (target - current) * lerp;
    return Math.abs(target - next) < 0.12 ? target : next;
}

function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v));
}
