// Sprite hewan tamu, menghadap kiri. Huruf: a warna utama, b bayangan, c terang/perut,
// d gelap/aksen, e mata, w kilau mata, n hidung, x/y/z warna tambahan.
// Kedip: piksel mata atas berubah menjadi warna kulit sehingga mata tampak tertutup.

import type { Grid, PixelImage } from "./pixel";
import { flipX, gridImage, outline } from "./pixel";

interface AnimalArt {
  grid: Grid;
  palette: Record<string, string>;
  /** Huruf kulit di sekitar mata (untuk kedip). */
  lid?: string;
}

const EYE = "#2a1d1a";

export const ANIMALS: Record<string, AnimalArt> = {
  oyen: {
    grid: [
      ".d.....d......",
      "dnd...dnd.....",
      "aaaaaaaaa.....",
      "aaaaaaaaaa....",
      "aeaaaaeaaa....",
      "aeaaaaeaaa....",
      "ccanncaaa.....",
      ".cccccaab.....",
      "..aabaabaa..ab",
      ".caabaabaaa.ab",
      ".ccaaaaaaaaab.",
      ".ccaabaabaab..",
      "..cc.cc.aaa...",
    ],
    palette: { a: "#f0a24e", b: "#c87a2c", c: "#fff1dc", d: "#c87a2c", n: "#f19aa8", e: EYE },
  },
  kelinci: {
    grid: [
      "...ab.ab....",
      "...ab.ab....",
      "...an.an....",
      "...an.an....",
      "...an.ab....",
      "..aaaaaa....",
      ".aaaaaaaa...",
      ".aeaaaaaa...",
      ".aeaaaaaa...",
      "naaaaaaaaa..",
      ".ccaaaaaaaa.",
      "..caaaaaaaac",
      "..caaaaaaacc",
      "..aaaaaaaab.",
      "..cc..ccbb..",
    ],
    palette: { a: "#ece6dd", b: "#c9c0b4", c: "#ffffff", n: "#f19aa8", e: EYE },
  },
  kancil: {
    grid: [
      "..bb............",
      ".bab............",
      "aaaa............",
      "eaaa............",
      "aaaac...........",
      "naacc...........",
      "..accaaaaaaab...",
      "..aaaaaaaaaaab..",
      "...aaaaaaaaaab..",
      "...ccccccccab...",
      "...a.a....a.a...",
      "...a.a....a.a...",
      "...a.a....a.a...",
      "...d.d....d.d...",
    ],
    palette: { a: "#b97c46", b: "#8e5a2e", c: "#f2dfc2", d: "#3a2a2a", n: "#2a1d1a", e: EYE },
  },
  anoa: {
    grid: [
      "xx................",
      ".xxx..............",
      "..xaaa............",
      "aeaaa.............",
      "aaaaaaaaaaaaaaa...",
      "naaaaaaaaaaaaaab..",
      ".caaaaaaaaaaaaabd.",
      "..aaaaaaaaaaaaab.d",
      "..aaaaaaaaaaaab...",
      "..aa.aa....aa.aa..",
      "..aa.aa....aa.aa..",
      "..cc.cc....cc.cc..",
      "..dd.dd....dd.dd..",
    ],
    palette: { a: "#5a4a42", b: "#3d322e", c: "#ece2cf", d: "#2b2224", x: "#cfc3ad", n: "#2a1d1a", e: "#f6efe0" },
  },
  trenggiling: {
    grid: [
      "........bbbbb.......",
      "......bbababab......",
      "....bbabababababb...",
      "..cbabababababababb.",
      ".ccababababababababb",
      "ecccaaaaaaaaaaaaab.b",
      "nccc.cc.......cc..bb",
      ".....dd.......dd....",
    ],
    palette: { a: "#9b7a4f", b: "#6f5534", c: "#e3b99a", d: "#4a3a2a", n: "#2a1d1a", e: EYE },
  },
  luwak: {
    grid: [
      ".d.d................",
      "dadad...............",
      "aaaaa...............",
      "ddeda...............",
      "nddaaaaaaaaaaaaa....",
      ".ccaaaabaaabaaaab...",
      "..aaaaaaaaaaaaaabdad",
      "..aaaaaaaaaaaaab..ad",
      "..dd.dd......dd.dd..",
      "..dd.dd......dd.dd..",
    ],
    palette: { a: "#a99a86", b: "#7c6f60", c: "#e6dccb", d: "#3a3236", n: "#2a1d1a", e: "#f3e7b5" },
  },
  kukang: {
    grid: [
      "...aaaaaa...",
      "..aaacaaaa..",
      ".addacaddaa.",
      "adwedcdweda.",
      "addddcdddda.",
      ".aaacncaaaa.",
      "..aaccccaaab",
      ".aaaaaaaaaab",
      ".caaaaaaaaab",
      ".caaaaaaaaab",
      "..aaaaaaaab.",
      "..cc....bb..",
    ],
    palette: { a: "#c9a27a", b: "#a07c58", c: "#f4e6d0", d: "#6e4a30", n: "#3a2a2a", w: "#ffffff", e: "#2a1d1a" },
    lid: "d",
  },
  tarsius: {
    grid: [
      "b........b",
      "bb......bb",
      ".aaaaaaaa.",
      "awwwaawwwa",
      "aweewaweew",
      "aweewaweew",
      "awwwanwwwa",
      ".aaaaaaaa.",
      "..aaaaaa..",
      "..caaaab..",
      ".aacaaab..",
      ".aa..aa.b.",
      "........b.",
      ".........b",
    ],
    palette: { a: "#a88b6c", b: "#7d6248", c: "#d9c4a6", n: "#3a2a2a", w: "#c98a3a", e: "#2a1d1a" },
    lid: "a",
  },
  bekantan: {
    grid: [
      "...aaaaa......",
      "..aaaaaaa.....",
      ".aeaaeaaa.....",
      ".ccccccaa.....",
      "nnnccccaa.....",
      "nnncccaa......",
      ".nn.aaaaab....",
      "...aaaaaaab...",
      "..xxaaaaaabx..",
      "..xxaaaaaab.x.",
      "...xaaaaaab.x.",
      "...xxxxxxxx.x.",
      "..xx....xx..x.",
      "..cc....cc.xx.",
    ],
    palette: { a: "#c9773f", b: "#9a5428", c: "#f2c9a0", n: "#e8a070", x: "#d6d1c6", e: EYE },
  },
  jalak: {
    grid: [
      "...cc.....",
      "..aaaa....",
      ".aaxexa...",
      "naaxxaa...",
      "..aaaaaa..",
      "..aaaaaab.",
      "...aaaabdd",
      "....aab.dd",
      "....n.n...",
    ],
    palette: { a: "#f6f4ef", b: "#d6d2c8", c: "#ffffff", d: "#2b2a33", x: "#3f76d6", n: "#d9b24a", e: EYE },
    lid: "x",
  },
  katak: {
    grid: [
      ".yy..yy...",
      "yeyaayey..",
      "aaaaaaaa..",
      "adaaaaaaa.",
      ".acccccaab",
      "aacccccaab",
      "aa.aaa.aa.",
      "xx.....xx.",
    ],
    palette: { a: "#5fbf4a", b: "#3f9a35", c: "#f2f6d8", d: "#2f6a2a", x: "#f08a3c", y: "#f06a3c", e: EYE },
    lid: "y",
  },
  celepuk: {
    grid: [
      "a........a",
      "aa......aa",
      "aaaaaaaaaa",
      "aywyaaywya",
      "ayeyaayeya",
      "aaaanaaaaa",
      ".abcbcbca.",
      ".acbcbcba.",
      ".abcbcbca.",
      "..aaaaaa..",
      "...n..n...",
    ],
    palette: { a: "#8a6a4a", b: "#5e4630", c: "#c9a77c", n: "#d9a441", y: "#f2b632", w: "#fff6c8", e: EYE },
    lid: "a",
  },
  orangutan: {
    grid: [
      "...aaaaaa.....",
      "..aaaaaaaa....",
      ".aaccccccaa...",
      ".acececccaa...",
      ".accccccca....",
      ".acnccncca....",
      "..accccca.....",
      "..aaaaaaaab...",
      ".aaaaaaaaaab..",
      "aa.aaaaaaa.ab.",
      "cc.aaaaaaa..b.",
      "...aaaaaaab.cc",
      "..aaa..aaab...",
      "..cc....cc....",
    ],
    palette: { a: "#d0682e", b: "#a24a1e", c: "#e9b48a", n: "#7a4a30", e: EYE },
    lid: "c",
  },
  penyu: {
    grid: [
      ".....bbbbbbb.......",
      "....babxbxbab......",
      "...babxbbbxbab.....",
      "..bxbbbxbxbbbxb....",
      "aaabbbbbbbbbbbbb...",
      "aeaacccccccccccca..",
      "aaa.aa.......aa.aa.",
      "....aa........a....",
    ],
    palette: { a: "#7fae6a", b: "#5e7f45", c: "#e3d7a8", x: "#3f5a30", e: EYE },
  },
  komodo: {
    grid: [
      "..aaaa..............",
      ".aeaaaaaaaaaaaab....",
      "naaaaaxaaaxaaaaabb..",
      "r.aaaaaaaaaaaaaaabbb",
      "...aa.aa.....aa.aa.b",
      "...dd.dd.....dd.dd..",
    ],
    palette: { a: "#8a8a68", b: "#6a6a4e", x: "#d9c45a", d: "#4a4a36", n: "#3a3a2a", r: "#e2574a", e: EYE },
  },
  cendrawasih: {
    grid: [
      "...yy.........",
      "..yyyy........",
      ".yeyyy........",
      "nyggyy........",
      "..ggaaa.......",
      "...aaaaa......",
      "...aaaaab.....",
      "....aaaabyy...",
      "....aaabyyyy..",
      ".....abyyyxyy.",
      "......yyyxyyy.",
      ".....yyxyyyxy.",
      ".....yxyy.yxy.",
      "......yy...y..",
      "......d.......",
      ".......d......",
    ],
    palette: { a: "#7a3a2a", b: "#562818", y: "#f2c43a", x: "#e88a2a", g: "#3aa070", d: "#2b2a33", n: "#9aa3ad", e: EYE },
    lid: "y",
  },
};

const OUTLINE = "#3a2a2a";

export interface AnimalFrames {
  idle: PixelImage;
  blink: PixelImage;
}

const cache = new Map<string, { left: AnimalFrames; right: AnimalFrames }>();

function blinkGrid(art: AnimalArt): Grid {
  const lid = art.lid ?? "a";
  return art.grid.map((row, y) =>
    row
      .split("")
      .map((ch, x) => {
        if (ch === "w") return lid;
        if (ch !== "e") return ch;
        // Mata atas menjadi kelopak; baris terbawah mata tetap gelap sebagai garis.
        // Mata satu piksel ikut tertutup seluruhnya.
        const below = art.grid[y + 1]?.[x] ?? "";
        const above = art.grid[y - 1]?.[x] ?? "";
        if (below === "e") return lid;
        return above === "e" ? "e" : lid;
      })
      .join(""),
  );
}

/** Sprite hewan menghadap kiri (bawaan) atau kanan. */
export function animalFrames(id: string, facing: "kiri" | "kanan" = "kiri"): AnimalFrames {
  let entry = cache.get(id);
  if (!entry) {
    const art = Object.prototype.hasOwnProperty.call(ANIMALS, id) ? ANIMALS[id] : ANIMALS.oyen;
    const left: AnimalFrames = {
      idle: outline(gridImage(art.grid, art.palette), OUTLINE),
      blink: outline(gridImage(blinkGrid(art), art.palette), OUTLINE),
    };
    entry = { left, right: { idle: flipX(left.idle), blink: flipX(left.blink) } };
    cache.set(id, entry);
  }
  return facing === "kiri" ? entry.left : entry.right;
}

/** Siluet untuk buku tamu (tamu yang belum ditemukan). */
export function animalSilhouette(id: string, color = "#8a7f78"): PixelImage {
  const art = Object.prototype.hasOwnProperty.call(ANIMALS, id) ? ANIMALS[id] : ANIMALS.oyen;
  const palette: Record<string, string> = {};
  for (const ch of "abcdewnxyzgr") palette[ch] = color;
  return gridImage(art.grid, palette);
}
