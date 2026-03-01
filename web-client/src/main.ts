type TileType = "Grass" | "Water" | "Wall" | "Forest" | "Sand";

interface Controls {
  urlInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  connectBtn: HTMLButtonElement;
  status: HTMLElement;
  log: HTMLTextAreaElement;
  canvas: HTMLCanvasElement;
  stateGrid: HTMLElement;
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
  | { type: string; [k: string]: unknown };

// UI wiring
const controls: Controls = {
  urlInput: document.getElementById("ws-url") as HTMLInputElement,
  nameInput: document.getElementById("player-name") as HTMLInputElement,
  connectBtn: document.getElementById("connect") as HTMLButtonElement,
  status: document.getElementById("status")!,
  log: document.getElementById("log") as HTMLTextAreaElement,
  canvas: document.getElementById("map") as HTMLCanvasElement,
  stateGrid: document.getElementById("state-grid")!,
};

const TILE = 8;
const COLORS: Record<TileType, string> = {
  Grass: "#2d8a4e",
  Water: "#1d8cd6",
  Wall: "#8b95a5",
  Forest: "#1b7a3d",
  Sand: "#dbb544",
};

let ws: WebSocket | null = null;
let world: TileType[][] | null = null;
let playerId: string | null = null;
let you = { x: 0, y: 0, hp: 0, inv: [] as string[] };
let opp = { x: 0, y: 0, hp: 0, invCount: 0 };
let dragon: DragonState | null = null;

// Canvas sizing
function sizeCanvas() {
  const r = controls.canvas.getBoundingClientRect();
  controls.canvas.width = Math.round(r.width);
  controls.canvas.height = Math.round(r.height);
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
  if (e.key === "ArrowUp") sendMove("Up");
  if (e.key === "ArrowDown") sendMove("Down");
  if (e.key === "ArrowLeft") sendMove("Left");
  if (e.key === "ArrowRight") sendMove("Right");
  if (e.key === " ") sendAttack();
});

// Networking
function doConnect() {
  const url = controls.urlInput.value.trim();
  const name = controls.nameInput.value.trim() || "Player";
  if (ws) ws.close();
  log("Connecting to " + url);
  ws = new WebSocket(url);
  controls.status.textContent = "Connecting…";

  ws.onopen = () => {
    controls.status.textContent = "Connected";
    ws?.send(JSON.stringify({ type: "Join", player_name: name }));
  };
  ws.onclose = () => {
    controls.status.textContent = "Disconnected";
    log("Disconnected");
  };
  ws.onerror = () => {
    controls.status.textContent = "Error";
    log("WS error");
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
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "Move", direction }));
  }
}
function sendAttack() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "Attack" }));
  }
}

function onMsg(m: ServerMessage) {
  switch (m.type) {
    case "Welcome":
      playerId = m.player_id;
      log("Welcome " + playerId);
      break;
    case "WaitingForOpponent":
      log("Waiting for opponent…");
      break;
    case "MatchStart": {
      log("Match seed=" + m.seed + " " + m.world_width + "x" + m.world_height);
      try {
        if (m.tiles) {
          world = parseTiles(m.tiles, m.world_width, m.world_height);
        } else {
          throw new Error("Server did not send tiles");
        }
      } catch (err: any) {
        log("Tile parse error: " + (err?.message ?? err));
        console.error(err);
        break;
      }
      you.x = m.spawn_x;
      you.y = m.spawn_y;
      opp = { x: m.spawn_x + 1, y: m.spawn_y, hp: 0, invCount: 0 };
      dragon = null;
      log("World loaded OK, drawing…");
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
      log("Picked up: " + m.item);
      break;
    case "DragonRevealed":
      dragon = { x: m.x, y: m.y, w: m.width, h: m.height, hp: 0 };
      log("Dragon at " + m.x + "," + m.y);
      draw();
      break;
    case "AttackResult":
      log(
        "Atk dealt=" +
          m.damage_dealt +
          " took=" +
          m.damage_taken +
          " hp=" +
          m.your_hp +
          " drg=" +
          m.dragon_hp,
      );
      break;
    case "MoveDenied":
      log("Blocked: " + m.reason);
      break;
    case "MatchEnd":
      log("Winner: " + m.winner);
      break;
    case "OpponentDisconnected":
      log("Opponent left");
      break;
    case "Error":
      log("Err: " + m.message);
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
  const cw = c.width;
  const ch = c.height;

  const tilesX = Math.ceil(cw / TILE) + 2;
  const tilesY = Math.ceil(ch / TILE) + 2;
  const camX = you.x - Math.floor(tilesX / 2);
  const camY = you.y - Math.floor(tilesY / 2);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, cw, ch);

  for (let r = 0; r < tilesY; r++) {
    for (let col = 0; col < tilesX; col++) {
      const wx = camX + col;
      const wy = camY + r;
      if (!world[0] || wx < 0 || wy < 0 || wy >= world.length || wx >= world[0].length) continue;
      ctx.fillStyle = COLORS[world[wy][wx]] ?? "#333";
      ctx.fillRect(col * TILE, r * TILE, TILE, TILE);
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
  controls.stateGrid.innerHTML = "";
  const rows: [string, string][] = [
    ["You", `${you.x},${you.y}`],
    ["HP", String(you.hp)],
    ["Items", (you.inv || []).join(", ") || "—"],
    ["Opp", `${opp.x},${opp.y}`],
    ["Opp HP", String(opp.hp)],
    ["Opp items", String(opp.invCount)],
    [
      "Dragon",
      dragon ? `${dragon.x},${dragon.y} ${dragon.w}x${dragon.h} HP ${dragon.hp}` : "hidden",
    ],
  ];
  for (const [k, v] of rows) {
    const d = document.createElement("div");
    d.className = "state-row";
    d.innerHTML = `<span>${k}</span><span>${v}</span>`;
    controls.stateGrid.appendChild(d);
  }
}

// Logging
function log(msg: string) {
  const t = new Date().toLocaleTimeString();
  controls.log.value += `[${t}] ${msg}\n`;
  controls.log.scrollTop = controls.log.scrollHeight;
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
doConnect();
