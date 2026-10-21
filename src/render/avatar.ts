// Avatar pemain: duduk menghadap kiri bawah (ke laptop), dilihat tiga perempat.
// Disusun dari bagian (rambut belakang, badan, kepala, wajah, rambut depan,
// aksesori, lengan) yang diwarnai sesuai pilihan pemain. Lengan dipisah karena
// berada di atas papan ketik (lebih dekat ke penonton daripada badan).

import { COSMETIC_BY_ID, HAIR_COLORS, SKINS, TOP_COLORS } from "../core/data";
import type { AvatarState, ColorDef } from "../core/types";
import { createImage, outline, setPixel, shade, type Grid, type PixelImage } from "./pixel";

export const AVATAR_W = 26;
export const AVATAR_H = 30;
/** Titik pinggul (tempat duduk) di dalam gambar. */
export const AVATAR_ANCHOR = { x: 15, y: 24 };

export type AvatarPose = "ketik-a" | "ketik-b" | "diam" | "minum" | "regang" | "lambai" | "tidur";
export type AvatarFace = "biasa" | "kedip" | "senang" | "tidur" | "kaget";

const OUTLINE = "#3a2a2a";

interface Part {
  grid: Grid;
  x: number;
  y: number;
}

/** Kanvas huruf: setiap bagian menimpa huruf di bawahnya. */
class Canvas {
  readonly cells: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: h }, () => Array<string>(w).fill("."));
  }
  draw(part: Part, map?: (ch: string) => string): void {
    part.grid.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === "." || ch === " ") continue;
        const x = part.x + i;
        const y = part.y + j;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        this.cells[y][x] = map ? map(ch) : ch;
      }
    });
  }
  /** Hapus huruf (misalnya rambut di balik tangan). */
  erase(part: Part): void {
    part.grid.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === "." || row[i] === " ") continue;
        const x = part.x + i;
        const y = part.y + j;
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ".";
      }
    });
  }
  toImage(palette: Record<string, string>): PixelImage {
    const img = createImage(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = palette[this.cells[y][x]];
        if (c) setPixel(img, x, y, c);
      }
    }
    return img;
  }
}

// ---------------------------------------------------------------------------
// Kepala dan wajah. Kepala 12×11 di (8, 2).

const HX = 8;
const HY = 2;

const HEAD: Grid = [
  "...SSSSSS...",
  ".SSSSSSSSSS.",
  "SSSSSSSSSSSS",
  "SSSSSSSSSSSS",
  "SSSSSSSSSSSS",
  "SSSSSSSSSSSs",
  "SSSSSSSSSSSs",
  "SSSSSSSSSSss",
  ".SSSSSSSSss.",
  "..SSSSSsss..",
  "....ssss....",
];

/** Wajah: mata di baris 6-7, pipi di baris 8, mulut di baris 8. Koordinat relatif kepala. */
const FACES: Record<AvatarFace, Grid> = {
  biasa: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "..E...E.....",
    "..E...E..nn.",
    ".B..M...Bn..",
  ],
  kedip: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".EE..EE..nn.",
    ".B..M...Bn..",
  ],
  senang: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "..E...E.....",
    ".E.E.E.E.nn.",
    ".B..MM..Bn..",
  ],
  tidur: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".EE..EE..nn.",
    "....M....n..",
  ],
  kaget: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "..E...E.....",
    "..E...E.....",
    "..E...E..nn.",
    ".B..M...Bn..",
    "....M.......",
  ],
};

// ---------------------------------------------------------------------------
// Rambut: depan (di atas kepala) dan belakang (di balik badan). Relatif kepala,
// boleh negatif (rambut lebih besar dari kepala).

interface HairStyle {
  front: Part;
  back?: Part;
}

const HAIR: Record<string, HairStyle> = {
  pendek: {
    front: {
      x: -1,
      y: -1,
      grid: [
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHH.",
        ".HHHHHHHHHHHHH",
        ".HHHlHHHHHHHHH",
        ".HHhHHHhHHHHHH",
        ".Hh.H.hHHHHHHH",
        ".h......hHHHHH",
        ".........HHHH.",
        "..........HH..",
      ],
    },
  },
  poni: {
    front: {
      x: -1,
      y: -1,
      grid: [
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHH.",
        ".HHHlHHHHHHHHH",
        ".HHHHHHHHHHHHH",
        ".HHHHHHHHHHHHH",
        ".HhHhHhHhHHHHH",
        ".H.........HHH",
        ".H.........HHH",
        "..........HHH.",
      ],
    },
  },
  bob: {
    front: {
      x: -1,
      y: -1,
      grid: [
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHH.",
        "HHHHlHHHHHHHHH",
        "HHHHHHHHHHHHHH",
        "HHHhHHHhHHHHHH",
        "HHh.H.hHHHHHHH",
        "HH.......HHHHH",
        "HH.......HHHHH",
        "HH........HHHH",
        "Hh........hHHh",
        "h..........hh.",
      ],
    },
  },
  panjang: {
    front: {
      x: -1,
      y: -1,
      grid: [
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHH.",
        "HHHHlHHHHHHHHH",
        "HHHHHHHHHHHHHH",
        "HHHhHHHhHHHHHH",
        "HHh.H.hHHHHHHH",
        "HH.......HHHHH",
        "HH.......HHHHH",
        "HH........HHHH",
        "HH.........HHH",
        "HH.........HHH",
      ],
    },
    back: {
      x: 0,
      y: 9,
      grid: [
        "HH.........HHH",
        "HHH........HHH",
        "HHH........HHH",
        "HHh.......hHHH",
        "Hh.........hHh",
        "h...........h.",
      ],
    },
  },
  kuncir: {
    front: {
      x: -1,
      y: -1,
      grid: [
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHHH",
        ".HHHlHHHHHHHHHH",
        ".HHHHHHHHHHHHHn",
        ".HHhHHHhHHHHHH.",
        ".Hh.H.hHHHHHHH.",
        ".h......hHHHHH.",
        ".........HHHH..",
        "..........HH...",
      ],
    },
    back: {
      x: 12,
      y: 3,
      grid: ["HH..", "HHH.", "HHHH", ".HHH", ".hHH", "..hH", "...h"],
    },
  },
  keriting: {
    front: {
      x: -2,
      y: -2,
      grid: [
        "....HH.HH.HH....",
        "...HHHHHHHHHHH..",
        "..HHHHlHHHHHHHH.",
        ".HHHHHHHHHHHHHHH",
        ".HHlHHHHHHHlHHHH",
        "HHHHHHHHHHHHHHHH",
        "HHHhHhHhHHHHHHHH",
        "HHh.h.h.hHHHHHHH",
        "HH.......hHHHHHH",
        "HH........HHHHHh",
        ".H........HHHHH.",
        "..........hHHH..",
      ],
    },
  },
  sanggul: {
    front: {
      x: -1,
      y: -4,
      grid: [
        "......HHHH....",
        ".....HHlHHH...",
        "......HHHH....",
        "....HHHHHH....",
        "..HHHHHHHHHH..",
        ".HHHHHHHHHHHH.",
        ".HHHlHHHHHHHHH",
        ".HHHHHHHHHHHHH",
        ".HHH....HHHHHH",
        ".Hh......HHHHH",
        "..........HHHH",
        "...........HH.",
      ],
    },
  },
  cepak: {
    front: {
      x: 0,
      y: -1,
      grid: [
        "...HHHHHH...",
        ".HHHHHHHHHH.",
        "HHHHHHHHHHHH",
        "HHHlHHHHHHHH",
        "HHHHHHHHHHHH",
        "h.......HHHH",
        "..........HH",
      ],
    },
  },
  hijab: {
    front: {
      x: -2,
      y: -2,
      grid: [
        ".....HHHHHH.....",
        "...HHHHHHHHHH...",
        "..HHHHlHHHHHHH..",
        ".HHHHHHHHHHHHHH.",
        ".HHlHHHHHHHHHHHH",
        ".HHHHHHHHHHHHHHH",
        "HHHhhhhhhhhHHHHH",
        "HHh.......hHHHHH",
        "HH.........HHHHH",
        "HH.........HHHHH",
        "HH.........HHHHH",
        "HHh.......hHHHHH",
        "HHHh.....hHHHHHH",
        ".HHHHhhhhHHHHHHH",
        "..HHHHHHHHHHHHH.",
      ],
    },
    back: {
      x: -1,
      y: 11,
      grid: [
        "HHHHHHHHHHHHHH",
        "HHHHHHHHHHHHHH",
        ".HHHHHHHHHHHHh",
        "..hHHHHHHHHHh.",
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Badan (atasan) dan kaki, koordinat kanvas.

const TORSO: Part = {
  x: 10,
  y: 15,
  grid: [
    "...TTTTT...",
    ".TTTTTTTTT.",
    "TTTTTTTTTTT",
    "TTTTTTTTTTt",
    "TTTTTTTTTTt",
    "TTTTTTTTTtt",
    ".TTTTTTTTt.",
    ".TTTTTTTTt.",
    "..TTTTTTt..",
  ],
};

const NECK: Part = { x: 13, y: 13, grid: ["sss", ".s."] };

/** Detail atasan, ditimpa di atas TORSO. */
const TOP_DETAIL: Record<string, Part | null> = {
  kaos: { x: 10, y: 15, grid: ["...tSSSt..."] },
  kemeja: {
    x: 10,
    y: 15,
    grid: ["..WWtSStWW.", "....WtW....", ".....P.....", ".....W.....", ".....P.....", ".....W....."],
  },
  hoodie: {
    x: 9,
    y: 14,
    grid: ["..ttttttttt..", "..t.......t..", ".......w.w...", ".......w.w...", "", "", "....tttttt..", "....tTTTTt.."],
  },
  sweter: { x: 10, y: 15, grid: ["...tttt....", "", "", "", "", "", "", "", "ttttttttt.."] },
  jaket: {
    x: 10,
    y: 15,
    grid: ["..tPPPPPt..", "...tPPPt...", "....PPP....", "....tPt....", "....tPt....", "....tPt....", "....tPt....", "....tPt...."],
  },
  batik: {
    x: 10,
    y: 15,
    grid: ["...tSSSt...", ".P.P.P.P.P.", "PtP.PtP.PtP", ".P.P.P.P.P.", "PtP.PtP.PtP", ".P.P.P.P.P.", "PtP.PtP.PtP", ".P.P.P.P.P."],
  },
};

const LEGS: Part = {
  x: 4,
  y: 23,
  grid: ["......KKKKKKKKK..", "KKKKKKKKKKKKKKK..", "KKKKKKKKKKKKKk...", "kk..............."],
};

// ---------------------------------------------------------------------------
// Lengan per pose (koordinat kanvas). A = lengan baju, S = kulit tangan.

interface ArmSet {
  /** Lengan di depan badan (digambar sebagai lapisan lengan). */
  front: Part;
  /** Lengan di belakang/samping badan (digambar bersama badan). */
  back?: Part;
}

const ARMS: Record<AvatarPose, ArmSet> = {
  "ketik-a": {
    back: { x: 8, y: 16, grid: ["AAA", "SS."] },
    front: { x: 8, y: 17, grid: ["..........AA", "........AAAA", "SSAAAAAAAA..", "SS.........."] },
  },
  "ketik-b": {
    back: { x: 7, y: 17, grid: ["AAAA", "SS.."] },
    front: { x: 8, y: 17, grid: ["..........AA", "SS......AAAA", "SSAAAAAAAA.."] },
  },
  diam: {
    back: { x: 8, y: 17, grid: ["AAA", "SS."] },
    front: { x: 8, y: 17, grid: ["..........AA", "..........AA", "..SSAAAAAAA.", "..SS........"] },
  },
  minum: {
    back: { x: 8, y: 17, grid: ["AAA", "SS."] },
    front: { x: 10, y: 11, grid: ["WWW......", "WWWW.....", "WWW......", "SSA......", ".SAA...AA", "..AAA..AA", "...AAAAA."] },
  },
  regang: {
    back: { x: 8, y: 6, grid: ["SS", "AA", "AA", "AA", "AA", "AA", "AA", "AA", "AA", ".AA"] },
    front: { x: 20, y: 5, grid: [".SS", ".AA", ".AA", ".AA", "AA.", "AA.", "AA.", "AA.", "AA.", "AA.", "AA."] },
  },
  lambai: {
    back: { x: 8, y: 17, grid: ["AAA", "SS."] },
    front: { x: 20, y: 9, grid: ["SS.", "SS.", "AA.", "AA.", "AA.", "AA.", "AA."] },
  },
  tidur: {
    back: { x: 6, y: 18, grid: ["AAAAA", "SS..."] },
    front: { x: 6, y: 18, grid: ["......AAAAAA", "SSAAAAAAAA.."] },
  },
};

// ---------------------------------------------------------------------------
// Aksesori, relatif kepala.

const ACCESSORIES: Record<string, Part | null> = {
  tanpa: null,
  kacamata: { x: 0, y: 5, grid: ["GGGGGGGGG", ".G.GG.G..", "..G...G.."] },
  bando: { x: -1, y: -1, grid: ["...........", "...........", "...........", "...........", "...rrrr....", "..rFrr....", "...r.."] },
  peci: { x: -1, y: -3, grid: ["....PPPPPP....", "...PPPPPPPP...", "..PPPPPPPPPP..", "..pppppppppp.."] },
  topi: { x: -3, y: -2, grid: ["......CCCCCC....", "....CCCCCCCCC...", "....CCCCCCCCCC..", "ccccCCCCCCCCCC..", "cccccccccccccc.."] },
  headphone: { x: 7, y: 0, grid: ["....PP", ".....P", "......P", "......P", "......P", "....pPP", "....PPP", "....PPP", "....pP."] },
};

const ACCESSORY_COLORS: Record<string, Record<string, string>> = {
  kacamata: { G: "#3a3540" },
  bando: { r: "#e25d6c", F: "#ffd36b" },
  peci: { P: "#2b2a33", p: "#45434f" },
  topi: { C: "#d4574a", c: "#a63d33" },
  headphone: { P: "#4f74c9", p: "#f0c24e" },
};

// ---------------------------------------------------------------------------

function colorOf(list: ColorDef[], id: string): ColorDef {
  return list.find((c) => c.id === id) ?? list[0];
}

export interface AvatarFrame {
  /** Badan, kepala, rambut (kedalaman dari pinggul). */
  body: PixelImage;
  /** Lengan dan tangan di atas papan ketik (kedalaman dari tangan). */
  arms: PixelImage;
}

/** Bayangan geser: kepala sedikit turun saat tidur. */
function headShift(pose: AvatarPose): number {
  return pose === "tidur" ? 3 : 0;
}

export function renderAvatar(avatar: AvatarState, pose: AvatarPose, face: AvatarFace, bob = 0): AvatarFrame {
  const skin = colorOf(SKINS, avatar.skin);
  const hairColor = colorOf(HAIR_COLORS, avatar.hairColor);
  const top = colorOf(TOP_COLORS, avatar.topColor);
  const hairStyle = HAIR[avatar.hair] ?? HAIR.pendek;
  const topStyle = COSMETIC_BY_ID[avatar.top]?.slot === "atasan" ? avatar.top : "kaos";
  const accessory = ACCESSORIES[avatar.accessory] ?? null;
  const sleeveless = topStyle === "kaos" || topStyle === "batik";

  const dy = headShift(pose) + bob;
  const head = (p: Part): Part => ({ grid: p.grid, x: HX + p.x, y: HY + p.y + dy });

  const body = new Canvas(AVATAR_W, AVATAR_H);
  if (hairStyle.back) body.draw(head(hairStyle.back));
  body.draw(LEGS);
  const arms = ARMS[pose];
  if (arms.back) body.draw(arms.back, (ch) => (ch === "A" && sleeveless ? "S" : ch));
  body.draw(TORSO);
  const detail = TOP_DETAIL[topStyle];
  if (detail) body.draw(detail);
  body.draw({ ...NECK, y: NECK.y + Math.min(dy, 1) });
  body.draw(head({ grid: HEAD, x: 0, y: 0 }));
  body.draw(head({ grid: FACES[face], x: 0, y: 0 }));
  body.draw(head(hairStyle.front));
  if (accessory) body.draw(head(accessory));

  const lower = topStyle === "kaos" || topStyle === "batik";
  const armCanvas = new Canvas(AVATAR_W, AVATAR_H);
  // Kaos dan batik berlengan pendek: lengan bawah berwarna kulit.
  armCanvas.draw(arms.front, (ch) => (ch === "A" && lower ? "a" : ch));
  if (pose === "regang" || pose === "lambai") {
    // Lengan terangkat menutupi sebagian kepala, jadi digambar bersama badan.
    body.draw(arms.front, (ch) => (ch === "A" && lower ? "a" : ch));
  }

  const palette: Record<string, string> = {
    S: skin.base,
    s: skin.shade,
    H: hairColor.base,
    h: hairColor.shade,
    l: hairColor.light ?? shade(hairColor.base, 1.25),
    E: "#2a1d1a",
    B: "#f19aa0",
    M: "#a24a4a",
    n: skin.shade,
    T: top.base,
    t: top.shade,
    A: top.base,
    a: skin.base,
    W: "#f4efe6",
    w: shade(top.base, 1.3),
    P: topStyle === "jaket" ? shade(top.base, 0.75) : topStyle === "batik" ? "#5a3420" : "#d8cfc0",
    K: "#4a4658",
    k: "#2b2a33",
    ...(ACCESSORY_COLORS[avatar.accessory] ?? {}),
  };
  if (topStyle === "batik") palette.t = shade(top.base, 0.8);

  const bodyImg = outline(body.toImage(palette), OUTLINE);
  const armImg = pose === "regang" || pose === "lambai" ? outline(createImage(AVATAR_W, AVATAR_H), OUTLINE) : outline(armCanvas.toImage(palette), OUTLINE);
  return { body: bodyImg, arms: armImg };
}
