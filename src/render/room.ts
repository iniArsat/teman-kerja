// Model voxel kamar: alas, lantai bermotif, karpet, dan dua dinding bermotif.

import { BASE_T, ROOM_D, ROOM_H, ROOM_W, RUG } from "./layout";
import { VoxelModel } from "./voxel";

/** Hash bilangan bulat kecil yang stabil (untuk variasi warna yang tidak berkedip). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type WallPattern = (u: number, z: number) => string;
type FloorPattern = (x: number, y: number) => string;

interface WallTheme {
  pattern: WallPattern;
  baseboard: string;
  trim: string;
}

export const WALL_THEMES: Record<string, WallTheme> = {
  krem: {
    pattern: (u, z) => (z % 6 === 5 && u % 2 === 0 ? "#efdcbc" : "#f6e7cd"),
    baseboard: "#c99f74",
    trim: "#fff7ea",
  },
  "garis-hijau": {
    pattern: (u) => (u % 4 < 2 ? "#cfe4c2" : "#b8d7aa"),
    baseboard: "#7f9e6e",
    trim: "#f4fbef",
  },
  "bintik-pink": {
    pattern: (u, z) => ((u + (Math.floor(z / 3) % 2) * 2) % 4 === 1 && z % 3 === 1 ? "#ea9db0" : "#f9dbe1"),
    baseboard: "#d58b9d",
    trim: "#fff1f4",
  },
  bata: {
    pattern: (u, z) => {
      if (z % 3 === 2) return "#e6d0bb";
      const row = Math.floor(z / 3);
      const shift = (row % 2) * 2;
      if ((u + shift) % 5 === 4) return "#e6d0bb";
      const brick = Math.floor((u + shift) / 5);
      return hash2(brick, row, 3) < 0.4 ? "#b9573f" : "#c8664d";
    },
    baseboard: "#8f4a37",
    trim: "#f2e2d2",
  },
  "panel-kayu": {
    pattern: (u, z) => {
      if (z === 9) return "#7a4f30";
      if (z < 9) return u % 3 === 2 ? "#9a6a42" : "#b07c50";
      return "#f2e4ca";
    },
    baseboard: "#6e4528",
    trim: "#fbf2e2",
  },
  "langit-malam": {
    pattern: (u, z) => {
      const r = hash2(u, z, 7);
      if (r < 0.035) return "#fff3b0";
      if (r < 0.06) return "#9fb0e8";
      return z > 14 ? "#27325e" : "#2f3c6e";
    },
    baseboard: "#1d244a",
    trim: "#4a5a96",
  },
  kawung: {
    pattern: (u, z) => {
      // Motif kawung: empat kelopak lonjong mengelilingi titik pusat, berulang tiap 6.
      const a = ((u % 6) + 6) % 6;
      const b = ((z % 6) + 6) % 6;
      const tile = KAWUNG[5 - b][a];
      return tile === "o" ? "#b07a4e" : tile === "i" ? "#e3c08a" : tile === "c" ? "#8a5a38" : "#f3e5c6";
    },
    baseboard: "#6e3f22",
    trim: "#f8ecd2",
  },
};

const KAWUNG = ["c.oo.c", ".oiio.", "oi..io", "oi..io", ".oiio.", "c.oo.c"];

export const FLOOR_THEMES: Record<string, FloorPattern> = {
  kayu: (x, y) => {
    const plank = Math.floor(y / 3);
    const offset = (plank % 3) * 5;
    if ((x + offset) % 13 === 12) return "#a8744a";
    const tone = hash2(Math.floor((x + offset) / 13), plank, 1);
    if (y % 3 === 2) return tone < 0.5 ? "#bd8656" : "#c48d5c";
    return tone < 0.33 ? "#c8925e" : tone < 0.66 ? "#cf9b68" : "#c38b58";
  },
  "ubin-catur": (x, y) => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? "#f1ebdf" : "#4c4753"),
  tikar: (x, y) => {
    if (y % 8 === 0 || x % 8 === 0) return "#b5513f";
    return (x + y) % 2 === 0 ? "#dcbd7d" : "#cba868";
  },
  teraso: (x, y) => {
    const r = hash2(x, y, 11);
    if (r < 0.08) return "#b3a597";
    if (r < 0.13) return "#d98c6b";
    if (r < 0.17) return "#86a59c";
    return "#e7dfd2";
  },
  parket: (x, y) => {
    const bx = Math.floor(x / 2);
    const by = Math.floor(y / 2);
    const dir = (bx + by) % 2;
    const along = dir === 0 ? x % 2 : y % 2;
    return along === 0 ? "#6e4632" : "#7d523a";
  },
};

type RugPattern = (x: number, y: number) => string | null;

const RUG_CX = RUG.x + RUG.w / 2 - 0.5;
const RUG_CY = RUG.y + RUG.d / 2 - 0.5;

export const RUGS: Record<string, RugPattern> = {
  "karpet-bundar": (x, y) => {
    const dx = (x - RUG_CX) / (RUG.w / 2);
    const dy = (y - RUG_CY) / (RUG.d / 2);
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return null;
    if (r > 0.82) return "#cf7470";
    if (r > 0.6) return "#f0b3a4";
    if (r > 0.42) return "#e48f86";
    return "#f6cdbd";
  },
  "karpet-rumput": (x, y) => {
    if (x < RUG.x || y < RUG.y || x >= RUG.x + RUG.w || y >= RUG.y + RUG.d) return null;
    const r = hash2(x, y, 5);
    return r < 0.3 ? "#6aad4b" : r < 0.55 ? "#8ccd66" : "#7bbf58";
  },
  "karpet-batik": (x, y) => {
    if (x < RUG.x || y < RUG.y || x >= RUG.x + RUG.w || y >= RUG.y + RUG.d) return null;
    const edge = x === RUG.x || y === RUG.y || x === RUG.x + RUG.w - 1 || y === RUG.y + RUG.d - 1;
    if (edge) return "#6e2f22";
    const inner = x === RUG.x + 1 || y === RUG.y + 1 || x === RUG.x + RUG.w - 2 || y === RUG.y + RUG.d - 2;
    if (inner) return "#e2b35a";
    // Parang: garis diagonal berulang.
    const d = (x - y + 64) % 4;
    return d === 0 ? "#7a3524" : d === 1 ? "#e9c47a" : d === 2 ? "#f4e3bd" : "#a4512f";
  },
};

const BASE_TOP = "#9b6a46";
const BASE_SIDE = "#83563a";

/** Bangun model kamar untuk tema dinding, lantai, dan karpet tertentu. */
export function buildRoom(wallId: string, floorId: string, rugId: string | null): VoxelModel {
  const m = new VoxelModel();
  const wall = WALL_THEMES[wallId] ?? WALL_THEMES.krem;
  const floor = FLOOR_THEMES[floorId] ?? FLOOR_THEMES.kayu;
  const rug = rugId ? RUGS[rugId] : undefined;

  // Alas dan lantai.
  for (let y = 0; y < ROOM_D; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      for (let z = -BASE_T; z < -1; z++) m.set(x, y, z, z === -2 ? BASE_TOP : BASE_SIDE);
      m.set(x, y, -1, rug?.(x, y) ?? floor(x, y));
    }
  }

  const wallColor = (u: number, z: number): string => {
    if (z < 0) return z === -1 ? wall.baseboard : BASE_SIDE;
    if (z === ROOM_H - 1) return wall.trim;
    if (z <= 1) return wall.baseboard;
    return wall.pattern(u + 64, z);
  };

  // Dinding kiri (x = −1) termasuk tiang sudut di y = −1, dan dinding kanan (y = −1).
  for (let z = -BASE_T; z < ROOM_H; z++) {
    for (let y = -1; y < ROOM_D; y++) m.set(-1, y, z, wallColor(y, z));
    for (let x = 0; x < ROOM_W; x++) m.set(x, -1, z, wallColor(x, z));
  }
  return m;
}
