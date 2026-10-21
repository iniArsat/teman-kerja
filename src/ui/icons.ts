// Ikon piksel untuk tombol dan HUD, dibuat dari grid huruf.

import { gridImage, outline, type Grid } from "../render/pixel";
import { toDataUrl } from "./images";

interface IconArt {
  grid: Grid;
  palette: Record<string, string>;
}

const K = "#3a2a2a";

const ICONS = {
  toko: {
    grid: [
      ".rwrwrwrw.",
      "rwrwrwrwrw",
      "rwrwrwrwrw",
      ".bbbbbbbb.",
      ".byybbccb.",
      ".byybbccb.",
      ".byybbbbb.",
      ".byybbbbb.",
    ],
    palette: { r: "#e2574a", w: "#f6efe4", b: "#c8925e", y: "#7a5236", c: "#a8dcef" },
  },
  kamar: {
    grid: [
      "..........",
      ".gg....gg.",
      ".gg....gg.",
      ".gggggggg.",
      "gGGGGGGGGg",
      "gggggggggg",
      ".k......k.",
    ],
    palette: { g: "#4fa39a", G: "#6cc0b5", k: K },
  },
  gaya: {
    grid: [
      ".yy....yy.",
      "yyyy..yyyy",
      "yyyyyyyyyy",
      ".yyyyyyyy.",
      "..yyyyyy..",
      "..yyyyyy..",
      "..yyyyyy..",
      "..YYYYYY..",
    ],
    palette: { y: "#f0c24e", Y: "#c99a2c" },
  },
  buku: {
    grid: [
      "bbbbbbbbb.",
      "bwwwwwwwb.",
      "bwwpwpwwbb",
      "bwwwpwwwbb",
      "bwwpppwwbb",
      "bwwwpwwwbb",
      "bwwwwwwwbb",
      "bbbbbbbbbb",
    ],
    palette: { b: "#5b8fd6", w: "#f6efe4", p: "#a8754a" },
  },
  tugas: {
    grid: [
      ".wwwwwwww.",
      ".wgwkkkkw.",
      ".gwwwwwww.",
      ".wwwwwwww.",
      ".wgwkkkkw.",
      ".gwwwwwww.",
      ".wwwwwwww.",
      ".wwwwwwww.",
    ],
    palette: { w: "#f6efe4", g: "#5d9b47", k: "#9a8f86" },
  },
  memo: {
    grid: [
      "yyyyyyyy..",
      "ykkkkkky..",
      "yyyyyyyy..",
      "ykkkkkyy.p",
      "yyyyyyy.pp",
      "ykkkkyyppy",
      "yyyyyy.py.",
      "yyyyyyyyy.",
    ],
    palette: { y: "#ffe89a", k: "#b9a56a", p: "#e2574a" },
  },
  fokus: {
    grid: [
      "....gg....",
      "..rgggr...",
      ".rrrrrrr..",
      "rrrwrrrrr.",
      "rrwrrrrrr.",
      "rrrrrrrrr.",
      ".rrrrrrr..",
      "..rrrrr...",
    ],
    palette: { r: "#e2574a", g: "#5d9b47", w: "#ffb3a8" },
  },
  musik: {
    grid: [
      "....kkkkk.",
      "....kkkkk.",
      "....k...k.",
      "....k...k.",
      "....k...k.",
      ".kkkk.kkk.",
      "kkkkkkkkk.",
      ".kk...kk..",
    ],
    palette: { k: "#7a5ac0" },
  },
  atur: {
    grid: [
      "...gg.....",
      ".g.gg.g...",
      "..gggg....",
      "ggg..ggg..",
      "ggg..ggg..",
      "..gggg....",
      ".g.gg.g...",
      "...gg.....",
    ],
    palette: { g: "#8a8f96" },
  },
  koin: {
    grid: [".yyyy.", "yyYyyy", "yYyyyy", "yYyyyy", "yyyyyy", ".yyyy."],
    palette: { y: "#f2c43a", Y: "#fff0a8" },
  },
  ketik: {
    grid: ["wwwwwwwwww", "wkwkwkwkww", "wwwwwwwwww", "wkwkwkwkww", "wwkkkkkkww", "wwwwwwwwww"],
    palette: { w: "#f6efe4", k: "#9a8f86" },
  },
  hati: {
    grid: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."],
    palette: { r: "#ef5a6f" },
  },
  hatiKosong: {
    grid: [".rr.rr.", "r..r..r", "r.....r", ".r...r.", "..r.r..", "...r..."],
    palette: { r: "#c9b8ae" },
  },
  tamu: {
    grid: [".a...a.", "aaaaaaa", "aeaaaea", "aaanaaa", ".aaaaa.", "aaaaaaa"],
    palette: { a: "#f0a24e", e: "#2a1d1a", n: "#f19aa8" },
  },
  jam: {
    grid: [".wwww.", "wwkwww", "wwkwww", "wwkkkw", "wwwwww", ".wwww."],
    palette: { w: "#f6efe4", k: "#3a2a2a" },
  },
} satisfies Record<string, IconArt>;

export type IconId = keyof typeof ICONS;

const urls = new Map<string, string>();

export function iconUrl(id: IconId, scale = 3): string {
  const key = `${id}@${scale}`;
  let url = urls.get(key);
  if (!url) {
    const art = ICONS[id] as IconArt;
    url = toDataUrl(outline(gridImage(art.grid, art.palette), K), scale);
    urls.set(key, url);
  }
  return url;
}

export function icon(id: IconId, scale = 3, cls = "icon"): HTMLImageElement {
  const img = document.createElement("img");
  img.src = iconUrl(id, scale);
  img.className = `px ${cls}`;
  img.alt = "";
  img.draggable = false;
  return img;
}
