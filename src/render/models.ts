// Model voxel barang-barang. Barang lantai digambar dalam jejak 6×6 menghadap +y
// (punggung di y = 0). Barang dinding memakai sumbu (u sepanjang dinding,
// v keluar dari dinding, z ke atas). Barang meja memakai jejak 3×3.

import { hash2 } from "./room";
import { VoxelModel } from "./voxel";

export const C = {
  outline: "#3a2a2a",
  wood: "#c8925e",
  woodMid: "#a8754a",
  woodDark: "#7a5236",
  woodDeep: "#5e3d27",
  white: "#f4efe6",
  cream: "#efe2c8",
  gray: "#9aa3ad",
  grayDark: "#5c6370",
  black: "#3d3a44",
  leaf: "#5fae5a",
  leafDark: "#3f8a45",
  leafLight: "#8cd06a",
  terracotta: "#c86f4a",
  terracottaDark: "#a85a3a",
  soil: "#5a3a2a",
  orange: "#f08a3c",
  red: "#d4574a",
  yellow: "#f0c24e",
  blue: "#5b8fd6",
  teal: "#4fa39a",
  pink: "#e58fa0",
  gold: "#d9a441",
  goldDark: "#a8792a",
};

export interface Glow {
  /** Pusat cahaya dalam koordinat model. */
  x: number;
  y: number;
  z: number;
  /** Jari-jari cahaya, piksel layar. */
  r: number;
  color: string;
}

export interface ItemModel {
  model: VoxelModel;
  /** Tempat tamu duduk/hinggap, koordinat model. */
  anchor?: { x: number; y: number; z: number };
  glow?: Glow;
}

function weave(x: number, y: number, z: number): string {
  return (x + y + z) % 2 === 0 ? C.wood : "#b07a4a";
}

function basket(m: VoxelModel): void {
  m.box(1, 1, 0, 4, 4, 3, weave);
  m.carve(2, 2, 1, 2, 2, 2);
  m.box(2, 2, 1, 2, 2, 1, C.woodDark);
}

function disc(m: VoxelModel, cx: number, cy: number, z: number, rx: number, ry: number, color: string | ((x: number, y: number) => string)): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) m.set(x, y, z, typeof color === "function" ? color(x, y) : color);
    }
  }
}

// ---------------------------------------------------------------------------
// Barang lantai

const FLOOR_MODELS: Record<string, () => ItemModel> = {
  bantal() {
    const m = new VoxelModel();
    m.box(0, 1, 0, 6, 4, 1, "#d77a8c");
    m.box(0, 1, 1, 6, 4, 1, "#f0a3b3");
    for (const [x, y] of [[0, 1], [5, 1], [0, 4], [5, 4]]) m.set(x, y, 1, null);
    m.set(2, 2, 1, "#e48ea0");
    m.set(3, 3, 1, "#e48ea0");
    return { model: m, anchor: { x: 3, y: 3, z: 2 } };
  },

  wortel() {
    const m = new VoxelModel();
    basket(m);
    for (const [x, y, h] of [[2, 2, 2], [3, 3, 2], [3, 2, 1], [2, 3, 1]]) {
      for (let k = 0; k < h; k++) m.set(x, y, 2 + k, C.orange);
      m.set(x, y, 2 + h, C.leaf);
      if (h === 2) m.set(x, y, 5, C.leafLight);
    }
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  timun() {
    const m = new VoxelModel();
    basket(m);
    m.box(2, 2, 2, 2, 2, 1, (x, y) => ((x + y) % 2 ? C.leafDark : "#4f9c4f"));
    m.box(1, 3, 3, 4, 1, 1, (x) => (x % 2 ? "#3c7d3f" : "#78b866"));
    m.box(2, 1, 3, 1, 3, 1, (_x, y) => (y % 2 ? "#78b866" : "#3c7d3f"));
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  pakis() {
    const m = new VoxelModel();
    m.box(1, 1, 0, 4, 4, 3, (_x, _y, z) => (z === 2 ? C.terracottaDark : C.terracotta));
    m.box(2, 2, 2, 2, 2, 1, C.soil);
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const lift = [1, 2, 2, 1, 0];
    dirs.forEach(([dx, dy], i) => {
      for (let t = 1; t <= 4; t++) {
        const x = Math.round(2.5 + dx * t * 0.85);
        const y = Math.round(2.5 + dy * t * 0.85);
        m.set(x, y, 3 + lift[t] + (i % 2), (t + i) % 2 ? C.leaf : C.leafDark);
      }
    });
    m.box(2, 2, 3, 2, 2, 3, (x, y, z) => ((x + y + z) % 2 ? C.leaf : C.leafLight));
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  "lampu-tidur"() {
    const m = new VoxelModel();
    m.box(0, 1, 0, 5, 4, 4, C.woodMid);
    m.box(1, 4, 1, 3, 1, 2, "#c08a5a");
    m.set(2, 5, 2, C.yellow);
    m.box(0, 1, 3, 5, 4, 1, C.wood);
    m.set(2, 2, 4, "#c4a484");
    m.box(2, 2, 5, 1, 1, 2, "#e8dcc8");
    m.box(1, 1, 7, 3, 3, 2, (_x, _y, z) => (z === 7 ? "#f2b45c" : "#f8cf7c"));
    m.set(2, 2, 9, "#f8cf7c");
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 }, glow: { x: 2.5, y: 2.5, z: 7, r: 26, color: "#ffc070" } };
  },

  monstera() {
    const m = new VoxelModel();
    m.box(1, 1, 0, 4, 4, 4, (_x, _y, z) => (z === 1 ? "#c9b8a0" : "#ece6da"));
    m.box(2, 2, 3, 2, 2, 1, C.soil);
    m.box(2, 2, 4, 1, 1, 4, "#4f8a4a");
    m.box(3, 3, 4, 1, 1, 6, "#4f8a4a");
    m.box(3, 2, 4, 1, 1, 3, "#4f8a4a");
    const leaf = (cx: number, cy: number, z: number, rx: number, ry: number, seed: number) => {
      disc(m, cx, cy, z, rx, ry, (x, y) => (hash2(x, y, seed) < 0.22 ? "#2f7a42" : hash2(x, y, seed + 1) < 0.5 ? "#3f9a52" : "#4fad60"));
    };
    leaf(1, 1.5, 9, 1.6, 1.3, 1);
    leaf(4.2, 1, 11, 1.5, 1.6, 2);
    leaf(1.5, 4.2, 8, 1.6, 1.3, 3);
    leaf(4.3, 4.2, 10, 1.4, 1.5, 4);
    leaf(2.6, 2.6, 12, 1.4, 1.4, 5);
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  terarium() {
    const m = new VoxelModel();
    for (const [x, y] of [[0, 1], [5, 1], [0, 3], [5, 3]]) m.box(x, y, 0, 1, 1, 2, C.woodDark);
    m.box(0, 1, 2, 6, 3, 1, C.woodMid);
    m.box(0, 1, 3, 6, 3, 6, (x, y, z) => {
      if (x === 0 || x === 5 || z === 8) return "#6b5a4a";
      if (z >= 7) return "#d5f1f6";
      // Lorong semut di pasir.
      const tunnel = (z === 4 && x >= 1 && x <= 3) || (x === 3 && z >= 4 && z <= 6) || (z === 6 && x >= 2 && x <= 4);
      if (tunnel) return hash2(x, z, y) < 0.3 ? "#2a1d1a" : "#8a6a3a";
      return (x + z) % 3 === 0 ? "#cfae6e" : "#dcc084";
    });
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  "mesin-kopi"() {
    const m = new VoxelModel();
    m.box(0, 1, 0, 6, 4, 5, C.woodDark);
    m.box(1, 4, 1, 2, 1, 3, C.woodMid);
    m.box(3, 4, 1, 2, 1, 3, C.woodMid);
    m.set(2, 5, 2, C.gold);
    m.set(3, 5, 2, C.gold);
    m.box(0, 1, 5, 6, 4, 1, "#e8dcc8");
    m.box(1, 1, 6, 3, 3, 4, C.black);
    m.box(1, 3, 7, 3, 1, 2, "#5c5a66");
    m.carve(2, 3, 7, 1, 1, 1);
    m.set(2, 3, 6, "#6b4430|#f4efe6");
    m.set(1, 3, 9, "#ff6b5a");
    m.set(4, 3, 6, "#6b4430|#f4efe6");
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  radio() {
    const m = new VoxelModel();
    for (const [x, y] of [[0, 1], [5, 1], [0, 4], [5, 4]]) m.box(x, y, 0, 1, 1, 3, C.woodDeep);
    m.box(0, 1, 3, 6, 4, 1, C.woodDark);
    m.box(1, 1, 4, 4, 3, 4, (x, y, z) => {
      if (y === 3 && x <= 2 && z >= 5 && z <= 6) return (x + z) % 2 ? "#e8d2a0" : "#c9b080";
      if (y === 3 && x >= 3 && z === 6) return C.yellow;
      if (y === 3 && x >= 3 && z === 5) return C.black;
      return z === 7 ? "#b98458" : C.woodMid;
    });
    m.box(4, 2, 8, 1, 1, 3, C.gray);
    return { model: m, anchor: { x: 2.5, y: 2.5, z: 8 } };
  },

  sofa() {
    const m = new VoxelModel();
    for (const [x, y] of [[0, 1], [5, 1], [0, 4], [5, 4]]) m.set(x, y, 0, C.woodDeep);
    m.box(0, 1, 1, 6, 4, 2, "#3f8f86");
    m.box(1, 2, 3, 4, 3, 1, (x) => (x === 3 ? "#56aa9f" : "#5fb6aa"));
    m.box(0, 1, 3, 6, 1, 4, "#4a9d93");
    m.box(0, 2, 3, 1, 3, 2, "#4a9d93");
    m.box(5, 2, 3, 1, 3, 2, "#4a9d93");
    m.set(4, 2, 4, "#f0c24e");
    return { model: m, anchor: { x: 2.5, y: 3, z: 4 } };
  },

  ayunan() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 6, 6, 1, (x, y) => ((x + y) % 2 ? C.woodDark : "#6e4a30"));
    m.box(0, 0, 1, 1, 1, 12, C.woodDark);
    m.box(0, 0, 12, 4, 1, 1, C.woodDark);
    m.box(3, 1, 12, 1, 2, 1, C.woodDark);
    m.box(3, 2, 10, 1, 1, 2, C.gray);
    const radius = [1.4, 2.2, 2.6, 2.7, 2.6, 2.3, 1.6, 0.9];
    radius.forEach((r, i) => {
      const z = 2 + i;
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          const d = Math.hypot(x - 3, y - 3);
          if (d > r) continue;
          const shell = d > r - 1.1 || i === 0;
          const open = y >= 3 && i >= 2 && i <= 6 && Math.abs(x - 3) <= 1.5;
          if (shell && !open) m.set(x, y, z, (x + y + z) % 2 ? "#e0b47a" : "#c99a60");
        }
      }
    });
    m.box(2, 2, 3, 3, 3, 1, "#f08f8f");
    m.set(3, 2, 4, "#f6b0a8");
    return { model: m, anchor: { x: 3, y: 3.2, z: 4 } };
  },

  "rak-buku"() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 6, 2, 13, C.woodMid);
    const colors = [C.red, C.blue, "#6fae6a", C.yellow, "#9b7bd0", C.cream, C.orange, "#4fa39a"];
    const rows = [1, 5, 9];
    rows.forEach((z0, r) => {
      m.carve(1, 1, z0, 4, 1, 3);
      for (let x = 1; x <= 4; x++) {
        const h = 2 + Math.floor(hash2(x, r, 9) * 2);
        if (hash2(x, r, 4) < 0.18) continue;
        const color = colors[Math.floor(hash2(x, r, 2) * colors.length)];
        m.box(x, 1, z0, 1, 1, h, color);
      }
    });
    m.box(0, 0, 12, 6, 2, 1, C.woodDark);
    m.set(4, 0, 12, C.leaf);
    m.set(5, 1, 12, C.leafDark);
    return { model: m, anchor: { x: 3, y: 4, z: 0 } };
  },

  akuarium() {
    const m = new VoxelModel();
    m.box(0, 1, 0, 6, 3, 4, C.woodDeep);
    m.box(1, 3, 1, 4, 1, 2, "#7a5236");
    m.box(0, 1, 4, 6, 3, 6, (x, y, z) => {
      const edge = (x === 0 || x === 5) && (y === 1 || y === 3);
      if (z === 9) return x === 0 || x === 5 || y === 1 ? "#8794a3" : "#a9b6c4";
      if (z === 4 || edge) return "#8794a3";
      if (z === 5) return hash2(x, y, 3) < 0.5 ? "#e8d2a0" : "#c9b38c";
      if (y === 3 && x === 1 && z <= 7) return C.leaf;
      if (y === 3 && x === 3 && z === 7) return C.orange;
      if (y === 3 && x === 4 && z === 6) return C.yellow;
      if (x === 5 && y === 2 && z === 6) return C.orange;
      if (y === 3 && x === 2 && z === 8) return "#e6f7fb";
      return z >= 8 ? "#9fdcea" : "#7accdf";
    });
    return { model: m, anchor: { x: 3, y: 5.5, z: 0 } };
  },

  "lampu-hangat"() {
    const m = new VoxelModel();
    m.box(0, 2, 0, 6, 4, 1, (x, y) => (hash2(x, y, 6) < 0.5 ? "#a39c90" : "#948d82"));
    m.box(1, 2, 1, 4, 3, 1, (x, y) => (hash2(x, y, 8) < 0.5 ? "#b8b1a4" : "#aaa396"));
    m.box(0, 0, 0, 2, 2, 1, C.grayDark);
    m.box(0, 0, 1, 1, 1, 7, C.gray);
    m.box(1, 0, 7, 2, 1, 1, C.gray);
    m.box(2, 0, 5, 2, 3, 2, (_x, _y, z) => (z === 6 ? "#e2683f" : "#c4502e"));
    m.set(2, 2, 4, "#ffe08a");
    m.set(3, 2, 4, "#ffd06a");
    return { model: m, anchor: { x: 3, y: 4, z: 2 }, glow: { x: 3, y: 2.5, z: 4, r: 26, color: "#ff9a50" } };
  },
};

// ---------------------------------------------------------------------------
// Barang meja (jejak 3×3, permukaan meja di z = 0)

const DESK_MODELS: Record<string, () => ItemModel> = {
  mug() {
    const m = new VoxelModel();
    m.box(0, 1, 0, 1, 1, 2, (_x, _y, z) => (z === 1 ? "#a8754a|#f4efe6" : C.white));
    m.set(1, 1, 1, C.white);
    return { model: m };
  },
  kaktus() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 2, 2, 1, C.terracotta);
    m.box(0, 0, 1, 2, 2, 1, `${C.soil}|${C.terracotta}`);
    m.box(1, 1, 2, 1, 1, 3, C.leafDark);
    m.set(0, 1, 3, C.leaf);
    m.set(1, 1, 5, "#f29ab2");
    return { model: m };
  },
  "buku-meja"() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 2, 2, 1, C.red);
    m.box(0, 0, 1, 2, 2, 1, C.blue);
    m.box(0, 1, 2, 2, 1, 1, C.yellow);
    return { model: m };
  },
  "lampu-meja"() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 2, 2, 1, C.grayDark);
    m.box(0, 0, 1, 1, 1, 3, C.gray);
    m.box(0, 0, 4, 2, 2, 2, (_x, _y, z) => (z === 5 ? "#3f8a7a" : "#56a896"));
    return { model: m, glow: { x: 1, y: 1.5, z: 3, r: 18, color: "#ffd890" } };
  },
};

// ---------------------------------------------------------------------------
// Barang dinding (u sepanjang dinding, v keluar dinding, z ke atas)

export interface Sky {
  top: string;
  bottom: string;
  cloud: string | null;
  stars: boolean;
}

export function skyAt(hour: number): Sky {
  if (hour >= 20 || hour < 5) return { top: "#1d2850", bottom: "#33417a", cloud: null, stars: true };
  if (hour < 7) return { top: "#f3a99a", bottom: "#ffdca6", cloud: "#fff1e0", stars: false };
  if (hour < 16) return { top: "#86c9ef", bottom: "#c6ecfb", cloud: "#ffffff", stars: false };
  if (hour < 18.5) return { top: "#ef9566", bottom: "#ffd28a", cloud: "#ffe9d2", stars: false };
  return { top: "#594d8f", bottom: "#c27a8c", cloud: null, stars: true };
}

function windowModel(sky: Sky): ItemModel {
  const m = new VoxelModel();
  m.box(0, 0, 0, 7, 1, 9, (u, _v, z) => {
    if (u === 0 || u === 6 || z === 0 || z === 8) return C.white;
    if (u === 3 || z === 4) return "#e6ddd0";
    if (sky.stars && hash2(u, z, 21) < 0.16) return "#fff3b0";
    if (sky.cloud && ((z === 6 && u >= 1 && u <= 2) || (z === 2 && u >= 4 && u <= 5) || (z === 7 && u === 1))) return sky.cloud;
    return z >= 5 ? sky.top : sky.bottom;
  });
  m.box(-1, 0, -1, 9, 2, 1, C.white);
  return { model: m };
}

function clockModel(hour: number, minute: number): ItemModel {
  const m = new VoxelModel();
  const cx = 3;
  const cz = 3;
  for (let z = 0; z < 7; z++) {
    for (let u = 0; u < 7; u++) {
      const d = Math.hypot(u - cx, z - cz);
      if (d > 3.45) continue;
      m.set(u, 0, z, d > 2.6 ? C.woodDark : "#f8f2e4");
    }
  }
  for (const [u, z] of [[3, 5], [5, 3], [3, 1], [1, 3]]) m.set(u, 0, z, "#b9a98f");
  const hand = (angle: number, length: number, color: string) => {
    for (let t = 0.5; t <= length; t += 0.5) {
      const u = Math.round(cx + Math.sin(angle) * t);
      const z = Math.round(cz + Math.cos(angle) * t);
      m.set(u, 1, z, color);
    }
  };
  hand(((hour % 12) + minute / 60) * (Math.PI / 6), 1.5, C.red);
  hand(minute * (Math.PI / 30), 2.4, C.black);
  m.set(cx, 1, cz, C.black);
  return { model: m };
}

const WALL_MODELS: Record<string, () => ItemModel> = {
  poster() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 5, 1, 7, (u, _v, z) => {
      if (u === 0 || u === 4 || z === 0 || z === 6) return C.white;
      if (z === 5 && u === 3) return C.yellow;
      const peak = 4 - Math.abs(u - 2);
      if (z <= peak - 1) return z === peak - 1 && u === 2 ? C.white : u % 2 ? "#5f9e60" : "#6aa86a";
      return "#9fd0ea";
    });
    return { model: m };
  },
  "rak-dinding"() {
    const m = new VoxelModel();
    m.box(0, 0, 0, 6, 2, 1, C.woodMid);
    m.set(1, 0, -1, C.woodDark);
    m.set(4, 0, -1, C.woodDark);
    m.box(1, 0, 1, 2, 2, 2, (_u, _v, z) => (z === 2 ? `${C.soil}|${C.terracotta}` : C.terracotta));
    m.set(1, 1, 3, C.leaf);
    m.set(2, 0, 3, C.leafLight);
    m.box(2, 2, -3, 1, 1, 3, (_u, _v, z) => (z % 2 ? C.leaf : C.leafDark));
    m.set(3, 2, -1, C.leaf);
    m.box(4, 0, 1, 1, 2, 2, C.red);
    m.box(5, 0, 1, 1, 2, 3, C.blue);
    return { model: m };
  },
  "lampu-hias"() {
    const m = new VoxelModel();
    const bulbs = ["#ffd36b", "#ff8a7a", "#8fd0ff", "#b5f58a"];
    for (let u = 0; u < 8; u++) {
      const z = 4 - Math.round(Math.sin((Math.PI * u) / 7) * 2.2);
      m.set(u, 0, z, "#6b4a3a");
      if (u % 2 === 1) m.set(u, 0, z - 1, bulbs[(u >> 1) % bulbs.length]);
    }
    return { model: m, glow: { x: 3.5, y: 1, z: 2, r: 30, color: "#ffd890" } };
  },
  wayang() {
    const m = new VoxelModel();
    // Gunungan: bentuk daun runcing berwarna emas dengan pohon hayat di tengah.
    const widths = [7, 7, 7, 7, 6, 5, 4, 3, 1];
    widths.forEach((w, z) => {
      const start = Math.round((7 - w) / 2);
      for (let u = start; u < start + w; u++) {
        const edge = u === start || u === start + w - 1 || z === 0 || z === widths.length - 1;
        let color = edge ? C.goldDark : C.gold;
        if (!edge && u === 3 && z >= 1 && z <= 6) color = C.red;
        if (!edge && (u === 2 || u === 4) && z >= 3 && z <= 5) color = "#4f8a4a";
        if (!edge && z === 1 && u >= 2 && u <= 4) color = "#3a5a8a";
        m.set(u, 0, z, color);
      }
    });
    return { model: m };
  },
};

// ---------------------------------------------------------------------------
// Meja kerja, laptop, dan kursi (koordinat dunia)

export function deskModel(): VoxelModel {
  const m = new VoxelModel();
  for (const [x, y] of [[6, 7], [6, 10]]) m.box(x, y, 0, 1, 1, 6, C.woodMid);
  m.box(15, 7, 0, 4, 4, 6, C.woodMid);
  m.box(16, 10, 1, 2, 1, 1, "#c08a5a");
  m.box(16, 10, 3, 2, 1, 1, "#c08a5a");
  m.box(16, 11, 1, 1, 1, 1, C.gold);
  m.box(16, 11, 3, 1, 1, 1, C.gold);
  m.box(6, 7, 6, 13, 4, 1, C.wood);
  return m;
}

export function laptopBaseModel(): VoxelModel {
  return new VoxelModel().box(10, 7, 7, 4, 2, 1, "#9ba3ad|#c9ced6");
}

export function laptopLidModel(): VoxelModel {
  const m = new VoxelModel();
  m.box(10, 9, 7, 4, 1, 4, (x, _y, z) => (z === 7 ? "#c9ced6" : x === 11 && z === 9 ? C.orange : "#b8bec8"));
  return m;
}

export function chairModel(): VoxelModel {
  const m = new VoxelModel();
  m.box(12, 3, 0, 4, 1, 1, C.black);
  m.box(13, 2, 0, 2, 3, 1, C.black);
  m.box(13, 3, 1, 1, 1, 2, C.grayDark);
  m.box(12, 2, 3, 4, 4, 1, C.blue);
  m.box(12, 1, 4, 4, 1, 7, (_x, _y, z) => (z === 10 ? "#7aa7e6" : C.blue));
  return m;
}

// ---------------------------------------------------------------------------

export function floorItemModel(id: string): ItemModel | null {
  return FLOOR_MODELS[id]?.() ?? null;
}

export function deskItemModel(id: string): ItemModel | null {
  return DESK_MODELS[id]?.() ?? null;
}

/** Model barang dinding. Jam dan jendela bergantung pada waktu. */
export function wallItemModel(id: string, hour: number, minute: number): ItemModel | null {
  if (id === "jendela") return windowModel(skyAt(hour + minute / 60));
  if (id === "jam") return clockModel(hour, minute);
  return WALL_MODELS[id]?.() ?? null;
}

export const FLOOR_MODEL_IDS = Object.keys(FLOOR_MODELS);
export const DESK_MODEL_IDS = Object.keys(DESK_MODELS);
export const WALL_MODEL_IDS = [...Object.keys(WALL_MODELS), "jendela", "jam"];
