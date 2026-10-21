// Gambar kecil untuk toko, kamar, dan buku tamu (murni, tanpa DOM).

import { ITEM_BY_ID, THEME_BY_ID } from "../core/data";
import { deskItemModel, floorItemModel, wallItemModel, C } from "./models";
import type { PixelImage } from "./pixel";
import { FLOOR_THEMES, RUGS, WALL_THEMES } from "./room";
import { RUG } from "./layout";
import { renderVoxels, VoxelModel } from "./voxel";

const OPTS = { edges: true, edgeColor: C.outline, outline: C.outline } as const;

export function itemThumb(id: string): PixelImage {
  const def = ITEM_BY_ID[id];
  let model: VoxelModel | null = null;
  if (def?.kind === "lantai") model = floorItemModel(id)?.model ?? null;
  else if (def?.kind === "meja") model = deskItemModel(id)?.model ?? null;
  else if (def?.kind === "dinding") model = wallItemModel(id, 13, 10)?.model ?? null;
  else if (def?.kind === "karpet") {
    const rug = RUGS[id];
    model = new VoxelModel();
    for (let y = RUG.y; y < RUG.y + RUG.d; y++) {
      for (let x = RUG.x; x < RUG.x + RUG.w; x++) {
        const c = rug?.(x, y);
        if (c) model.set(x - RUG.x, y - RUG.y, 0, c);
      }
    }
  }
  return renderVoxels(model ?? new VoxelModel().box(0, 0, 0, 2, 2, 2, "#cccccc"), OPTS).img;
}

/** Pojok kamar mini dengan tema dinding atau lantai tertentu. */
export function themeThumb(id: string): PixelImage {
  const theme = THEME_BY_ID[id];
  const wall = WALL_THEMES[theme?.part === "dinding" ? id : "krem"] ?? WALL_THEMES.krem;
  const floor = FLOOR_THEMES[theme?.part === "lantai" ? id : "kayu"] ?? FLOOR_THEMES.kayu;
  const m = new VoxelModel();
  const N = 8;
  const H = 8;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m.set(x, y, -1, floor(x + 3, y + 3));
  for (let z = -1; z < H; z++) {
    for (let y = -1; y < N; y++) m.set(-1, y, z, z === H - 1 ? wall.trim : z <= 0 ? wall.baseboard : wall.pattern(y + 64, z + 4));
    for (let x = 0; x < N; x++) m.set(x, -1, z, z === H - 1 ? wall.trim : z <= 0 ? wall.baseboard : wall.pattern(x + 64, z + 4));
  }
  return renderVoxels(m, OPTS).img;
}
