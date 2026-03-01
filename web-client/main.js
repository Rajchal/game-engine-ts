// src/main.ts
var controls = {
  urlInput: document.getElementById("ws-url"),
  nameInput: document.getElementById("player-name"),
  connectBtn: document.getElementById("connect"),
  status: document.getElementById("status"),
  overlay: document.getElementById("connect-overlay"),
  canvas: document.getElementById("map"),
  minimap: document.getElementById("minimap"),
  stateGrid: document.getElementById("state-grid")
};
var WORLD_WIDTH = 200;
var WORLD_HEIGHT = 200;
var VIEWPORT_TILES_X = 40;
var VIEWPORT_TILES_Y = 22;
var TILE = 16;
var VIEWPORT_WIDTH_PX = VIEWPORT_TILES_X * TILE;
var VIEWPORT_HEIGHT_PX = VIEWPORT_TILES_Y * TILE;
var MOVE_REPEAT_MS = 60;
var ATTACK_COOLDOWN_MS = 120;
var POS_LERP = 0.28;
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
var renderYou = { x: 0, y: 0 };
var renderOpp = { x: 0, y: 0 };
var dragon = null;
var lastAttackAt = 0;
var activeMoveDirection = null;
var moveRepeatTimer = null;
var isQueueing = false;
var minimapBase = null;
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
  const direction = keyToDirection(e.key);
  if (direction) {
    e.preventDefault();
    startMoveLoop(direction);
    return;
  }
  if (e.key === " ") {
    e.preventDefault();
    sendAttack();
  }
});
window.addEventListener("keyup", (e) => {
  const direction = keyToDirection(e.key);
  if (direction) {
    e.preventDefault();
    stopMoveLoop(direction);
  }
});
window.addEventListener("blur", () => {
  stopMoveLoopAll();
});
function keyToDirection(key) {
  const k = key.toLowerCase();
  if (k === "w" || key === "ArrowUp") return "Up";
  if (k === "s" || key === "ArrowDown") return "Down";
  if (k === "a" || key === "ArrowLeft") return "Left";
  if (k === "d" || key === "ArrowRight") return "Right";
  return null;
}
function doConnect() {
  if (isQueueing) return;
  const url = controls.urlInput.value.trim();
  const name = controls.nameInput.value.trim() || "Player";
  isQueueing = true;
  controls.connectBtn.disabled = true;
  controls.connectBtn.textContent = "Joining...";
  if (ws) ws.close();
  log("Connecting to " + url);
  showOverlay();
  ws = new WebSocket(url);
  controls.status.textContent = "Connecting\u2026";
  ws.onopen = () => {
    controls.status.textContent = "Connected";
    showOverlay();
    ws?.send(JSON.stringify({ type: "Join", player_name: name }));
  };
  ws.onclose = () => {
    controls.status.textContent = "Disconnected";
    resetQueueUi();
    showOverlay();
  };
  ws.onerror = () => {
    controls.status.textContent = "Error";
    resetQueueUi();
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
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "Move", direction }));
    applyLocalMove(direction);
  }
}
function applyLocalMove(direction) {
  const dx = direction === "Left" ? -1 : direction === "Right" ? 1 : 0;
  const dy = direction === "Up" ? -1 : direction === "Down" ? 1 : 0;
  const nx = Math.max(0, Math.min(WORLD_WIDTH - 1, you.x + dx));
  const ny = Math.max(0, Math.min(WORLD_HEIGHT - 1, you.y + dy));
  you.x = nx;
  you.y = ny;
  renderYou.x = nx;
  renderYou.y = ny;
}
function startMoveLoop(direction) {
  if (activeMoveDirection === direction && moveRepeatTimer != null) return;
  activeMoveDirection = direction;
  if (moveRepeatTimer != null) {
    window.clearInterval(moveRepeatTimer);
  }
  sendMove(direction);
  moveRepeatTimer = window.setInterval(() => {
    if (!activeMoveDirection) return;
    sendMove(activeMoveDirection);
  }, MOVE_REPEAT_MS);
}
function stopMoveLoop(direction) {
  if (activeMoveDirection !== direction) return;
  activeMoveDirection = null;
  if (moveRepeatTimer != null) {
    window.clearInterval(moveRepeatTimer);
    moveRepeatTimer = null;
  }
}
function stopMoveLoopAll() {
  activeMoveDirection = null;
  if (moveRepeatTimer != null) {
    window.clearInterval(moveRepeatTimer);
    moveRepeatTimer = null;
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
      showOverlay();
      break;
    case "WaitingForOpponent":
      controls.status.textContent = "Waiting for opponent\u2026";
      showOverlay();
      break;
    case "MatchStart": {
      resetQueueUi();
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
      renderYou.x = you.x;
      renderYou.y = you.y;
      renderOpp.x = opp.x;
      renderOpp.y = opp.y;
      dragon = null;
      minimapBase = null;
      buildMinimapBase();
      hideOverlay();
      updateState();
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
      resetQueueUi();
      showOverlay();
      break;
    case "OpponentDisconnected":
      controls.status.textContent = "Opponent left";
      resetQueueUi();
      showOverlay();
      break;
    case "Error":
      controls.status.textContent = m.message;
      resetQueueUi();
      showOverlay();
      break;
    default:
      log("? " + JSON.stringify(m));
  }
}
function resetQueueUi() {
  isQueueing = false;
  controls.connectBtn.disabled = false;
  controls.connectBtn.textContent = "Enter Queue";
}
function draw() {
  if (!world) return;
  const c = controls.canvas;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const tilesX = VIEWPORT_TILES_X;
  const tilesY = VIEWPORT_TILES_Y;
  renderYou.x += (you.x - renderYou.x) * POS_LERP;
  renderYou.y += (you.y - renderYou.y) * POS_LERP;
  renderOpp.x += (opp.x - renderOpp.x) * POS_LERP;
  renderOpp.y += (opp.y - renderOpp.y) * POS_LERP;
  const camX = Math.floor(renderYou.x) - Math.floor(tilesX / 2);
  const camY = Math.floor(renderYou.y) - Math.floor(tilesY / 2);
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
  ctx.fillRect((renderOpp.x - camX) * TILE, (renderOpp.y - camY) * TILE - TILE, TILE, TILE * 2);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect((renderYou.x - camX) * TILE, (renderYou.y - camY) * TILE - TILE, TILE, TILE * 2);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("YOU", (renderYou.x - camX) * TILE, (renderYou.y - camY) * TILE - TILE - 2);
  drawMiniMap();
}
function updateState() {
  controls.stateGrid.innerHTML = "";
  const rows = [
    ["Position", `${you.x},${you.y}`],
    ["HP", String(you.hp)],
    ["Items", (you.inv || []).join(", ") || "\u2014"],
    ["Opponent", `${opp.x},${opp.y}`],
    ["Opp HP", String(opp.hp)],
    ["Opp Items", String(opp.invCount)],
    ["Dragon", dragon ? `${dragon.hp} HP` : "Hidden"]
  ];
  for (const [k, v] of rows) {
    const d = document.createElement("div");
    d.className = "state-row";
    d.innerHTML = `<span>${k}</span><span>${v}</span>`;
    controls.stateGrid.appendChild(d);
  }
}
function drawMiniMap() {
  if (!world) return;
  const ctx = controls.minimap.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const mw = controls.minimap.width;
  const mh = controls.minimap.height;
  if (!minimapBase) {
    buildMinimapBase();
  }
  if (minimapBase) {
    ctx.drawImage(minimapBase, 0, 0, mw, mh);
  } else {
    ctx.fillStyle = "#0f131a";
    ctx.fillRect(0, 0, mw, mh);
  }
  const sx = mw / WORLD_WIDTH;
  const sy = mh / WORLD_HEIGHT;
  if (dragon) {
    ctx.fillStyle = "rgba(239,68,68,0.8)";
    ctx.fillRect(dragon.x * sx, dragon.y * sy, Math.max(1, dragon.w * sx), Math.max(1, dragon.h * sy));
  }
  ctx.fillStyle = "#a855f7";
  ctx.fillRect(opp.x * sx, opp.y * sy, Math.max(2, sx), Math.max(2, sy * 2));
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(you.x * sx, you.y * sy, Math.max(2, sx), Math.max(2, sy * 2));
}
function buildMinimapBase() {
  if (!world) return;
  const base = document.createElement("canvas");
  base.width = controls.minimap.width;
  base.height = controls.minimap.height;
  const ctx = base.getContext("2d");
  if (!ctx) return;
  const sx = base.width / WORLD_WIDTH;
  const sy = base.height / WORLD_HEIGHT;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0f131a";
  ctx.fillRect(0, 0, base.width, base.height);
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tile = world[y]?.[x] ?? "Grass";
      ctx.fillStyle = COLORS[tile] ?? "#333";
      ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  minimapBase = base;
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
showOverlay();
updateState();
window.setInterval(() => {
  draw();
}, 1e3 / 60);
//# sourceMappingURL=main.js.map
