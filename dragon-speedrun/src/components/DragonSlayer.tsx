"use client";
import { useState, useEffect, useCallback } from "react";
import Tile from "./Tile";

import Character, { type Direction } from "./Character";
import { generateWorld, isWalkable, type TileType } from "../utils/WorldGen";

// ---------------- Constants ----------------
const MAP_WIDTH = 50;
const MAP_HEIGHT = 50;
const TILE_SIZE = 40;
const STEP = TILE_SIZE;

// Spawn position in tile coordinates
const SPAWN_TILE_X = 25;
const SPAWN_TILE_Y = 25;
const SPAWN_RADIUS = 3;

// ---------------- Main Component ----------------
export default function DragonSlayer() {
  const [direction, setDirection] = useState<Direction>("down");
  const [frameIndex, setFrameIndex] = useState(0);

  const CHAR_SCREEN_X = window.innerWidth / 2 - 25;
  const CHAR_SCREEN_Y = window.innerHeight / 2 - 25;

  const [tiles] = useState<TileType[][]>(() => {
    const world = generateWorld(12345, MAP_WIDTH, MAP_HEIGHT);

    // Clear spawn area
    for (let dy = -SPAWN_RADIUS; dy <= SPAWN_RADIUS; dy++) {
      for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
        const nx = SPAWN_TILE_X + dx;
        const ny = SPAWN_TILE_Y + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
          world[ny][nx] = "Grass";
        }
      }
    }

    return world;
  });

  const [mapOffset, setMapOffset] = useState({
    x: -SPAWN_TILE_X * TILE_SIZE + CHAR_SCREEN_X - TILE_SIZE / 2,
    y: -SPAWN_TILE_Y * TILE_SIZE + CHAR_SCREEN_Y - TILE_SIZE / 2,
  });

  const isTileBlocked = (offset: { x: number; y: number }) => {
    const worldX = -offset.x + CHAR_SCREEN_X + 25;
    const worldY = -offset.y + CHAR_SCREEN_Y + 25;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT)
      return true;
    return !isWalkable(tiles[tileY][tileX]);
  };

  const moveMap = useCallback(
    (dir: Direction) => {
      setDirection(dir);
      const newOffset = { ...mapOffset };
      switch (dir) {
        case "up":
          newOffset.y += STEP;
          break;
        case "down":
          newOffset.y -= STEP;
          break;
        case "left":
          newOffset.x += STEP;
          break;
        case "right":
          newOffset.x -= STEP;
          break;
      }
      if (!isTileBlocked(newOffset)) {
        setMapOffset(newOffset);
        setFrameIndex((prev) => (prev + 1) % 3);
      }
    },
    [mapOffset, tiles, isTileBlocked],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          moveMap("up");
          break;
        case "ArrowDown":
          moveMap("down");
          break;
        case "ArrowLeft":
          moveMap("left");
          break;
        case "ArrowRight":
          moveMap("right");
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moveMap]);

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
      {/* Map border */}
      {/* Dynamic CSS Border */}
      <div
        style={{
          position: "absolute",
          top: mapOffset.y,
          left: mapOffset.x,
          width: MAP_WIDTH * TILE_SIZE,
          height: MAP_HEIGHT * TILE_SIZE,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {/* TOP - Castle Wall */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 60,
            background:
              "repeating-linear-gradient(90deg, #555 0px, #555 40px, #666 40px, #666 80px)",
            borderBottom: "6px solid #333",
          }}
        />

        {/* BOTTOM - Wooden Spikes */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 70,
            background:
              "repeating-linear-gradient(90deg, #8B4513 0px, #8B4513 20px, #A0522D 20px, #A0522D 40px)",
            clipPath:
              "polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)",
          }}
        />

        {/* LEFT - Cliff Rock */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 60,
            height: "100%",
            background:
              "repeating-linear-gradient(180deg, #3a3a3a 0px, #3a3a3a 30px, #4a4a4a 30px, #4a4a4a 60px)",
            borderRight: "6px solid #222",
          }}
        />

        {/* RIGHT - Dark Forest Edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 60,
            height: "100%",
            background:
              "repeating-linear-gradient(180deg, #0f3d0f 0px, #0f3d0f 40px, #145214 40px, #145214 80px)",
            borderLeft: "6px solid #081f08",
          }}
        />
      </div>

      {/* Map tiles and objects */}
      <div
        style={{
          position: "absolute",
          top: mapOffset.y,
          left: mapOffset.x,
          width: MAP_WIDTH * TILE_SIZE,
          height: MAP_HEIGHT * TILE_SIZE,
        }}
      >
        {tiles.map((row, y) =>
          row.map((tile, x) => (
            <Tile
              key={`${x}-${y}`}
              type={tile}
              size={TILE_SIZE}
              top={y * TILE_SIZE}
              left={x * TILE_SIZE}
            />
          )),
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
