import type { TileType } from "../utils/WorldGen";

interface TileProps {
  type: TileType;
  size: number;
  top: number;
  left: number;
}

export default function Tile({ type, size, top, left }: TileProps) {
  const src = `/tiles/${type.toLowerCase()}.png`;
  return (
    <img
      src={src}
      alt={type}
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        objectFit: "cover",
        pointerEvents: "none",
      }}
    />
  );
}
