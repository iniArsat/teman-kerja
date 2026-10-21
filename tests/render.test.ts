import { describe, expect, it } from "vitest";
import { COSMETICS, GUESTS, HAIR_COLORS, ITEMS, SKINS, SLOTS, THEMES, TOP_COLORS } from "../src/core/data";
import { defaultRoom } from "../src/core/state";
import { ANIMALS, animalFrames } from "../src/render/animals";
import { renderAvatar, type AvatarPose } from "../src/render/avatar";
import { CHAIR, DESK, DESK_SLOTS, FLOOR_ITEM_MAX_H, FLOOR_SLOTS, FLOOR_SPOTS, ROOM_D, ROOM_H, ROOM_W, RUG_SEAT, WALL_SLOTS } from "../src/render/layout";
import { floorItemModel, wallItemModel } from "../src/render/models";
import { project } from "../src/render/voxel";
import { FrameComposer, lightingAt } from "../src/render/compose";
import { FLOOR_THEMES, RUGS, WALL_THEMES } from "../src/render/room";
import { buildStaticScene } from "../src/render/staticScene";
import { itemThumb, themeThumb } from "../src/render/thumbs";
import type { PixelImage } from "../src/render/pixel";

function opaque(img: PixelImage): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++;
  return n;
}

describe("gambar", () => {
  it("setiap barang dan tema punya gambar", () => {
    for (const item of ITEMS) expect(opaque(itemThumb(item.id)), item.id).toBeGreaterThan(20);
    for (const theme of THEMES) expect(opaque(themeThumb(theme.id)), theme.id).toBeGreaterThan(100);
    for (const t of THEMES.filter((t) => t.part === "dinding")) expect(WALL_THEMES[t.id], t.id).toBeDefined();
    for (const t of THEMES.filter((t) => t.part === "lantai")) expect(FLOOR_THEMES[t.id], t.id).toBeDefined();
    for (const i of ITEMS.filter((i) => i.kind === "karpet")) expect(RUGS[i.id], i.id).toBeDefined();
  });

  it("setiap tamu punya sprite dengan palet lengkap", () => {
    for (const g of GUESTS) {
      const art = ANIMALS[g.id];
      expect(art, g.id).toBeDefined();
      const letters = new Set(art.grid.join("").replace(/\./g, ""));
      for (const ch of letters) expect(art.palette[ch], `${g.id}:${ch}`).toBeDefined();
      const f = animalFrames(g.id);
      expect(opaque(f.idle)).toBeGreaterThan(30);
      expect(f.blink.w).toBe(f.idle.w);
      expect(f.blink.data).not.toEqual(f.idle.data);
    }
  });

  it("semua kombinasi avatar bisa digambar", () => {
    const poses: AvatarPose[] = ["ketik-a", "ketik-b", "diam", "minum", "regang", "lambai", "tidur"];
    for (const c of COSMETICS) {
      const avatar = {
        skin: SKINS[0].id,
        hair: c.slot === "rambut" ? c.id : "pendek",
        hairColor: HAIR_COLORS[1].id,
        top: c.slot === "atasan" ? c.id : "kaos",
        topColor: TOP_COLORS[2].id,
        accessory: c.slot === "aksesori" ? c.id : "tanpa",
      };
      for (const pose of poses) {
        const f = renderAvatar(avatar, pose, "biasa");
        expect(opaque(f.body), `${c.id}:${pose}`).toBeGreaterThan(150);
      }
    }
  });
});

describe("tata letak", () => {
  it("barang lantai tidak menutupi barang dinding, barang dinding muat di dinding", () => {
    const height = (m: { forEach: (cb: (x: number, y: number, z: number) => void) => void }) => {
      let top = 0;
      m.forEach((_x, _y, z) => (top = Math.max(top, z + 1)));
      return top;
    };
    for (const item of ITEMS) {
      if (item.kind === "lantai") expect(height(floorItemModel(item.id)!.model), item.id).toBeLessThanOrEqual(FLOOR_ITEM_MAX_H);
      if (item.kind === "dinding") {
        const top = height(wallItemModel(item.id, 12, 0)!.model);
        for (const slot of Object.values(WALL_SLOTS)) expect(slot.z + top, item.id).toBeLessThanOrEqual(ROOM_H - 1);
      }
    }
  });

  it("slot gambar sama dengan slot inti", () => {
    const layout = new Set([...Object.keys(FLOOR_SLOTS), ...Object.keys(WALL_SLOTS), ...Object.keys(DESK_SLOTS), "karpet"]);
    expect(layout).toEqual(new Set(SLOTS.map((s) => s.id)));
  });

  it("titik tamu di lantai bebas, tidak menabrak meja, kursi, atau barang", () => {
    const boxes = [
      { x: DESK.x, y: DESK.y, w: DESK.w, d: DESK.d },
      { x: CHAIR.x, y: CHAIR.y - 1, w: CHAIR.w, d: CHAIR.d + 1 },
      ...Object.values(FLOOR_SLOTS),
    ];
    for (const p of FLOOR_SPOTS) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(ROOM_W);
      expect(p.y).toBeLessThan(ROOM_D);
      for (const b of boxes) {
        const inside = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.d;
        expect(inside, `${p.x},${p.y}`).toBe(false);
      }
    }
  });

  it("tempat duduk tamu tidak bertumpuk di layar", () => {
    const seats = [...FLOOR_SPOTS, RUG_SEAT].map((p) => project(p.x, p.y, 0));
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const d = Math.hypot(seats[i].sx - seats[j].sx, seats[i].sy - seats[j].sy);
        expect(d, `${i}-${j}`).toBeGreaterThan(9);
      }
    }
  });

  it("kamar penuh barang tetap bisa disusun", () => {
    const room = defaultRoom();
    const byKind = (kind: string) => ITEMS.filter((i) => i.kind === kind).map((i) => i.id);
    const floor = byKind("lantai");
    const wall = byKind("dinding");
    SLOTS.forEach((slot, i) => {
      if (slot.kind === "lantai") room.slots[slot.id] = floor[i % floor.length];
      if (slot.kind === "dinding") room.slots[slot.id] = wall[i % wall.length];
    });
    room.slots.karpet = "karpet-batik";
    const scene = buildStaticScene(room, 21, 30);
    for (const id of Object.keys(FLOOR_SLOTS)) expect(scene.anchors[id], id).toBeDefined();
    expect(scene.glows.length).toBeGreaterThan(0);
    const composer = new FrameComposer(scene);
    const out = composer.compose([], lightingAt(21.5, scene.glows));
    expect(out.w).toBe(scene.img.w);
    expect(opaque(out)).toBe(opaque(scene.img));
  });

  it("pencahayaan: siang tanpa perubahan, malam lebih gelap", () => {
    expect(lightingAt(12, []).tint).toEqual([1, 1, 1]);
    const night = lightingAt(23, []);
    expect(night.tint[0]).toBeLessThan(0.7);
    expect(night.glowStrength).toBe(1);
  });
});
