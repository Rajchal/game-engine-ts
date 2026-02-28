"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Tile from "./Tile";
import Character, { type Direction } from "./Character";
import { generateWorld, type TileType } from "../utils/WorldGen";
import { gameWS } from "../utils/websocket";

type ServerMessage =
  | { type: "Welcome"; player_id: string }
  | { type: "WaitingForOpponent" }
  | {
    type: "MatchStart";
    seed: number;
    world_width: number;
    world_height: number;
    spawn_x: number;
    spawn_y: number;
    opponent_name: string;
  }
  | {
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
  | { type: "ItemPickedUp"; item: string }
  | { type: "DragonRevealed"; x: number; y: number; width: number; height: number }
  | { type: "AttackResult"; damage_dealt: number; damage_taken: number; your_hp: number; dragon_hp: number }
  | { type: "MoveDenied"; reason: string }
  | { type: "MatchEnd"; winner: string }
  | { type: "OpponentDisconnected" }
  | { type: "Error"; message: string };

// ---------------- Constants ----------------
const TILE_SIZE = 40;
const CHAR_SIZE = 50; // matches Character sprite sizing used before
const VIEW_PADDING = 2; // tiles beyond viewport

export default function DragonSlayer() {
  const [direction, setDirection] = useState<Direction>("down");
  const [frameIndex, setFrameIndex] = useState(0);
  const [world, setWorld] = useState<TileType[][] | null>(null);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [dragonRect, setDragonRect] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);

  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement | null>(null);

  const CHAR_SCREEN_X = useMemo(
    () => viewport.width / 2 - CHAR_SIZE / 2,
    [viewport.width]
  );
  const CHAR_SCREEN_Y = useMemo(
    () => viewport.height / 2 - CHAR_SIZE / 2,
    [viewport.height]
  );

  // Track viewport size to support tile culling
  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // --- Camera follow (discrete; avoid per-frame re-render)
  useEffect(() => {
    const next = {
      x: -playerPos.x * TILE_SIZE + CHAR_SCREEN_X - TILE_SIZE / 2,
      y: -playerPos.y * TILE_SIZE + CHAR_SCREEN_Y - TILE_SIZE / 2,
    };
    setMapOffset(next);
    if (mapRef.current) {
      mapRef.current.style.transform = `translate(${next.x}px, ${next.y}px)`;
    }
  }, [playerPos, CHAR_SCREEN_X, CHAR_SCREEN_Y]);

  // --- Input: send to server
  useEffect(() => {
    const sendMove = (dir: Direction) => {
      setDirection(dir);
      setFrameIndex((p) => (p + 1) % 3);
      gameWS.send({ type: "Move", direction: capitalize(dir) });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") sendMove("up");
      else if (e.key === "ArrowDown") sendMove("down");
      else if (e.key === "ArrowLeft") sendMove("left");
      else if (e.key === "ArrowRight") sendMove("right");
      else if (e.key === " ") gameWS.send({ type: "Attack" });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- WebSocket setup
  useEffect(() => {
    const listener = (msg: ServerMessage) => {
      switch (msg.type) {
        case "MatchStart": {
          const w = generateWorld(msg.seed, msg.world_width, msg.world_height);
          setWorld(w);
          setPlayerPos({ x: msg.spawn_x, y: msg.spawn_y });
          break;
        }
        case "StateUpdate": {
          setPlayerPos({ x: msg.your_x, y: msg.your_y });
          if (msg.dragon_visible && msg.dragon_x !== null && msg.dragon_y !== null) {
            setDragonRect({
              x: msg.dragon_x,
              y: msg.dragon_y,
              width: msg.dragon_width ?? 1,
              height: msg.dragon_height ?? 1,
            });
          }
          break;
        }
        case "DragonRevealed": {
          setDragonRect({
            x: msg.x,
            y: msg.y,
            width: msg.width,
            height: msg.height,
          });
          break;
        }
        default:
          break;
      }
    };

    gameWS.onMessage(listener as any);
    // Send initial join
    gameWS.send({ type: "Join", player_name: "Alice" });

    return () => {
      // no unsubscribe support in gameWS; relying on component unmount
    };
  }, []);

  if (!world) {
    return <div style={{ color: "white", padding: 16 }}>Waiting for match...</div>;
  }

  // Viewport culling: only render tiles near the camera
  const tilesWide = Math.ceil(viewport.width / TILE_SIZE) + VIEW_PADDING * 2;
  const tilesHigh = Math.ceil(viewport.height / TILE_SIZE) + VIEW_PADDING * 2;

  const startX = clamp(
    Math.floor(playerPos.x - tilesWide / 2),
    0,
    world[0].length - 1
  );
  const startY = clamp(
    Math.floor(playerPos.y - tilesHigh / 2),
    0,
    world.length - 1
  );
  const endX = clamp(startX + tilesWide, 0, world[0].length);
  const endY = clamp(startY + tilesHigh, 0, world.length);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "black",
      }}
    >
      {/* Map tiles */}
      <div
        ref={mapRef}
        style={{
          position: "absolute",
          width: world[0].length * TILE_SIZE,
          height: world.length * TILE_SIZE,
          transform: `translate(${mapOffset.x}px, ${mapOffset.y}px)`,
          willChange: "transform",
        }}
      >
        {world.slice(startY, endY).map((row, yIdx) => {
          const y = startY + yIdx;
          return row.slice(startX, endX).map((tile, xIdx) => {
            const x = startX + xIdx;
            return (
              <Tile
                key={`${x}-${y}`}
                type={tile}
                size={TILE_SIZE}
                top={y * TILE_SIZE}
                left={x * TILE_SIZE}
              />
            );
          });
        })}

        {dragonRect && (
          <div
            style={{
              position: "absolute",
              left: dragonRect.x * TILE_SIZE,
              top: dragonRect.y * TILE_SIZE,
              width: dragonRect.width * TILE_SIZE,
              height: dragonRect.height * TILE_SIZE,
              background: "rgba(200,0,0,0.25)",
              border: "2px solid rgba(255,0,0,0.7)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Character */}
      <Character
        direction={direction}
        frameIndex={frameIndex}
        top={CHAR_SCREEN_Y}
        left={CHAR_SCREEN_X}
      />
    </div>
  );
}

function capitalize(dir: Direction): "Up" | "Down" | "Left" | "Right" {
  switch (dir) {
    case "up":
      return "Up";
    case "down":
      return "Down";
    case "left":
      return "Left";
    case "right":
      return "Right";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}