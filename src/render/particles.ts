// Sprite kecil untuk efek: hati, koin, not musik, Zzz, kilau, kepulan, dan ikon.

import { gridImage, outline, type Grid, type PixelImage } from "./pixel";

const SHAPES: Record<string, { grid: Grid; palette: Record<string, string>; outline?: boolean }> = {
  heart: {
    grid: [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."],
    palette: { r: "#ef5a6f" },
    outline: true,
  },
  coin: {
    grid: [".yy.", "yYyy", "yYyy", ".yy."],
    palette: { y: "#f2c43a", Y: "#fff0a8" },
    outline: true,
  },
  note: {
    grid: ["..nn", "..n.", "..n.", "nnn.", "nn.."],
    palette: { n: "#3a2a2a" },
  },
  z: {
    grid: ["zzz", ".z.", "zzz"],
    palette: { z: "#6a78b8" },
  },
  sparkle: {
    grid: [".w.", "wWw", ".w."],
    palette: { w: "#fff6c0", W: "#ffffff" },
  },
  poof: {
    grid: [".ww.w.", "wwwwww", "wwwwww", ".wwww."],
    palette: { w: "#f4efe6" },
    outline: true,
  },
  dot: {
    grid: ["k"],
    palette: { k: "#ffffff" },
  },
  steam: {
    grid: [".s", "s.", ".s"],
    palette: { s: "#ffffff" },
  },
};

const cache = new Map<string, PixelImage>();

export type ParticleShape = keyof typeof SHAPES;

export function particleImage(shape: ParticleShape): PixelImage {
  let img = cache.get(shape);
  if (!img) {
    const s = SHAPES[shape];
    img = gridImage(s.grid, s.palette);
    if (s.outline) img = outline(img, "#3a2a2a");
    cache.set(shape, img);
  }
  return img;
}
