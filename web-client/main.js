// src/main.ts
var controls = {
  urlInput: document.getElementById("ws-url"),
  nameInput: document.getElementById("player-name"),
  connectBtn: document.getElementById("connect"),
  status: document.getElementById("status"),
  overlay: document.getElementById("connect-overlay"),
  canvas: document.getElementById("map")
};
var WORLD_WIDTH = 200;
var WORLD_HEIGHT = 200;
var VIEWPORT_TILES_X = 40;
var VIEWPORT_TILES_Y = 22;
var TILE = 16;
var VIEWPORT_WIDTH_PX = VIEWPORT_TILES_X * TILE;
var VIEWPORT_HEIGHT_PX = VIEWPORT_TILES_Y * TILE;
var MOVE_COOLDOWN_MS = 70;
var ATTACK_COOLDOWN_MS = 120;
var COLORS = {
  Grass: "#2d8a4e",
  Water: "#1d8cd6",
  Wall: "#8b95a5",
  Forest: "#1b7a3d",
  Sand: "#dbb544"
};
var SPRITE_PX = 16;
var SPRITE_PATH = "/sprites/tiles.png";
var SPRITE_MAP = {
  Grass: { sx: 0, sy: 0 },
  Water: { sx: 1, sy: 0 },
  Wall: { sx: 2, sy: 0 },
  Forest: { sx: 3, sy: 0 },
  Sand: { sx: 4, sy: 0 }
};
var spriteSheet = null;
var spriteReady = false;
function loadSprites() {
  const img = new Image();
  img.src = SPRITE_PATH;
  img.onload = () => {
    spriteSheet = img;
    spriteReady = true;
    draw();
  };
  img.onerror = () => {
    console.warn("Sprite sheet not found at", SPRITE_PATH, "\u2014 using colors");
  };
}
var ws = null;
var world = null;
var playerId = null;
var you = { x: 0, y: 0, hp: 0, inv: [] };
var opp = { x: 0, y: 0, hp: 0, invCount: 0 };
var dragon = null;
var lastMoveAt = 0;
var lastAttackAt = 0;
function sizeCanvas() {
  controls.canvas.width = VIEWPORT_WIDTH_PX;
  controls.canvas.height = VIEWPORT_HEIGHT_PX;
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / VIEWPORT_WIDTH_PX, window.innerHeight / VIEWPORT_HEIGHT_PX))
  );
  controls.canvas.style.width = `${VIEWPORT_WIDTH_PX * scale}px`;
  controls.canvas.style.height = `${VIEWPORT_HEIGHT_PX * scale}px`;
}
window.addEventListener("resize", () => {
  sizeCanvas();
  draw();
});
sizeCanvas();
controls.connectBtn.addEventListener("click", doConnect);
Array.from(document.querySelectorAll("[data-move]")).forEach((btn) => {
  btn.addEventListener("click", () => sendMove(btn.dataset.move));
});
Array.from(document.querySelectorAll("[data-action='Attack']")).forEach((btn) => {
  btn.addEventListener("click", sendAttack);
});
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "w") sendMove("Up");
  if (e.key === "s") sendMove("Down");
  if (e.key === "a") sendMove("Left");
  if (e.key === "d") sendMove("Right");
  if (e.key === " ") sendAttack();
});
function doConnect() {
  const url = controls.urlInput.value.trim();
  const name = controls.nameInput.value.trim() || "Player";
  if (ws) ws.close();
  log("Connecting to " + url);
  hideOverlay();
  ws = new WebSocket(url);
  controls.status.textContent = "Connecting\u2026";
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
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch (err) {
      log("Bad JSON");
      console.error(err);
      return;
    }
    onMsg(m);
  };
}
function sendMove(direction) {
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
function onMsg(m) {
  switch (m.type) {
    case "Welcome":
      playerId = m.player_id;
      controls.status.textContent = "Connected";
      hideOverlay();
      break;
    case "WaitingForOpponent":
      controls.status.textContent = "Waiting for opponent\u2026";
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
      } catch (err) {
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
          hp: m.dragon_hp ?? 0
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
          TILE
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
}
function log(msg) {
  console.log(msg);
}
function showOverlay() {
  controls.overlay.style.display = "flex";
}
function hideOverlay() {
  controls.overlay.style.display = "none";
}
var TILE_CHAR = {
  G: "Grass",
  W: "Water",
  L: "Wall",
  F: "Forest",
  S: "Sand"
};
function parseTiles(tileStr, W, H) {
  if (!tileStr) throw new Error("Tile string missing");
  if (W !== WORLD_WIDTH || H !== WORLD_HEIGHT) {
    console.warn(`Unexpected world size ${W}x${H}; expected ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  if (tileStr.length !== W * H) {
    throw new Error(`Tile string length ${tileStr.length} != ${W}x${H}`);
  }
  const t = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const ch = tileStr[y * W + x];
      row.push(TILE_CHAR[ch] ?? "Grass");
    }
    t.push(row);
  }
  return t;
}
loadSprites();
//# sourceMappingURL=main.js.map
