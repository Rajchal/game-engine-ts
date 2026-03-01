type TileType = "Grass" | "Water" | "Wall" | "Forest" | "Sand";

interface Controls {
    urlInput: HTMLInputElement;
    nameInput: HTMLInputElement;
    connectBtn: HTMLButtonElement;
    status: HTMLElement;
    overlay: HTMLElement;
    canvas: HTMLCanvasElement;
}

interface DragonState {
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
}

interface ServerMatchStart {
    type: "MatchStart";
    seed: number;
    world_width: number;
    world_height: number;
    spawn_x: number;
    spawn_y: number;
    opponent_name: string;
    tiles?: string; // optional to defend against older servers
}

interface ServerStateUpdate {
    type: "StateUpdate";
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
}

interface ServerDragonRevealed {
    type: "DragonRevealed";
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ServerAttackResult {
    type: "AttackResult";
    damage_dealt: number;
    damage_taken: number;
    your_hp: number;
    dragon_hp: number;
}

interface ServerMoveDenied {
    type: "MoveDenied";
    reason: string;
}

interface ServerItemPickedUp {
    type: "ItemPickedUp";
    item: string;
}

interface ServerMatchEnd {
    type: "MatchEnd";
    winner: string;
}

interface ServerErrorMsg {
    type: "Error";
    message: string;
}

interface ServerWelcome {
    type: "Welcome";
    player_id: string;
}

interface ServerWaiting {
    type: "WaitingForOpponent";
}

interface ServerOpponentDisconnected {
    type: "OpponentDisconnected";
}

type ServerMessage =
    | ServerWelcome
    | ServerWaiting
    | ServerMatchStart
    | ServerStateUpdate
    | ServerDragonRevealed
    | ServerAttackResult
    | ServerMoveDenied
    | ServerItemPickedUp
    | ServerMatchEnd
    | ServerOpponentDisconnected
    | ServerErrorMsg
    | { type: string;[k: string]: unknown };

// UI wiring
const controls: Controls = {
    urlInput: document.getElementById("ws-url") as HTMLInputElement,
    nameInput: document.getElementById("player-name") as HTMLInputElement,
    connectBtn: document.getElementById("connect") as HTMLButtonElement,
    status: document.getElementById("status")!,
    overlay: document.getElementById("connect-overlay")!,
    canvas: document.getElementById("map") as HTMLCanvasElement,
};

const WORLD_WIDTH = 200;
const WORLD_HEIGHT = 200;
const VIEWPORT_TILES_X = 40;
const VIEWPORT_TILES_Y = 22;
const TILE = 16;
const VIEWPORT_WIDTH_PX = VIEWPORT_TILES_X * TILE; // 640
const VIEWPORT_HEIGHT_PX = VIEWPORT_TILES_Y * TILE; // 352
const MOVE_COOLDOWN_MS = 70;
const ATTACK_COOLDOWN_MS = 120;
const COLORS: Record<TileType, string> = {
    Grass: "#2d8a4e",
    Water: "#1d8cd6",
    Wall: "#8b95a5",
    Forest: "#1b7a3d",
    Sand: "#dbb544",
};

// Sprite rendering (optional): drop a sheet at /sprites/tiles.png where each cell is SPRITE_PX square.
// Fallback to flat colors if the sheet is missing or fails to load.
const SPRITE_PX = 16;
const SPRITE_PATH = "/sprites/tiles.png";
const SPRITE_MAP: Record<TileType, { sx: number; sy: number }> = {
    Grass: { sx: 0, sy: 0 },
    Water: { sx: 1, sy: 0 },
    Wall: { sx: 2, sy: 0 },
    Forest: { sx: 3, sy: 0 },
    Sand: { sx: 4, sy: 0 },
};

let spriteSheet: HTMLImageElement | null = null;
let spriteReady = false;

function loadSprites() {
    const img = new Image();
    img.src = SPRITE_PATH;
    img.onload = () => {
        spriteSheet = img;
        spriteReady = true;
        draw();
    };
    img.onerror = () => {
        console.warn("Sprite sheet not found at", SPRITE_PATH, "— using colors");
    };
}

let ws: WebSocket | null = null;
let world: TileType[][] | null = null;
let playerId: string | null = null;
let you = { x: 0, y: 0, hp: 0, inv: [] as string[] };
let opp = { x: 0, y: 0, hp: 0, invCount: 0 };
let dragon: DragonState | null = null;
let lastMoveAt = 0;
let lastAttackAt = 0;

// Canvas sizing
function sizeCanvas() {
    controls.canvas.width = VIEWPORT_WIDTH_PX;
    controls.canvas.height = VIEWPORT_HEIGHT_PX;
    const scale = Math.max(
        1,
        Math.floor(Math.min(window.innerWidth / VIEWPORT_WIDTH_PX, window.innerHeight / VIEWPORT_HEIGHT_PX)),
    );
    controls.canvas.style.width = `${VIEWPORT_WIDTH_PX * scale}px`;
    controls.canvas.style.height = `${VIEWPORT_HEIGHT_PX * scale}px`;
}
window.addEventListener("resize", () => {
    sizeCanvas();
    draw();
});
sizeCanvas();

// Controls
controls.connectBtn.addEventListener("click", doConnect);
Array.from(document.querySelectorAll("[data-move]")).forEach(btn => {
    btn.addEventListener("click", () => sendMove((btn as HTMLElement).dataset.move!));
});
Array.from(document.querySelectorAll("[data-action='Attack']")).forEach(btn => {
    btn.addEventListener("click", sendAttack);
});
window.addEventListener("keydown", e => {
    if (e.repeat) return;
    if (e.key === "w") sendMove("Up");
    if (e.key === "s") sendMove("Down");
    if (e.key === "a") sendMove("Left");
    if (e.key === "d") sendMove("Right");
    if (e.key === " ") sendAttack();
});

// Networking
function doConnect() {
    const url = controls.urlInput.value.trim();
    const name = controls.nameInput.value.trim() || "Player";
    if (ws) ws.close();
    log("Connecting to " + url);
    hideOverlay();
    ws = new WebSocket(url);
    controls.status.textContent = "Connecting…";

    ws.onopen = () => {
        controls.status.textContent = "Connected";
        hideOverlay();
        ws?.send(JSON.stringify({ type: "Join", player_name: name }));
    };
    ws.onclose = () => {
        controls.status.textContent = "Disconnected";
        showOverlay();
    };
    ws.onerror = () => {
        controls.status.textContent = "Error";
        showOverlay();
    };
    ws.onmessage = ev => {
        let m: ServerMessage;
        try {
            m = JSON.parse(ev.data) as ServerMessage;
        } catch (err) {
            log("Bad JSON");
            console.error(err);
            return;
        }
        onMsg(m);
    };
}

function sendMove(direction: string) {
    const now = performance.now();
    if (now - lastMoveAt < MOVE_COOLDOWN_MS) return;
    lastMoveAt = now;
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Move", direction }));
    }
}
function sendAttack() {
    const now = performance.now();
    if (now - lastAttackAt < ATTACK_COOLDOWN_MS) return;
    lastAttackAt = now;
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Attack" }));
    }
}

function onMsg(m: ServerMessage) {
    switch (m.type) {
        case "Welcome":
            playerId = m.player_id;
            controls.status.textContent = "Connected";
            hideOverlay();
            break;
        case "WaitingForOpponent":
            controls.status.textContent = "Waiting for opponent…";
            hideOverlay();
            break;
        case "MatchStart": {
            controls.status.textContent = "In match";
            try {
                if (m.tiles) {
                    world = parseTiles(m.tiles, m.world_width, m.world_height);
                } else {
                    throw new Error("Server did not send tiles");
                }
            } catch (err: any) {
                console.error(err);
                break;
            }
            you.x = m.spawn_x;
            you.y = m.spawn_y;
            opp = { x: m.spawn_x + 1, y: m.spawn_y, hp: 0, invCount: 0 };
            dragon = null;
            hideOverlay();
            draw();
            break;
        }
        case "StateUpdate": {
            you.x = m.your_x;
            you.y = m.your_y;
            you.hp = m.your_hp;
            you.inv = m.your_inventory;
            opp.x = m.opponent_x;
            opp.y = m.opponent_y;
            opp.hp = m.opponent_hp;
            opp.invCount = m.opponent_item_count;
            if (m.dragon_visible && m.dragon_x != null && m.dragon_y != null) {
                dragon = {
                    x: m.dragon_x,
                    y: m.dragon_y,
                    w: m.dragon_width ?? 1,
                    h: m.dragon_height ?? 1,
                    hp: m.dragon_hp ?? 0,
                };
            }
            updateState();
            draw();
            break;
        }
        case "ItemPickedUp":
            break;
        case "DragonRevealed":
            dragon = { x: m.x, y: m.y, w: m.width, h: m.height, hp: 0 };
            draw();
            break;
        case "AttackResult":
            break;
        case "MoveDenied":
            controls.status.textContent = "Blocked: " + m.reason;
            break;
        case "MatchEnd":
            controls.status.textContent = "Winner: " + m.winner;
            showOverlay();
            break;
        case "OpponentDisconnected":
            controls.status.textContent = "Opponent left";
            showOverlay();
            break;
        case "Error":
            controls.status.textContent = m.message;
            showOverlay();
            break;
        default:
            log("? " + JSON.stringify(m));
    }
}

// Drawing
function draw() {
    if (!world) return;
    const c = controls.canvas;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const tilesX = VIEWPORT_TILES_X;
    const tilesY = VIEWPORT_TILES_Y;
    const camX = you.x - Math.floor(tilesX / 2);
    const camY = you.y - Math.floor(tilesY / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, c.width, c.height);

    for (let r = 0; r < tilesY; r++) {
        for (let col = 0; col < tilesX; col++) {
            const wx = camX + col;
            const wy = camY + r;
            if (!world[0] || wx < 0 || wy < 0 || wy >= world.length || wx >= world[0].length) continue;
            const tile = world[wy][wx];
            if (spriteReady && spriteSheet) {
                const { sx, sy } = SPRITE_MAP[tile];
                ctx.drawImage(
                    spriteSheet,
                    sx * SPRITE_PX,
                    sy * SPRITE_PX,
                    SPRITE_PX,
                    SPRITE_PX,
                    col * TILE,
                    r * TILE,
                    TILE,
                    TILE,
                );
            } else {
                ctx.fillStyle = COLORS[tile] ?? "#333";
                ctx.fillRect(col * TILE, r * TILE, TILE, TILE);
            }
        }
    }

    if (dragon) {
        ctx.fillStyle = "rgba(220,38,38,0.45)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.fillRect((dragon.x - camX) * TILE, (dragon.y - camY) * TILE, dragon.w * TILE, dragon.h * TILE);
        ctx.strokeRect((dragon.x - camX) * TILE, (dragon.y - camY) * TILE, dragon.w * TILE, dragon.h * TILE);
    }

    ctx.fillStyle = "#a855f7";
    ctx.fillRect((opp.x - camX) * TILE, (opp.y - camY) * TILE, TILE, TILE);

    ctx.fillStyle = "#fbbf24";
    ctx.fillRect((you.x - camX) * TILE, (you.y - camY) * TILE, TILE, TILE);

    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("YOU", (you.x - camX) * TILE, (you.y - camY) * TILE - 2);
}

function updateState() {
    // Currently no visible state grid; hook reserved for future HUD.
}

// Logging
function log(msg: string) {
    console.log(msg);
}

function showOverlay() {
    controls.overlay.style.display = "flex";
}

function hideOverlay() {
    controls.overlay.style.display = "none";
}

// Tiles
const TILE_CHAR: Record<string, TileType> = {
    G: "Grass",
    W: "Water",
    L: "Wall",
    F: "Forest",
    S: "Sand",
};

function parseTiles(tileStr: string, W: number, H: number): TileType[][] {
    if (!tileStr) throw new Error("Tile string missing");
    if (W !== WORLD_WIDTH || H !== WORLD_HEIGHT) {
        console.warn(`Unexpected world size ${W}x${H}; expected ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
    }
    if (tileStr.length !== W * H) {
        throw new Error(`Tile string length ${tileStr.length} != ${W}x${H}`);
    }
    const t: TileType[][] = [];
    for (let y = 0; y < H; y++) {
        const row: TileType[] = [];
        for (let x = 0; x < W; x++) {
            const ch = tileStr[y * W + x];
            row.push(TILE_CHAR[ch] ?? "Grass");
        }
        t.push(row);
    }
    return t;
}

// Auto-connect on load
loadSprites();
// Wait for user to connect via overlay.
