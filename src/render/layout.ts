// Tata letak kamar dalam koordinat voxel. Lantai x ∈ [0, W), y ∈ [0, D), permukaan
// lantai di z = 0. Dinding kiri layar berada di x = −1, dinding kanan di y = −1.

export const ROOM_W = 26;
export const ROOM_D = 26;
export const ROOM_H = 24;
/** Tebal alas di bawah lantai (z negatif). */
export const BASE_T = 3;

export interface FloorSlot {
  x: number;
  y: number;
  /** Lebar dan kedalaman jejak barang. */
  w: number;
  d: number;
  /** Barang menghadap +y (bawaan) atau +x (model ditukar sumbunya). */
  facing: "y" | "x";
}

export const FLOOR_SLOTS: Record<string, FloorSlot> = {
  "lantai-1": { x: 0, y: 8, w: 6, d: 6, facing: "x" },
  "lantai-2": { x: 0, y: 16, w: 6, d: 6, facing: "x" },
  "lantai-3": { x: 20, y: 0, w: 6, d: 6, facing: "y" },
  "lantai-4": { x: 20, y: 12, w: 6, d: 6, facing: "y" },
  "lantai-5": { x: 9, y: 20, w: 6, d: 6, facing: "y" },
};

/** Barang lantai paling tinggi sekian voxel, agar tidak menutupi barang dinding (mulai z 14). */
export const FLOOR_ITEM_MAX_H = 13;

export interface WallSlot {
  wall: "kiri" | "kanan";
  /** Posisi awal sepanjang dinding (y untuk dinding kiri, x untuk dinding kanan). */
  u: number;
  z: number;
}

export const WALL_SLOTS: Record<string, WallSlot> = {
  "dinding-1": { wall: "kiri", u: 1, z: 14 },
  "dinding-2": { wall: "kiri", u: 10, z: 14 },
  "dinding-3": { wall: "kanan", u: 3, z: 14 },
  "dinding-4": { wall: "kanan", u: 12, z: 14 },
};

/** Meja kerja. */
export const DESK = { x: 6, y: 7, w: 13, d: 4, top: 7 };

export const DESK_SLOTS: Record<string, { x: number; y: number }> = {
  "meja-1": { x: 6, y: 8 },
  "meja-2": { x: 8, y: 8 },
};

/** Laptop di atas meja: papan ketik di y 7..8, layar berdiri di y = 9. */
export const LAPTOP = { x: 10, y: 7, w: 4 };

/** Kursi dan posisi duduk avatar. */
export const CHAIR = { x: 12, y: 2, w: 4, d: 4, seat: 4 };
export const AVATAR_SEAT = { x: 14, y: 4.5, z: 4 };
/** Tangan di atas papan ketik. */
export const AVATAR_HANDS = { x: 13, y: 7.5, z: 8.3 };

/** Karpet di tengah lantai. */
export const RUG = { x: 7, y: 12, w: 12, d: 10 };

/** Titik lantai bebas untuk tamu (urutan sama dengan "titik:n"). */
export const FLOOR_SPOTS: { x: number; y: number }[] = [
  { x: 16.5, y: 12.5 },
  { x: 18, y: 18 },
  { x: 10.5, y: 11.5 },
  { x: 7.5, y: 17 },
  { x: 21.5, y: 9 },
  { x: 4.5, y: 23.5 },
];

/** Tempat duduk tamu di tengah karpet. */
export const RUG_SEAT = { x: 12.5, y: 16.5 };

/** Pintu masuk tamu: dari tepi depan kanan lantai. */
export const DOOR = { x: 24.5, y: 24.5 };
