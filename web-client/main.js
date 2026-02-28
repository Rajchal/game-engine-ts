// Minimal client for the dragon server.
// - Connects to WebSocket
// - Rebuilds map from seed
// - Sends Move/Attack
// - Renders a simple top-down view

const controls = {
  urlInput: document.getElementById("ws-url"),
  nameInput: document.getElementById("player-name"),
  connectBtn: document.getElementById("connect"),
  status: document.getElementById("status"),
  log: document.getElementById("log"),
  map: document.getElementById("map"),
  stateGrid: document.getElementById("state-grid"),
};

const TILE_SIZE = 12; // larger so tiles are visible
const tileColors = {
  Grass: "#1f9d55",
  Water: "#0ea5e9",
  Wall: "#cbd5e1",
  Forest: "#16a34a",
  Sand: "#fcd34d",
};

let ws = null;
let world = null;
let playerId = null;
let you = { x: 0, y: 0, hp: 0, inv: [] };
let opp = { x: 0, y: 0, hp: 0, invCount: 0 };
let dragon = null;
let seedInfo = null;

// Canvas scaling
const ctx = controls.map.getContext("2d");
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = controls.map.getBoundingClientRect();
  controls.map.width = Math.max(1, Math.floor(width * dpr));
  controls.map.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  draw();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

controls.connectBtn.addEventListener("click", () => connect());
controls.status.textContent = "Disconnected";

// Direction buttons
Array.from(document.querySelectorAll("[data-move]"))
  .forEach(btn => btn.addEventListener("click", () => sendMove(btn.dataset.move)));

document.querySelectorAll("[data-action='Attack']")
  .forEach(btn => btn.addEventListener("click", () => sendAttack()));

// Keyboard
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") return sendMove("Up");
  if (e.key === "ArrowDown") return sendMove("Down");
  if (e.key === "ArrowLeft") return sendMove("Left");
  if (e.key === "ArrowRight") return sendMove("Right");
  if (e.key === " ") return sendAttack();
});

function connect() {
  const url = controls.urlInput.value.trim();
  const name = controls.nameInput.value.trim() || "Player";
  if (ws) {
    ws.close();
    ws = null;
  }
  log("Connecting to " + url + " as " + name);
  ws = new WebSocket(url);
  controls.status.textContent = "Connecting...";

  ws.onopen = () => {
    controls.status.textContent = "Connected";
    ws.send(JSON.stringify({ type: "Join", player_name: name }));
  };

  ws.onclose = () => {
    controls.status.textContent = "Disconnected";
    log("Disconnected");
  };

  ws.onerror = (err) => {
    controls.status.textContent = "Error";
    log("WebSocket error: " + err.message);
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return log("Bad JSON: " + event.data);
    }
    console.debug("WS", msg);
    handleMessage(msg);
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case "Welcome":
      playerId = msg.player_id;
      log("Welcome as " + playerId);
      break;
    case "WaitingForOpponent":
      log("Waiting for opponent...");
      break;
    case "MatchStart":
      log(`MatchStart seed=${msg.seed}`);
      seedInfo = msg;
      world = generateWorld(msg.seed, msg.world_width, msg.world_height);
      you.x = msg.spawn_x; you.y = msg.spawn_y;
      opp = { x: msg.spawn_x + 1, y: msg.spawn_y, hp: 0, invCount: 0 };
      draw();
      break;
    case "StateUpdate":
      you.x = msg.your_x; you.y = msg.your_y; you.hp = msg.your_hp; you.inv = msg.your_inventory;
      opp.x = msg.opponent_x; opp.y = msg.opponent_y; opp.hp = msg.opponent_hp; opp.invCount = msg.opponent_item_count;
      if (msg.dragon_visible && msg.dragon_x != null && msg.dragon_y != null) {
        dragon = {
          x: msg.dragon_x,
          y: msg.dragon_y,
          w: msg.dragon_width || 1,
          h: msg.dragon_height || 1,
          hp: msg.dragon_hp || 0,
        };
      }
      updateStateGrid();
      draw();
      break;
    case "ItemPickedUp":
      log("Picked up: " + msg.item);
      break;
    case "DragonRevealed":
      log("Dragon revealed at " + msg.x + "," + msg.y);
      dragon = { x: msg.x, y: msg.y, w: msg.width, h: msg.height, hp: 0 };
      draw();
      break;
    case "AttackResult":
      log(`Attack: dealt ${msg.damage_dealt}, took ${msg.damage_taken}, you=${msg.your_hp}, dragon=${msg.dragon_hp}`);
      break;
    case "MoveDenied":
      log("Move denied: " + msg.reason);
      break;
    case "MatchEnd":
      log("Match ended. Winner: " + msg.winner);
      break;
    case "OpponentDisconnected":
      log("Opponent disconnected");
      break;
    case "Error":
      log("Error: " + msg.message);
      break;
    default:
      log("Unknown message: " + JSON.stringify(msg));
  }
}

function sendMove(direction) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "Move", direction }));
}

function sendAttack() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "Attack" }));
}

function draw() {
  if (!world) return;
  const ctx = controls.map.getContext("2d");
  const w = world[0].length;
  const h = world.length;

  const cssW = controls.map.clientWidth || 1;
  const cssH = controls.map.clientHeight || 1;
  const viewTilesX = Math.ceil(cssW / TILE_SIZE) + 2;
  const viewTilesY = Math.ceil(cssH / TILE_SIZE) + 2;

  // Center camera on player
  const startX = clamp(you.x - Math.floor(viewTilesX / 2), 0, Math.max(0, w - viewTilesX));
  const startY = clamp(you.y - Math.floor(viewTilesY / 2), 0, Math.max(0, h - viewTilesY));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure CSS-space after DPR scale set earlier
  ctx.fillStyle = "#0b0d11";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.restore();

  for (let y = 0; y < viewTilesY; y++) {
    for (let x = 0; x < viewTilesX; x++) {
      const wx = startX + x;
      const wy = startY + y;
      const tile = world[wy]?.[wx];
      if (!tile) continue;
      ctx.fillStyle = tileColors[tile] || "#1f2933";
      ctx.fillRect(
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  // Dragon
  if (dragon) {
    ctx.fillStyle = "rgba(244,63,94,0.35)";
    ctx.fillRect(
      (dragon.x - startX) * TILE_SIZE,
      (dragon.y - startY) * TILE_SIZE,
      dragon.w * TILE_SIZE,
      dragon.h * TILE_SIZE
    );
  }

  // Opponent
  ctx.fillStyle = "#a855f7";
  ctx.fillRect((opp.x - startX) * TILE_SIZE, (opp.y - startY) * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  // You
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect((you.x - startX) * TILE_SIZE, (you.y - startY) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

function updateStateGrid() {
  controls.stateGrid.innerHTML = "";
  const rows = [
    ["You", `${you.x},${you.y}`],
    ["You HP", you.hp ?? ""],
    ["Items", (you.inv || []).join(", ")],
    ["Opp", `${opp.x},${opp.y}`],
    ["Opp HP", opp.hp ?? ""],
    ["Opp items", opp.invCount ?? ""],
    ["Dragon", dragon ? `${dragon.x},${dragon.y} (${dragon.w}x${dragon.h})` : "hidden"],
  ];
  rows.forEach(([k, v]) => {
    const row = document.createElement("div");
    row.className = "state-row";
    row.innerHTML = `<span>${k}</span><span>${v}</span>`;
    controls.stateGrid.appendChild(row);
  });
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  controls.log.textContent += `[${time}] ${msg}\n`;
  controls.log.scrollTop = controls.log.scrollHeight;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// ---------------- RNG + World Gen (matches server) ----------------
class ChaCha12 {
  constructor(key32, nonce32) {
    this.state = new Uint32Array(16);
    this.keystream = new Uint8Array(64);
    this.ksIndex = 64;
    const C = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
    this.state.set(C, 0);
    this.state.set(key32, 4);
    this.state[12] = 0;
    this.state[13] = 0;
    this.state.set(nonce32, 14);
  }
  rotate(v, c) { return ((v << c) | (v >>> (32 - c))) >>> 0; }
  quarter(a, b, c, d) {
    const st = this.state;
    st[a] = (st[a] + st[b]) >>> 0; st[d] = this.rotate(st[d] ^ st[a], 16);
    st[c] = (st[c] + st[d]) >>> 0; st[b] = this.rotate(st[b] ^ st[c], 12);
    st[a] = (st[a] + st[b]) >>> 0; st[d] = this.rotate(st[d] ^ st[a], 8);
    st[c] = (st[c] + st[d]) >>> 0; st[b] = this.rotate(st[b] ^ st[c], 7);
  }
  refillKeystream() {
    const working = new Uint32Array(this.state);
    for (let i = 0; i < 6; i++) {
      this.quarter(0, 4, 8, 12);
      this.quarter(1, 5, 9, 13);
      this.quarter(2, 6, 10, 14);
      this.quarter(3, 7, 11, 15);
      this.quarter(0, 5, 10, 15);
      this.quarter(1, 6, 11, 12);
      this.quarter(2, 7, 8, 13);
      this.quarter(3, 4, 9, 14);
    }
    for (let i = 0; i < 16; i++) working[i] = (working[i] + this.state[i]) >>> 0;
    this.state[12] = (this.state[12] + 1) >>> 0;
    if (this.state[12] === 0) this.state[13] = (this.state[13] + 1) >>> 0;
    const dv = new DataView(this.keystream.buffer);
    for (let i = 0; i < 16; i++) dv.setUint32(i * 4, working[i], true);
    this.ksIndex = 0;
  }
  nextU32() {
    if (this.ksIndex >= 64) this.refillKeystream();
    const dv = new DataView(this.keystream.buffer);
    const v = dv.getUint32(this.ksIndex, true);
    this.ksIndex += 4;
    return v >>> 0;
  }
  range(min, max) { return min + (this.nextU32() % (max - min)); }
  genBool(prob) { return (this.nextU32() % 1000) < prob * 1000; }
}
function chachaFromSeedU64(seedBig) {
  const key32 = new Uint32Array(8);
  key32[0] = Number(seedBig & 0xffffffffn);
  key32[1] = Number((seedBig >> 32n) & 0xffffffffn);
  const nonce32 = new Uint32Array(3);
  return new ChaCha12(key32, nonce32);
}

const TileType = {
  Grass: "Grass",
  Water: "Water",
  Wall: "Wall",
  Sand: "Sand",
  Forest: "Forest",
};

function generateWorld(seed, width, height) {
  const rng = chachaFromSeedU64(BigInt(seed >>> 0));
  const tiles = Array.from({ length: height }, () => Array(width).fill(TileType.Grass));

  for (let i = 0; i < 8; i++) {
    const cx = rng.range(5, width - 5);
    const cy = rng.range(5, height - 5);
    const radius = rng.range(3, 8);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && dx * dx + dy * dy <= radius * radius) {
          tiles[ny][nx] = TileType.Water;
        }
      }
    }
  }

  for (let i = 0; i < 6; i++) {
    const cx = rng.range(5, width - 5);
    const cy = rng.range(5, height - 5);
    const size = rng.range(2, 6);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && rng.genBool(0.6)) {
          tiles[ny][nx] = TileType.Wall;
        }
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    const cx = rng.range(3, width - 3);
    const cy = rng.range(3, height - 3);
    const radius = rng.range(2, 5);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (
          nx >= 0 && nx < width && ny >= 0 && ny < height &&
          tiles[ny][nx] === TileType.Grass && rng.genBool(0.7)
        ) {
          tiles[ny][nx] = TileType.Forest;
        }
      }
    }
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        tiles[ny][nx] = TileType.Grass;
      }
    }
  }

  return tiles;
}

// Auto-connect on load
connect();
