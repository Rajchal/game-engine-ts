export type Direction = "up" | "down" | "left" | "right";

interface CharacterProps {
  direction: Direction;
  frameIndex: number;
  top: number;
  left: number;
}

export default function Character({
  direction,
  frameIndex,
  top,
  left,
}: CharacterProps) {
  const spriteMap: Record<Direction, string[]> = {
    down: ["/char/00_char.png", "/char/01_char.png", "/char/02_char.png"],
    right: ["/char/03_char.png", "/char/04_char.png", "/char/05_char.png"],
    up: ["/char/06_char.png", "/char/07_char.png", "/char/08_char.png"],
    left: ["/char/09_char.png", "/char/10_char.png", "/char/11_char.png"],
  };

  return (
    <img
      src={spriteMap[direction][frameIndex]}
      alt="character"
      style={{
        position: "absolute",
        top,
        left,
        width: 50,
        height: 50,
        zIndex: 10,
      }}
    />
  );
}
