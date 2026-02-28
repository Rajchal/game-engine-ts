// ---------------- RNG: ChaCha12 ----------------

class ChaCha12 {
  private state: Uint32Array;
  private keystream: Uint8Array = new Uint8Array(64);
  private ksIndex = 64;

  constructor(key32: Uint32Array, nonce32: Uint32Array) {
    // key32: 8 u32 (32 bytes), nonce32: 2 u32 (64-bit nonce)
    this.state = new Uint32Array(16);
    const C = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
    this.state.set(C, 0); // 0..3  constants
    this.state.set(key32, 4); // 4..11 key
    this.state[12] = 0; // counter low
    this.state[13] = 0; // counter high
    // nonce32 is 2 words, placed at 14..15
    this.state[14] = nonce32[0];
    this.state[15] = nonce32[1];
  }

  private rotate(v: number, c: number): number {
    return ((v << c) | (v >>> (32 - c))) >>> 0;
  }

  // Quarter round operates on a working copy passed in
  private quarter(st: Uint32Array, a: number, b: number, c: number, d: number) {
    st[a] = (st[a] + st[b]) >>> 0;
    st[d] = this.rotate(st[d] ^ st[a], 16);
    st[c] = (st[c] + st[d]) >>> 0;
    st[b] = this.rotate(st[b] ^ st[c], 12);
    st[a] = (st[a] + st[b]) >>> 0;
    st[d] = this.rotate(st[d] ^ st[a], 8);
    st[c] = (st[c] + st[d]) >>> 0;
    st[b] = this.rotate(st[b] ^ st[c], 7);
  }

  private refillKeystream() {
    // Save original state before mixing
    const original = new Uint32Array(this.state);

    // Run 12 rounds (6 pairs) on a working copy
    const working = new Uint32Array(this.state);
    for (let i = 0; i < 6; i++) {
      // column rounds
      this.quarter(working, 0, 4, 8, 12);
      this.quarter(working, 1, 5, 9, 13);
      this.quarter(working, 2, 6, 10, 14);
      this.quarter(working, 3, 7, 11, 15);
      // diagonal rounds
      this.quarter(working, 0, 5, 10, 15);
      this.quarter(working, 1, 6, 11, 12);
      this.quarter(working, 2, 7, 8, 13);
      this.quarter(working, 3, 4, 9, 14);
    }

    // Add original state to mixed working copy
    for (let i = 0; i < 16; i++) {
      working[i] = (working[i] + original[i]) >>> 0;
    }

    // Increment counter on the main state for next block
    this.state[12] = (original[12] + 1) >>> 0;
    if (this.state[12] === 0) this.state[13] = (original[13] + 1) >>> 0;

    // Flatten output to bytes (little-endian)
    const dv = new DataView(this.keystream.buffer);
    for (let i = 0; i < 16; i++) dv.setUint32(i * 4, working[i], true);
    this.ksIndex = 0;
  }

  private nextU32(): number {
    if (this.ksIndex >= 64) this.refillKeystream();
    const dv = new DataView(this.keystream.buffer);
    const v = dv.getUint32(this.ksIndex, true);
    this.ksIndex += 4;
    return v >>> 0;
  }

  range(min: number, max: number): number {
    // [min, max)
    const span = max - min;
    return min + (this.nextU32() % span);
  }

  genBool(prob: number): boolean {
    return this.nextU32() % 1000 < prob * 1000;
  }
}

// Helper: build key/nonce from a u64 seed
function chachaFromSeedU64(seed: bigint): ChaCha12 {
  const key32 = new Uint32Array(8);
  key32[0] = Number(seed & 0xffffffffn);
  key32[1] = Number((seed >> 32n) & 0xffffffffn);
  // rest are zero
  const nonce32 = new Uint32Array(2); // 2 words = 64-bit nonce, fits in state[14..15]
  return new ChaCha12(key32, nonce32);
}

// ---------------- Terrain generation ----------------

export type TileType = "Grass" | "Water" | "Wall" | "Forest";

export const isWalkable = (t: TileType) => t === "Grass" || t === "Forest";

export function generateWorld(
  seed: number,
  width: number,
  height: number,
): TileType[][] {
  const rng = chachaFromSeedU64(BigInt(seed >>> 0));
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array(width).fill("Grass" as TileType),
  );

  // Water bodies (8)
  for (let i = 0; i < 8; i++) {
    const cx = rng.range(5, width - 5);
    const cy = rng.range(5, height - 5);
    const radius = rng.range(3, 8);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx,
          ny = cy + dy;
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          dx * dx + dy * dy <= radius * radius
        ) {
          tiles[ny][nx] = "Water";
        }
      }
    }
  }

  // Wall clusters (6)
  for (let i = 0; i < 6; i++) {
    const cx = rng.range(5, width - 5);
    const cy = rng.range(5, height - 5);
    const size = rng.range(2, 6);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx,
          ny = cy + dy;
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          rng.genBool(0.6)
        ) {
          tiles[ny][nx] = "Wall";
        }
      }
    }
  }

  // Forest patches (10)
  for (let i = 0; i < 10; i++) {
    const cx = rng.range(3, width - 3);
    const cy = rng.range(3, height - 3);
    const radius = rng.range(2, 5);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx,
          ny = cy + dy;
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          tiles[ny][nx] === "Grass" &&
          rng.genBool(0.7)
        ) {
          tiles[ny][nx] = "Forest";
        }
      }
    }
  }

  // Clear 7x7 spawn at center
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        tiles[ny][nx] = "Grass";
      }
    }
  }

  return tiles;
}
