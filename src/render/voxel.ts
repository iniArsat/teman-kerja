// Penggambar voxel isometrik 2:1. Setiap kubus menjadi segi enam 4x4 piksel:
//
//   .TT.    T = sisi atas (warna asli)
//   LTTR    L = sisi yang menghadap +y (kiri bawah layar), sedikit lebih gelap
//   LLRR    R = sisi yang menghadap +x (kanan bawah layar), paling gelap
//   .LR.
//
// Proyeksi: layarX = 2(x − y), layarY = (x + y) − 2z. Arah pandang (1,1,1), jadi
// kubus digambar urut x+y+z dari kecil (jauh) ke besar (dekat).

import { createImage, rgb, type PixelImage } from "./pixel";

export type VoxelColor = string;
export type ColorFn = (x: number, y: number, z: number) => VoxelColor | null;

const OFFSET = 128;
const SPAN = 256;

function key(x: number, y: number, z: number): number {
  return (x + OFFSET) + (y + OFFSET) * SPAN + (z + OFFSET) * SPAN * SPAN;
}

export class VoxelModel {
  readonly cells = new Map<number, VoxelColor>();

  set(x: number, y: number, z: number, color: VoxelColor | null): this {
    if (color === null) this.cells.delete(key(x, y, z));
    else this.cells.set(key(x, y, z), color);
    return this;
  }

  get(x: number, y: number, z: number): VoxelColor | undefined {
    return this.cells.get(key(x, y, z));
  }

  /** Isi balok [x, x+w) × [y, y+d) × [z, z+h). */
  box(x: number, y: number, z: number, w: number, d: number, h: number, color: VoxelColor | ColorFn): this {
    for (let k = z; k < z + h; k++) {
      for (let j = y; j < y + d; j++) {
        for (let i = x; i < x + w; i++) {
          const c = typeof color === "function" ? color(i, j, k) : color;
          if (c) this.set(i, j, k, c);
        }
      }
    }
    return this;
  }

  /** Hapus balok. */
  carve(x: number, y: number, z: number, w: number, d: number, h: number): this {
    for (let k = z; k < z + h; k++) for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) this.set(i, j, k, null);
    return this;
  }

  /** Salin model lain dengan geseran. */
  add(other: VoxelModel, dx = 0, dy = 0, dz = 0): this {
    other.forEach((x, y, z, c) => this.set(x + dx, y + dy, z + dz, c));
    return this;
  }

  forEach(cb: (x: number, y: number, z: number, color: VoxelColor) => void): void {
    for (const [k, c] of this.cells) {
      const x = (k % SPAN) - OFFSET;
      const y = (Math.floor(k / SPAN) % SPAN) - OFFSET;
      const z = Math.floor(k / (SPAN * SPAN)) - OFFSET;
      cb(x, y, z, c);
    }
  }

  /** Tukar sumbu x dan y (barang menghadap +x, bukan +y). */
  swapXY(): VoxelModel {
    const out = new VoxelModel();
    this.forEach((x, y, z, c) => out.set(y, x, z, c));
    return out;
  }

  /** Cermin sepanjang sumbu x di dalam lebar w. */
  mirrorX(w: number): VoxelModel {
    const out = new VoxelModel();
    this.forEach((x, y, z, c) => out.set(w - 1 - x, y, z, c));
    return out;
  }

  get size(): number {
    return this.cells.size;
  }
}

export function project(x: number, y: number, z: number): { sx: number; sy: number } {
  return { sx: 2 * (x - y), sy: x + y - 2 * z };
}

export interface VoxelSprite {
  img: PixelImage;
  /** Posisi titik dunia (0,0,0) di dalam gambar. */
  ox: number;
  oy: number;
  /** Kedalaman tiap piksel: x+y+z kubus yang terlihat (makin besar makin dekat). */
  depth: Int32Array;
}

/** Kedalaman piksel kosong. */
export const NO_DEPTH = -(1 << 20);

export interface RenderOptions {
  /** Kecerahan sisi kiri (L) dan kanan (R) relatif terhadap sisi atas. */
  left?: number;
  right?: number;
  /** Garis gelap di tepi depan benda yang berada di depan benda lain. */
  edges?: boolean;
  edgeColor?: string;
  /** Garis tepi di sekeliling bentuk. */
  outline?: string | null;
  /** Batas gambar tetap (koordinat layar dunia), agar posisi tidak bergeser antar-gambar. */
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Gambar model voxel. Hanya sisi yang terlihat yang dihitung, lalu dilukis dari
 * belakang ke depan. Juga menyimpan kedalaman tiap piksel untuk garis tepi dalam.
 */
export function renderVoxels(model: VoxelModel, opts: RenderOptions = {}): VoxelSprite {
  const left = opts.left ?? 0.84;
  const right = opts.right ?? 0.68;
  const list: { x: number; y: number; z: number; c: VoxelColor; d: number }[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  model.forEach((x, y, z, c) => {
    // Kubus yang tertutup penuh oleh tetangga atas, depan-kiri, dan depan-kanan tidak terlihat.
    if (model.get(x, y, z + 1) && model.get(x + 1, y, z) && model.get(x, y + 1, z)) return;
    const { sx, sy } = project(x, y, z + 1);
    list.push({ x, y, z, c, d: x + y + z });
    if (sx - 2 < minX) minX = sx - 2;
    if (sx + 2 > maxX) maxX = sx + 2;
    if (sy < minY) minY = sy;
    if (sy + 4 > maxY) maxY = sy + 4;
  });
  if (opts.bounds) ({ minX, minY, maxX, maxY } = opts.bounds);
  if (list.length === 0 && !opts.bounds) return { img: createImage(1, 1), ox: 0, oy: 0, depth: new Int32Array(1).fill(NO_DEPTH) };
  const pad = opts.outline ? 1 : 0;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const img = createImage(w, h);
  const depth = new Int32Array(w * h).fill(NO_DEPTH);
  const ox = -minX + pad;
  const oy = -minY + pad;

  list.sort((a, b) => a.d - b.d || a.z - b.z);
  const shadeCache = new Map<string, [number[], number[], number[]]>();
  // Warna "atas|samping" memberi sisi atas warna berbeda (misalnya isi cangkir).
  const shades = (c: string): [number[], number[], number[]] => {
    let s = shadeCache.get(c);
    if (!s) {
      const bar = c.indexOf("|");
      const [r, g, b] = rgb(bar < 0 ? c : c.slice(0, bar));
      const [sr, sg, sb] = bar < 0 ? [r, g, b] : rgb(c.slice(bar + 1));
      s = [
        [r, g, b],
        [sr * left, sg * left, sb * left],
        [sr * right, sg * right, sb * right],
      ];
      shadeCache.set(c, s);
    }
    return s;
  };
  const put = (px: number, py: number, col: number[], d: number) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = py * w + px;
    const di = i * 4;
    img.data[di] = col[0];
    img.data[di + 1] = col[1];
    img.data[di + 2] = col[2];
    img.data[di + 3] = 255;
    depth[i] = d;
  };

  for (const v of list) {
    const { sx, sy } = project(v.x, v.y, v.z + 1);
    const bx = sx - 2 + ox;
    const by = sy + oy;
    const [top, l, r] = shades(v.c);
    put(bx + 1, by, top, v.d);
    put(bx + 2, by, top, v.d);
    put(bx, by + 1, l, v.d);
    put(bx + 1, by + 1, top, v.d);
    put(bx + 2, by + 1, top, v.d);
    put(bx + 3, by + 1, r, v.d);
    put(bx, by + 2, l, v.d);
    put(bx + 1, by + 2, l, v.d);
    put(bx + 2, by + 2, r, v.d);
    put(bx + 3, by + 2, r, v.d);
    put(bx + 1, by + 3, l, v.d);
    put(bx + 2, by + 3, r, v.d);
  }

  if (opts.edges) {
    const [er, eg, eb] = rgb(opts.edgeColor ?? "#3a2a2a");
    const marks: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (img.data[i * 4 + 3] === 0) continue;
        const d = depth[i];
        // Piksel di belakang tepi benda yang jauh lebih dekat menjadi garis.
        const n = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of n) {
          if (j >= 0 && img.data[j * 4 + 3] !== 0 && depth[j] > d + 2) {
            marks.push(i);
            break;
          }
        }
      }
    }
    for (const i of marks) {
      const di = i * 4;
      img.data[di] = (img.data[di] + er * 2) / 3;
      img.data[di + 1] = (img.data[di + 1] + eg * 2) / 3;
      img.data[di + 2] = (img.data[di + 2] + eb * 2) / 3;
    }
  }

  if (opts.outline) {
    const [r, g, b] = rgb(opts.outline);
    const marks: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (img.data[i * 4 + 3] !== 0) continue;
        const near =
          (x > 0 && img.data[(i - 1) * 4 + 3] !== 0) ||
          (x < w - 1 && img.data[(i + 1) * 4 + 3] !== 0) ||
          (y > 0 && img.data[(i - w) * 4 + 3] !== 0) ||
          (y < h - 1 && img.data[(i + w) * 4 + 3] !== 0);
        if (near) marks.push(i);
      }
    }
    for (const i of marks) {
      const di = i * 4;
      img.data[di] = r;
      img.data[di + 1] = g;
      img.data[di + 2] = b;
      img.data[di + 3] = 255;
    }
  }

  return { img, ox, oy, depth };
}
