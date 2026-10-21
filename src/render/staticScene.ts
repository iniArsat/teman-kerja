// Bagian kamar yang tidak bergerak (dinding, lantai, karpet, barang, meja, kursi)
// digambar sekali sebagai satu model voxel, lengkap dengan peta kedalaman.
// Karakter lalu digambar di atasnya dengan uji kedalaman per piksel.

import { ITEM_BY_ID } from "../core/data";
import type { RoomState } from "../core/types";
import { BASE_T, DESK, DESK_SLOTS, FLOOR_SLOTS, LAPTOP, ROOM_D, ROOM_H, ROOM_W, RUG_SEAT, WALL_SLOTS } from "./layout";
import { C, chairModel, deskItemModel, deskModel, floorItemModel, laptopBaseModel, laptopLidModel, wallItemModel, type Glow } from "./models";
import type { PixelImage } from "./pixel";
import { buildRoom } from "./room";
import { project, renderVoxels, VoxelModel } from "./voxel";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface ScreenGlow {
  sx: number;
  sy: number;
  r: number;
  color: string;
}

export interface StaticScene {
  img: PixelImage;
  depth: Int32Array;
  /** Posisi titik dunia (0,0,0) di gambar. */
  ox: number;
  oy: number;
  glows: ScreenGlow[];
  /** Tempat duduk tamu per slot (koordinat dunia). */
  anchors: Record<string, Point3>;
}

/** Batas layar kamar: tetap untuk semua isi agar posisi karakter stabil. */
export function sceneBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
  const corners = [
    project(-1, ROOM_D, -BASE_T),
    project(ROOM_W, -1, -BASE_T),
    project(ROOM_W, ROOM_D, -BASE_T),
    project(-1, -1, ROOM_H),
  ];
  const xs = corners.map((c) => c.sx);
  const ys = corners.map((c) => c.sy);
  // Ruang tambahan di atas dinding untuk gelembung dan efek, dan sedikit di sisi.
  return { minX: Math.min(...xs) - 4, maxX: Math.max(...xs) + 4, minY: Math.min(...ys) - 12, maxY: Math.max(...ys) + 2 };
}

export function screenOf(scene: { ox: number; oy: number }, p: Point3): { sx: number; sy: number } {
  const { sx, sy } = project(p.x, p.y, p.z);
  return { sx: sx + scene.ox, sy: sy + scene.oy };
}

function maxU(model: VoxelModel): number {
  let max = 0;
  model.forEach((u) => {
    if (u > max) max = u;
  });
  return max;
}

/** Bangun model gabungan kamar dan isinya. */
export function buildStaticModel(room: RoomState, hour: number, minute: number): {
  model: VoxelModel;
  glows: (Glow & { world: true })[];
  anchors: Record<string, Point3>;
} {
  const rug = room.slots["karpet"] ?? null;
  const model = buildRoom(room.wall, room.floor, rug && ITEM_BY_ID[rug]?.kind === "karpet" ? rug : null);
  const glows: (Glow & { world: true })[] = [];
  const anchors: Record<string, Point3> = {};

  // Barang dinding.
  for (const [slotId, slot] of Object.entries(WALL_SLOTS)) {
    const id = room.slots[slotId];
    const item = id ? wallItemModel(id, hour, minute) : null;
    if (!item) continue;
    const width = maxU(item.model);
    const place = (u: number, v: number, z: number): Point3 =>
      slot.wall === "kanan" ? { x: slot.u + u, y: v, z: slot.z + z } : { x: v, y: slot.u + (width - u), z: slot.z + z };
    let top = 0;
    item.model.forEach((u, v, z, c) => {
      const p = place(u, v, z);
      model.set(p.x, p.y, p.z, c);
      if (z > top) top = z;
    });
    // Burung hinggap di atas barang dinding.
    anchors[slotId] = place(width / 2, 0.6, top + 1);
    if (item.glow) glows.push({ ...place(item.glow.x, item.glow.y, item.glow.z), r: item.glow.r, color: item.glow.color, world: true });
  }

  // Meja kerja, kursi, laptop.
  model.add(chairModel());
  model.add(deskModel());
  model.add(laptopBaseModel());
  model.add(laptopLidModel());
  // Layar laptop menerangi wajah avatar saat gelap.
  glows.push({ x: LAPTOP.x + 2, y: LAPTOP.y + 1.5, z: DESK.top + 3, r: 16, color: "#a8d8ff", world: true });
  for (const [slotId, pos] of Object.entries(DESK_SLOTS)) {
    const id = room.slots[slotId];
    const item = id ? deskItemModel(id) : null;
    if (!item) continue;
    // Barang meja kanan digeser agar tidak keluar dari tepi meja.
    model.add(item.model, pos.x, pos.y, DESK.top);
    if (item.glow) glows.push({ x: pos.x + item.glow.x, y: pos.y + item.glow.y, z: DESK.top + item.glow.z, r: item.glow.r, color: item.glow.color, world: true });
  }

  // Barang lantai.
  for (const [slotId, slot] of Object.entries(FLOOR_SLOTS)) {
    const id = room.slots[slotId];
    const item = id ? floorItemModel(id) : null;
    const toWorld = (x: number, y: number, z: number): Point3 =>
      slot.facing === "y" ? { x: slot.x + x, y: slot.y + y, z } : { x: slot.x + y, y: slot.y + x, z };
    if (!item) {
      anchors[slotId] = { x: slot.x + slot.w / 2, y: slot.y + slot.d / 2, z: 0 };
      continue;
    }
    const m = slot.facing === "y" ? item.model : item.model.swapXY();
    model.add(m, slot.x, slot.y, 0);
    const a = item.anchor ?? { x: 3, y: 5.5, z: 0 };
    anchors[slotId] = toWorld(a.x, a.y, a.z);
    if (item.glow) glows.push({ ...toWorld(item.glow.x, item.glow.y, item.glow.z), r: item.glow.r, color: item.glow.color, world: true });
  }

  // Karpet: tamu duduk di tengahnya.
  anchors["karpet"] = { x: RUG_SEAT.x, y: RUG_SEAT.y, z: 0 };
  return { model, glows, anchors };
}

export function buildStaticScene(room: RoomState, hour: number, minute: number): StaticScene {
  const { model, glows, anchors } = buildStaticModel(room, hour, minute);
  const sprite = renderVoxels(model, { edges: true, edgeColor: C.outline, outline: C.outline, bounds: sceneBounds() });
  return {
    img: sprite.img,
    depth: sprite.depth,
    ox: sprite.ox,
    oy: sprite.oy,
    anchors,
    glows: glows.map((g) => {
      const { sx, sy } = project(g.x, g.y, g.z);
      return { sx: sx + sprite.ox, sy: sy + sprite.oy, r: g.r, color: g.color };
    }),
  };
}
