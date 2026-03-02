import {
    ATTACK_COOLDOWN_MS,
    DRAGON_MAX_HP,
    Dir,
    MOVE_REPEAT_MS,
    TileType,
    TILE_CHAR,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from "./constants";
import { draw, resizeCanvases } from "./render";
import { loadSprites, spriteSheets } from "./sprites";
import { applyStateUpdate, gameState, resetForMatch, setWorld, tickState } from "./state";
import { Controls, ServerMessage } from "./types";

const DEFAULT_WS_URL = new URLSearchParams(window.location.search).get("ws") || "ws://155.248.241.165:8080";

const controls: Controls = {
    nameInput: document.getElementById("player-name") as HTMLInputElement,
    connectBtn: document.getElementById("connect") as HTMLButtonElement,
    matchResult: document.getElementById("match-result")!,
    toastStack: document.getElementById("toast-stack")!,
    overlay: document.getElementById("connect-overlay")!,
    canvas: document.getElementById("map") as HTMLCanvasElement,
    minimap: document.getElementById("minimap") as HTMLCanvasElement,
    playerHearts: document.getElementById("player-hearts")!,
    slotSword: document.getElementById("slot-sword")!,
    slotArmor: document.getElementById("slot-armor")!,
    slotMap: document.getElementById("slot-map")!,
    oppSlot1: document.getElementById("opp-slot-1")!,
    oppSlot2: document.getElementById("opp-slot-2")!,
    oppSlot3: document.getElementById("opp-slot-3")!,
    dragonHud: document.getElementById("dragon-hud")!,
    dragonHpFill: document.getElementById("dragon-hp-fill")!,
    dragonHpValue: document.getElementById("dragon-hp-value")!,
};

let ws: WebSocket | null = null;
let playerId: string | null = null;
let lastAttackAt = 0;
let activeMoveDirection: Dir | null = null;
let moveRepeatTimer: number | null = null;
const heldDirections = new Set<Dir>();
const directionOrder: Dir[] = [];
let isQueueing = false;
let lastFrame = performance.now();
let pickupAudioCtx: AudioContext | null = null;
let activeToastEl: HTMLDivElement | null = null;
let activeToastTimer: number | null = null;

bootstrap();

function bootstrap() {
    resizeCanvases(controls);
    window.addEventListener("resize", () => {
        resizeCanvases(controls);
        draw(controls, spriteSheets);
    });

    controls.connectBtn.addEventListener("click", doConnect);
    wireInput();
    loadSprites(() => draw(controls, spriteSheets));
    showOverlay();
    updateStatePanel();
    requestAnimationFrame(loop);
}

function wireInput() {
    Array.from(document.querySelectorAll("[data-move]")).forEach(btn => {
        btn.addEventListener("click", () => {
            const dir = (btn as HTMLElement).dataset.move as Dir;
            if (dir) startMoveLoop(dir);
        });
    });
    Array.from(document.querySelectorAll("[data-action='Attack']")).forEach(btn => {
        btn.addEventListener("click", sendAttack);
    });
    window.addEventListener("keydown", e => {
        if (isTypingTarget(e.target)) return;
        const direction = keyToDirection(e.key);
        if (direction) {
            e.preventDefault();
            if (!heldDirections.has(direction)) {
                heldDirections.add(direction);
                const idx = directionOrder.indexOf(direction);
                if (idx >= 0) directionOrder.splice(idx, 1);
                directionOrder.push(direction);
            }
            syncMoveLoopWithHeldKeys();
            return;
        }
        if (e.key === " ") {
            e.preventDefault();
            sendAttack();
        }
    });
    window.addEventListener("keyup", e => {
        if (isTypingTarget(e.target)) return;
        const direction = keyToDirection(e.key);
        if (direction) {
            e.preventDefault();
            heldDirections.delete(direction);
            const idx = directionOrder.indexOf(direction);
            if (idx >= 0) directionOrder.splice(idx, 1);
            syncMoveLoopWithHeldKeys();
        }
    });
    window.addEventListener("blur", () => {
        heldDirections.clear();
        directionOrder.length = 0;
        stopMoveLoopAll();
    });
}

function loop(now: number) {
    const dt = now - lastFrame;
    lastFrame = now;
    tickState(dt);
    draw(controls, spriteSheets);
    requestAnimationFrame(loop);
}

function doConnect() {
    if (isQueueing) return;
    const url = DEFAULT_WS_URL;
    const name = controls.nameInput.value.trim() || "Player";
    isQueueing = true;
    controls.connectBtn.disabled = true;
    controls.connectBtn.textContent = "Joining...";
    setMatchResult("");
    if (ws) ws.close();
    showOverlay();
    ws = new WebSocket(url);
    showToast("Connecting…", "info");

    ws.onopen = () => {
        showToast("Connected", "info");
        showOverlay();
        ws?.send(JSON.stringify({ type: "Join", player_name: name }));
    };
    ws.onclose = ev => {
        showToast("Disconnected", "warn");
        resetQueueUi();
        showOverlay();
    };
    ws.onerror = err => {
        showToast("Connection error", "error");
        resetQueueUi();
        showOverlay();
    };
    ws.onmessage = ev => {
        let m: ServerMessage;
        try {
            m = JSON.parse(ev.data) as ServerMessage;
        } catch (err) {
            console.error(err);
            return;
        }
        onMsg(m);
    };
}

function sendMove(direction: Dir) {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Move", direction }));
    }
}

function startMoveLoop(direction: Dir) {
    if (activeMoveDirection === direction && moveRepeatTimer != null) return;
    activeMoveDirection = direction;
    if (moveRepeatTimer != null) window.clearInterval(moveRepeatTimer);
    sendMove(direction);
    moveRepeatTimer = window.setInterval(() => {
        if (!activeMoveDirection) return;
        sendMove(activeMoveDirection);
    }, MOVE_REPEAT_MS);
}

function stopMoveLoop(direction: Dir) {
    if (activeMoveDirection !== direction) return;
    stopMoveLoopAll();
}

function stopMoveLoopAll() {
    activeMoveDirection = null;
    if (moveRepeatTimer != null) {
        window.clearInterval(moveRepeatTimer);
        moveRepeatTimer = null;
    }
}

function syncMoveLoopWithHeldKeys() {
    let next: Dir | null = null;
    for (let i = directionOrder.length - 1; i >= 0; i--) {
        const dir = directionOrder[i];
        if (heldDirections.has(dir)) {
            next = dir;
            break;
        }
    }

    if (!next) {
        stopMoveLoopAll();
        return;
    }

    if (activeMoveDirection === next && moveRepeatTimer != null) return;
    startMoveLoop(next);
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
        case "Welcome": {
            const msg = m as Extract<ServerMessage, { type: "Welcome" }>;
            playerId = msg.player_id;
            showToast("Connected", "info");
            showOverlay();
            break;
        }
        case "WaitingForOpponent":
            showToast("Waiting for opponent…", "info");
            setMatchResult("Waiting for opponent…");
            showOverlay();
            break;
        case "MatchStart": {
            const msg = m as Extract<ServerMessage, { type: "MatchStart" }>;
            resetQueueUi();
            showToast("Match started", "info");
            try {
                if (msg.tiles) {
                    const parsed = parseTiles(msg.tiles, msg.world_width, msg.world_height);
                    setWorld(parsed);
                } else {
                    throw new Error("Server did not send tiles");
                }
            } catch (err: any) {
                console.error(err);
                break;
            }
            resetForMatch(msg.spawn_x, msg.spawn_y);
            setMatchResult("");
            hideOverlay();
            updateStatePanel();
            break;
        }
        case "StateUpdate": {
            const msg = m as Extract<ServerMessage, { type: "StateUpdate" }>;
            const prevOppCount = gameState.opp.invCount;
            const prevOwned = {
                sword: hasInventoryItem("holysword"),
                armor: hasInventoryItem("holyarmor"),
                map: hasInventoryItem("dragonmap"),
            };
            applyStateUpdate(msg);
            updateStatePanel();

            const nowOwned = {
                sword: hasInventoryItem("holysword"),
                armor: hasInventoryItem("holyarmor"),
                map: hasInventoryItem("dragonmap"),
            };

            let playerPickup = false;
            if (!prevOwned.sword && nowOwned.sword) {
                pulseSlot(controls.slotSword);
                playerPickup = true;
            }
            if (!prevOwned.armor && nowOwned.armor) {
                pulseSlot(controls.slotArmor);
                playerPickup = true;
            }
            if (!prevOwned.map && nowOwned.map) {
                pulseSlot(controls.slotMap);
                playerPickup = true;
            }

            if (gameState.opp.invCount > prevOppCount) {
                for (let i = prevOppCount; i < Math.min(3, gameState.opp.invCount); i++) {
                    pulseSlot(opponentSlots()[i]);
                }
                playPickupTone(740);
            }

            if (playerPickup) playPickupTone(880);
            break;
        }
        case "ItemPickedUp":
            playPickupTone(880);
            break;
        case "DragonRevealed": {
            const msg = m as Extract<ServerMessage, { type: "DragonRevealed" }>;
            gameState.dragon = { x: msg.x, y: msg.y, w: msg.width, h: msg.height, hp: 0 };
            break;
        }
        case "AttackResult":
            {
                const msg = m as Extract<ServerMessage, { type: "AttackResult" }>;
                gameState.you.hp = msg.your_hp;
                if (gameState.dragon) gameState.dragon.hp = Math.max(0, msg.dragon_hp);
                updateStatePanel();
            }
            break;
        case "MoveDenied":
            showToast("Blocked: " + (m as Extract<ServerMessage, { type: "MoveDenied" }>).reason, "warn");
            break;
        case "MatchEnd":
            {
                const winner = (m as Extract<ServerMessage, { type: "MatchEnd" }>).winner;
                showToast("Winner: " + winner, "info");
                setMatchResult(`Match over • Winner: ${winner}`);
            }
            resetQueueUi();
            showOverlay();
            break;
        case "OpponentDisconnected":
            showToast("Opponent left", "warn");
            setMatchResult("Match ended • Opponent disconnected");
            resetQueueUi();
            showOverlay();
            break;
        case "Error": {
            const msg = m as Extract<ServerMessage, { type: "Error" }>;
            // Stay in the match; just surface the message.
            showToast(msg.message, "error");
            if (controls.overlay.style.display !== "none") setMatchResult(`Server: ${msg.message}`);
            break;
        }
        default:
            console.log("?", m);
    }
}

function resetQueueUi() {
    isQueueing = false;
    controls.connectBtn.disabled = false;
    controls.connectBtn.textContent = "Enter Queue";
}

function updateStatePanel() {
    const youHp = Math.max(0, Math.min(100, gameState.you.hp));

    controls.playerHearts.innerHTML = renderHearts(youHp);
    controls.slotSword.classList.toggle("owned", hasInventoryItem("holysword"));
    controls.slotArmor.classList.toggle("owned", hasInventoryItem("holyarmor"));
    controls.slotMap.classList.toggle("owned", hasInventoryItem("dragonmap"));

    const oppCount = Math.max(0, Math.min(3, gameState.opp.invCount));
    opponentSlots().forEach((slot, idx) => slot.classList.toggle("owned", idx < oppCount));

    if (gameState.dragon) {
        const dragonHp = Math.max(0, Math.min(DRAGON_MAX_HP, gameState.dragon.hp));
        const dragonPct = Math.min(100, (dragonHp / DRAGON_MAX_HP) * 100);
        controls.dragonHud.classList.remove("hidden");
        controls.dragonHpFill.style.width = `${dragonPct}%`;
        controls.dragonHpValue.textContent = `${dragonHp} / ${DRAGON_MAX_HP}`;
    } else {
        controls.dragonHud.classList.add("hidden");
    }
}

function opponentSlots() {
    return [controls.oppSlot1, controls.oppSlot2, controls.oppSlot3];
}

function pulseSlot(el: HTMLElement) {
    el.classList.remove("blink");
    void el.offsetWidth;
    el.classList.add("blink");
}

function playPickupTone(freq: number) {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!pickupAudioCtx) pickupAudioCtx = new AudioCtx();
        if (pickupAudioCtx.state === "suspended") pickupAudioCtx.resume();

        const osc = pickupAudioCtx.createOscillator();
        const gain = pickupAudioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;

        const now = pickupAudioCtx.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(gain);
        gain.connect(pickupAudioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    } catch {
        // Ignore audio errors silently.
    }
}

function renderHearts(hp: number) {
    const hearts: string[] = [];
    const totalHearts = 10;
    const fullHearts = Math.floor(hp / 10);
    const hasHalf = hp % 10 >= 5;
    for (let i = 0; i < totalHearts; i++) {
        if (i < fullHearts) hearts.push(`<span class="heart full">❤</span>`);
        else if (i === fullHearts && hasHalf) hearts.push(`<span class="heart half">❤</span>`);
        else hearts.push(`<span class="heart empty">❤</span>`);
    }
    return hearts.join("");
}

function hasInventoryItem(key: string) {
    return (gameState.you.inv || []).some(item => item.toLowerCase().replace(/[^a-z]/g, "").includes(key));
}

function showToast(message: string, kind: "info" | "warn" | "error" = "info") {
    if (!activeToastEl) {
        activeToastEl = document.createElement("div");
        controls.toastStack.appendChild(activeToastEl);
    }

    activeToastEl.className = `toast ${kind}`;
    activeToastEl.textContent = message;
    activeToastEl.classList.remove("out");

    if (activeToastTimer != null) window.clearTimeout(activeToastTimer);
    activeToastTimer = window.setTimeout(() => {
        if (!activeToastEl) return;
        activeToastEl.classList.add("out");
    }, 2200);
}

function setMatchResult(message: string) {
    if (!message) {
        controls.matchResult.textContent = "";
        controls.matchResult.classList.add("hidden");
        return;
    }
    controls.matchResult.textContent = message;
    controls.matchResult.classList.remove("hidden");
}

function showOverlay() {
    controls.overlay.style.display = "flex";
}

function hideOverlay() {
    controls.overlay.style.display = "none";
}

function keyToDirection(key: string): Dir | null {
    const k = key.toLowerCase();
    if (k === "w" || key === "ArrowUp") return "Up";
    if (k === "s" || key === "ArrowDown") return "Down";
    if (k === "a" || key === "ArrowLeft") return "Left";
    if (k === "d" || key === "ArrowRight") return "Right";
    return null;
}

function isTypingTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
    return el.isContentEditable;
}

function parseTiles(tileStr: string, W: number, H: number) {
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
