// Menyusun satu bingkai: gambar kamar statis + karakter dengan uji kedalaman,
// lalu pencahayaan (senja/malam dan cahaya lampu), lalu efek di paling atas.

import { createImage, rgb, type PixelImage } from "./pixel";
import type { ScreenGlow, StaticScene } from "./staticScene";
import { NO_DEPTH } from "./voxel";

export interface DrawSprite {
  img: PixelImage;
  /** Posisi kiri-atas di gambar kamar. */
  x: number;
  y: number;
  /** Kedalaman baris pertama sprite dan perubahan per baris ke bawah. */
  depthTop: number;
  depthPerRow: number;
  /** Abaikan kedalaman (selalu di depan). */
  front?: boolean;
  /** Kegelapan 0..1 (untuk bayangan dan efek pudar). */
  alpha?: number;
}

/** Sprite berdiri tegak di titik dunia `feet`, dengan kaki di baris `feetRow`. */
export function billboard(img: PixelImage, x: number, y: number, feetDepth: number, feetRow: number): DrawSprite {
  return { img, x, y, depthTop: feetDepth + feetRow / 2, depthPerRow: -0.5 };
}

export interface Lighting {
  /** Pengali warna (1 = tanpa perubahan). */
  tint: [number, number, number];
  glows: ScreenGlow[];
  /** 0..1: seberapa kuat lampu terlihat. */
  glowStrength: number;
}

export const DAYLIGHT: Lighting = { tint: [1, 1, 1], glows: [], glowStrength: 0 };

/** Pencahayaan menurut jam (desimal). */
export function lightingAt(hour: number, glows: ScreenGlow[]): Lighting {
  const keyframes: [number, [number, number, number], number][] = [
    [0, [0.52, 0.56, 0.82], 1],
    [5, [0.55, 0.58, 0.82], 1],
    [6.5, [0.95, 0.86, 0.86], 0.3],
    [8, [1, 1, 1], 0],
    [16, [1, 1, 1], 0],
    [17.5, [1, 0.9, 0.78], 0.35],
    [19, [0.72, 0.68, 0.88], 0.8],
    [20.5, [0.55, 0.58, 0.84], 1],
    [24, [0.52, 0.56, 0.82], 1],
  ];
  let i = 0;
  while (i < keyframes.length - 2 && hour >= keyframes[i + 1][0]) i++;
  const [h0, t0, g0] = keyframes[i];
  const [h1, t1, g1] = keyframes[i + 1];
  const f = Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
  const tint: [number, number, number] = [t0[0] + (t1[0] - t0[0]) * f, t0[1] + (t1[1] - t0[1]) * f, t0[2] + (t1[2] - t0[2]) * f];
  return { tint, glows, glowStrength: g0 + (g1 - g0) * f };
}

const MARGIN = 0.75;

export class FrameComposer {
  readonly out: PixelImage;
  private depth: Float32Array;
  private baseDepth: Float32Array;

  constructor(private scene: StaticScene) {
    this.out = createImage(scene.img.w, scene.img.h);
    this.depth = new Float32Array(scene.img.w * scene.img.h);
    this.baseDepth = new Float32Array(scene.img.w * scene.img.h);
    this.setScene(scene);
  }

  setScene(scene: StaticScene): void {
    this.scene = scene;
    for (let i = 0; i < scene.depth.length; i++) {
      const d = scene.depth[i];
      this.baseDepth[i] = d === NO_DEPTH ? -1e9 : d + 1.5;
    }
  }

  compose(sprites: DrawSprite[], light: Lighting, overlays: DrawSprite[] = []): PixelImage {
    const { out, scene } = this;
    out.data.set(scene.img.data);
    this.depth.set(this.baseDepth);
    for (const s of sprites) this.drawSprite(s);
    this.applyLight(light);
    for (const s of overlays) this.drawSprite({ ...s, front: true });
    return out;
  }

  private drawSprite(s: DrawSprite): void {
    const { out, depth } = this;
    const W = out.w;
    const H = out.h;
    const alpha = s.alpha ?? 1;
    for (let r = 0; r < s.img.h; r++) {
      const ty = s.y + r;
      if (ty < 0 || ty >= H) continue;
      const d = s.depthTop + s.depthPerRow * r;
      for (let c = 0; c < s.img.w; c++) {
        const tx = s.x + c;
        if (tx < 0 || tx >= W) continue;
        const si = (r * s.img.w + c) * 4;
        const a = (s.img.data[si + 3] / 255) * alpha;
        if (a <= 0) continue;
        const i = ty * W + tx;
        if (!s.front && d + MARGIN < depth[i]) continue;
        const di = i * 4;
        if (a >= 1) {
          out.data[di] = s.img.data[si];
          out.data[di + 1] = s.img.data[si + 1];
          out.data[di + 2] = s.img.data[si + 2];
          out.data[di + 3] = 255;
          if (!s.front) depth[i] = d;
        } else {
          out.data[di] = out.data[di] * (1 - a) + s.img.data[si] * a;
          out.data[di + 1] = out.data[di + 1] * (1 - a) + s.img.data[si + 1] * a;
          out.data[di + 2] = out.data[di + 2] * (1 - a) + s.img.data[si + 2] * a;
          out.data[di + 3] = Math.max(out.data[di + 3], a * 255);
        }
      }
    }
  }

  private applyLight(light: Lighting): void {
    const [tr, tg, tb] = light.tint;
    if (tr >= 0.999 && tg >= 0.999 && tb >= 0.999) return;
    const { out } = this;
    const W = out.w;
    const glows = light.glowStrength > 0 ? light.glows.map((g) => ({ ...g, c: rgb(g.color) })) : [];
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < W; x++) {
        const di = (y * W + x) * 4;
        if (out.data[di + 3] === 0) continue;
        let r = out.data[di];
        let g = out.data[di + 1];
        let b = out.data[di + 2];
        // Seberapa terang tempat ini oleh lampu (0..1).
        let lit = 0;
        let lr = 0;
        let lg = 0;
        let lb = 0;
        for (const glow of glows) {
          const dx = x - glow.sx;
          const dy = (y - glow.sy) * 1.6;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= glow.r) continue;
          const f = (1 - dist / glow.r) ** 1.4 * light.glowStrength;
          lit = Math.max(lit, f);
          lr += glow.c[0] * f;
          lg += glow.c[1] * f;
          lb += glow.c[2] * f;
        }
        const mr = tr + (1 - tr) * lit;
        const mg = tg + (1 - tg) * lit;
        const mb = tb + (1 - tb) * lit;
        r = r * mr + lr * 0.18;
        g = g * mg + lg * 0.18;
        b = b * mb + lb * 0.18;
        out.data[di] = r > 255 ? 255 : r;
        out.data[di + 1] = g > 255 ? 255 : g;
        out.data[di + 2] = b > 255 ? 255 : b;
      }
    }
  }
}
