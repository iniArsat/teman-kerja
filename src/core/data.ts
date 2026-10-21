// Isi permainan: barang, tema kamar, tamu, kosmetik avatar, dan kata penyemangat.

import type { ColorDef, CosmeticDef, GuestDef, ItemDef, Rarity, SlotKind, StationId, ThemeDef } from "./types";

// ---------------------------------------------------------------------------
// Slot kamar. Posisi gambarnya ada di render/layout.ts.

export interface SlotDef {
  id: string;
  kind: SlotKind;
  name: string;
  /** Slot depan: hanya barang pendek agar kamar tetap terlihat. */
  small?: boolean;
}

export const SLOTS: SlotDef[] = [
  { id: "lantai-1", kind: "lantai", name: "Dinding kiri" },
  { id: "lantai-2", kind: "lantai", name: "Kiri depan" },
  { id: "lantai-3", kind: "lantai", name: "Pojok kanan" },
  { id: "lantai-4", kind: "lantai", name: "Kanan depan", small: true },
  { id: "lantai-5", kind: "lantai", name: "Depan", small: true },
  { id: "dinding-1", kind: "dinding", name: "Kiri belakang" },
  { id: "dinding-2", kind: "dinding", name: "Kiri tengah" },
  { id: "dinding-3", kind: "dinding", name: "Kanan belakang" },
  { id: "dinding-4", kind: "dinding", name: "Atas meja" },
  { id: "meja-1", kind: "meja", name: "Meja kiri" },
  { id: "meja-2", kind: "meja", name: "Meja kanan" },
  { id: "karpet", kind: "karpet", name: "Karpet" },
];

/**
 * Peta id → definisi tanpa prototipe, agar id dari simpanan seperti "constructor"
 * atau "__proto__" tidak dianggap ada.
 */
function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  const out = Object.create(null) as Record<string, T>;
  for (const entry of list) out[entry.id] = entry;
  return out;
}

export const SLOT_BY_ID: Record<string, SlotDef> = byId(SLOTS);

/** Barang boleh dipasang di slot ini (jenis cocok, barang tinggi tidak di slot depan). */
export function fits(itemId: string, slotId: string): boolean {
  const item = ITEM_BY_ID[itemId];
  const slot = SLOT_BY_ID[slotId];
  return !!item && !!slot && item.kind === slot.kind && !(slot.small && item.tall);
}

/** Titik lantai kosong tempat tamu duduk bila barang kesukaannya sudah ditempati. */
export const FLOOR_SPOTS = 6;

export const SLOT_KIND_NAME: Record<SlotKind, string> = {
  lantai: "Lantai",
  dinding: "Dinding",
  meja: "Meja",
  karpet: "Karpet",
};

// ---------------------------------------------------------------------------
// Barang

export const ITEMS: ItemDef[] = [
  // Lantai
  { id: "bantal", name: "Bantal Duduk", desc: "Bantal empuk untuk rebahan.", price: 0, kind: "lantai", beauty: 2, starter: true },
  { id: "wortel", name: "Keranjang Wortel", desc: "Wortel segar yang renyah.", price: 120, kind: "lantai", beauty: 2 },
  { id: "timun", name: "Keranjang Timun", desc: "Timun hijau dari kebun tetangga.", price: 150, kind: "lantai", beauty: 2 },
  { id: "pakis", name: "Pakis", desc: "Tanaman lembap yang suka tempat teduh.", price: 380, kind: "lantai", beauty: 5 },
  { id: "lampu-tidur", name: "Lampu Tidur", desc: "Cahaya jingga yang temaram.", price: 450, kind: "lantai", beauty: 4, glow: true, tall: true },
  { id: "monstera", name: "Monstera", desc: "Daun lebar yang berlubang-lubang.", price: 500, kind: "lantai", beauty: 6, tall: true },
  { id: "terarium", name: "Terarium Semut", desc: "Kota kecil para semut pekerja.", price: 650, kind: "lantai", beauty: 4, tall: true },
  { id: "mesin-kopi", name: "Mesin Kopi", desc: "Harum kopi tubruk setiap saat.", price: 750, kind: "lantai", beauty: 4, tall: true },
  { id: "radio", name: "Radio Antik", desc: "Radio kayu peninggalan kakek.", price: 800, kind: "lantai", beauty: 5, tall: true },
  { id: "sofa", name: "Sofa Mungil", desc: "Sofa dua dudukan yang empuk.", price: 900, kind: "lantai", beauty: 6 },
  { id: "ayunan", name: "Ayunan Rotan", desc: "Kursi gantung anyaman rotan.", price: 1200, kind: "lantai", beauty: 7, tall: true },
  { id: "rak-buku", name: "Rak Buku", desc: "Penuh buku yang belum sempat dibaca.", price: 1500, kind: "lantai", beauty: 7, tall: true },
  { id: "akuarium", name: "Akuarium", desc: "Ikan-ikan kecil berenang tenang.", price: 2200, kind: "lantai", beauty: 9, tall: true },
  { id: "lampu-hangat", name: "Lampu Hangat", desc: "Lampu penghangat dengan batu datar.", price: 2600, kind: "lantai", beauty: 5, glow: true },
  // Karpet
  { id: "karpet-bundar", name: "Karpet Bundar", desc: "Karpet bulat yang lembut.", price: 200, kind: "karpet", beauty: 3 },
  { id: "karpet-rumput", name: "Karpet Rumput", desc: "Rumput sintetis yang hijau segar.", price: 320, kind: "karpet", beauty: 4 },
  { id: "karpet-batik", name: "Karpet Batik", desc: "Motif parang yang anggun.", price: 950, kind: "karpet", beauty: 8 },
  // Dinding
  { id: "jendela", name: "Jendela", desc: "Langitnya mengikuti jam di komputermu.", price: 0, kind: "dinding", beauty: 4, starter: true },
  { id: "poster", name: "Poster Gunung", desc: "Pemandangan gunung di pagi hari.", price: 150, kind: "dinding", beauty: 3 },
  { id: "rak-dinding", name: "Rak Dinding", desc: "Rak kecil dengan tanaman rambat.", price: 350, kind: "dinding", beauty: 5 },
  { id: "lampu-hias", name: "Lampu Hias", desc: "Untaian lampu kecil yang berkelip.", price: 400, kind: "dinding", beauty: 6, glow: true },
  { id: "jam", name: "Jam Dinding", desc: "Berdetak pelan, menunjukkan jam sungguhan.", price: 600, kind: "dinding", beauty: 4 },
  { id: "wayang", name: "Hiasan Wayang", desc: "Gunungan wayang kulit berwarna emas.", price: 800, kind: "dinding", beauty: 8 },
  // Meja
  { id: "mug", name: "Mug", desc: "Teh hangat untuk menemani kerja.", price: 0, kind: "meja", beauty: 1, starter: true },
  { id: "kaktus", name: "Kaktus Mini", desc: "Tidak perlu sering disiram.", price: 90, kind: "meja", beauty: 2 },
  { id: "buku-meja", name: "Tumpukan Buku", desc: "Bacaan untuk nanti.", price: 120, kind: "meja", beauty: 2 },
  { id: "lampu-meja", name: "Lampu Meja", desc: "Menerangi meja di malam hari.", price: 260, kind: "meja", beauty: 3, glow: true },
];

export const ITEM_BY_ID: Record<string, ItemDef> = byId(ITEMS);

// ---------------------------------------------------------------------------
// Tema dinding dan lantai

export const THEMES: ThemeDef[] = [
  { id: "krem", name: "Krem Polos", price: 0, part: "dinding", beauty: 2, starter: true },
  { id: "garis-hijau", name: "Garis Hijau", price: 300, part: "dinding", beauty: 4 },
  { id: "bintik-pink", name: "Bintik Merah Muda", price: 350, part: "dinding", beauty: 4 },
  { id: "bata", name: "Bata Merah", price: 450, part: "dinding", beauty: 4 },
  { id: "panel-kayu", name: "Panel Kayu", price: 600, part: "dinding", beauty: 5 },
  { id: "langit-malam", name: "Langit Malam", price: 800, part: "dinding", beauty: 6 },
  { id: "kawung", name: "Batik Kawung", price: 900, part: "dinding", beauty: 7 },
  { id: "kayu", name: "Papan Kayu", price: 0, part: "lantai", beauty: 2, starter: true },
  { id: "ubin-catur", name: "Ubin Catur", price: 350, part: "lantai", beauty: 4 },
  { id: "tikar", name: "Tikar Anyaman", price: 450, part: "lantai", beauty: 5 },
  { id: "teraso", name: "Teraso", price: 500, part: "lantai", beauty: 5 },
  { id: "parket", name: "Parket Gelap", price: 650, part: "lantai", beauty: 5 },
];

export const THEME_BY_ID: Record<string, ThemeDef> = byId(THEMES);

// ---------------------------------------------------------------------------
// Tamu: hewan mungil Nusantara

export const GUESTS: GuestDef[] = [
  {
    id: "oyen",
    name: "Oyen",
    desc: "Kucing oren penguasa gang. Datang untuk numpang tidur, pergi tanpa pamit.",
    hint: "Suka tempat empuk untuk rebahan.",
    rarity: "biasa",
    likes: ["bantal"],
    stay: [10, 25],
  },
  {
    id: "kelinci",
    name: "Kelinci",
    desc: "Kelinci gembul yang hidungnya tak pernah berhenti bergerak.",
    hint: "Penggemar sayuran oranye yang renyah. Datang siang hari.",
    rarity: "biasa",
    likes: ["wortel"],
    time: "siang",
    stay: [8, 20],
  },
  {
    id: "kancil",
    name: "Kancil",
    desc: "Si cerdik dari dongeng. Katanya sudah tobat, tapi matanya masih melirik timun.",
    hint: "Ada sayuran hijau yang dulu sering ia ambil dari kebun Pak Tani.",
    rarity: "biasa",
    likes: ["timun"],
    stay: [8, 20],
  },
  {
    id: "anoa",
    name: "Anoa",
    desc: "Kerbau kerdil dari Sulawesi. Pemalu, tapi betah duduk di atas rumput.",
    hint: "Rindu padang rumput hijau di bawah kakinya.",
    rarity: "biasa",
    likes: ["karpet-rumput"],
    stay: [10, 22],
  },
  {
    id: "trenggiling",
    name: "Trenggiling",
    desc: "Bersisik seperti nanas berjalan. Menggulung jadi bola kalau malu.",
    hint: "Tertarik pada rumah kaca kecil berisi serangga pekerja.",
    rarity: "langka",
    likes: ["terarium"],
    stay: [8, 18],
  },
  {
    id: "luwak",
    name: "Musang Luwak",
    desc: "Ahli kopi paling terkenal di Nusantara. Hanya keluar saat malam.",
    hint: "Tercium aroma kopi di malam hari...",
    rarity: "langka",
    likes: ["mesin-kopi"],
    time: "malam",
    stay: [8, 18],
  },
  {
    id: "kukang",
    name: "Kukang",
    desc: "Bergerak super pelan dan suka cahaya temaram. Matanya bulat seperti kelereng.",
    hint: "Muncul malam hari bila ada cahaya lampu yang redup.",
    rarity: "langka",
    likes: ["lampu-tidur"],
    time: "malam",
    stay: [20, 40],
  },
  {
    id: "tarsius",
    name: "Tarsius",
    desc: "Primata mungil bermata raksasa dari Sulawesi. Bisa menoleh hampir ke belakang.",
    hint: "Bersembunyi di balik daun lebar pada malam hari.",
    rarity: "langka",
    likes: ["monstera"],
    time: "malam",
    stay: [8, 18],
  },
  {
    id: "bekantan",
    name: "Bekantan",
    desc: "Monyet berhidung besar dari Kalimantan. Paling senang berayun santai.",
    hint: "Suka sesuatu yang bisa diayun pelan-pelan.",
    rarity: "langka",
    likes: ["ayunan"],
    stay: [10, 20],
  },
  {
    id: "jalak",
    name: "Jalak Bali",
    desc: "Burung putih bertopeng biru yang senang bernyanyi bersama radio.",
    hint: "Datang kalau radio antik sedang memutar musik.",
    rarity: "langka",
    likes: ["radio"],
    needs: { radio: "apa-saja" },
    stay: [6, 15],
    flies: true,
  },
  {
    id: "katak",
    name: "Katak Pohon",
    desc: "Katak hijau mungil berjari lengket. Suaranya mirip orang tertawa.",
    hint: "Suka tanaman lembap dan suara hujan.",
    rarity: "langka",
    likes: ["pakis"],
    needs: { radio: "hujan" },
    stay: [6, 15],
  },
  {
    id: "celepuk",
    name: "Celepuk",
    desc: "Burung hantu kecil dari Rinjani. Diam-diam ikut menghitung detik jam.",
    hint: "Burung malam yang senang mendengar detak jam dinding.",
    rarity: "epik",
    likes: ["jam"],
    time: "malam",
    stay: [8, 16],
    flies: true,
  },
  {
    id: "orangutan",
    name: "Orangutan",
    desc: "Bayi orangutan yang penasaran pada buku. Sering membacanya terbalik.",
    hint: "Kutu buku berbulu jingga.",
    rarity: "epik",
    likes: ["rak-buku"],
    stay: [8, 16],
  },
  {
    id: "penyu",
    name: "Penyu",
    desc: "Penyu hijau yang tersesat dari pantai. Betah memandangi ikan di akuarium.",
    hint: "Rindu air dan ikan-ikan kecil.",
    rarity: "epik",
    likes: ["akuarium"],
    stay: [10, 20],
  },
  {
    id: "komodo",
    name: "Komodo Kecil",
    desc: "Bayi komodo yang hanya menghormati pekerja keras. Suka berjemur di bawah lampu.",
    hint: "Hanya menemui orang yang menyelesaikan 3 sesi fokus dalam sehari. Suka tempat hangat.",
    rarity: "legenda",
    likes: ["lampu-hangat"],
    needs: { focusToday: 3 },
    stay: [6, 12],
  },
  {
    id: "cendrawasih",
    name: "Cendrawasih",
    desc: "Burung surga dari Papua. Hanya singgah di kamar yang benar-benar indah.",
    hint: "Singgah di kamar yang sangat indah (keindahan 55), apalagi bila diiringi gamelan.",
    rarity: "legenda",
    likes: [],
    needs: { beauty: 55, radio: "gamelan" },
    stay: [5, 10],
    flies: true,
  },
];

export const GUEST_BY_ID: Record<string, GuestDef> = byId(GUESTS);

export const RARITY_NAME: Record<Rarity, string> = {
  biasa: "Biasa",
  langka: "Langka",
  epik: "Epik",
  legenda: "Legenda",
};

/** Bobot peluang datang. */
export const RARITY_WEIGHT: Record<Rarity, number> = { biasa: 10, langka: 6, epik: 3, legenda: 2 };

/** Koin yang ditinggalkan tamu saat pulang. */
export const RARITY_TIP: Record<Rarity, number> = { biasa: 12, langka: 28, epik: 60, legenda: 180 };

// ---------------------------------------------------------------------------
// Avatar

export const SKINS: ColorDef[] = [
  { id: "kulit-1", name: "Terang", base: "#f6d3b8", shade: "#e3ad8e" },
  { id: "kulit-2", name: "Kuning langsat", base: "#efc196", shade: "#d79b6f" },
  { id: "kulit-3", name: "Sawo matang", base: "#d39a6a", shade: "#b0774b" },
  { id: "kulit-4", name: "Cokelat", base: "#a8704a", shade: "#835233" },
  { id: "kulit-5", name: "Gelap", base: "#6e4630", shade: "#53321f" },
];

export const HAIR_COLORS: ColorDef[] = [
  { id: "hitam", name: "Hitam", base: "#2f2a33", shade: "#1c1820", light: "#4a4352" },
  { id: "cokelat-tua", name: "Cokelat tua", base: "#5a3a2a", shade: "#3d261b", light: "#7a5340" },
  { id: "cokelat", name: "Cokelat", base: "#8a5a35", shade: "#663f22", light: "#a9774c" },
  { id: "pirang", name: "Pirang", base: "#e0b55c", shade: "#b98a3a", light: "#f2d18a" },
  { id: "merah", name: "Merah", base: "#b8452f", shade: "#8a2f20", light: "#d8664c" },
  { id: "abu", name: "Abu-abu", base: "#a9a7ad", shade: "#7f7d85", light: "#cbc9ce" },
  { id: "krem", name: "Krem", base: "#e8d6b5", shade: "#c9b28c", light: "#f6ead3" },
  { id: "biru", name: "Biru", base: "#4f74c9", shade: "#36529a", light: "#7397e0" },
  { id: "pink", name: "Merah muda", base: "#e98aa9", shade: "#c46383", light: "#f6b2c8" },
  { id: "hijau", name: "Hijau", base: "#5e9a6a", shade: "#41744d", light: "#80bb8b" },
  { id: "ungu", name: "Ungu", base: "#8a67b8", shade: "#664a8c", light: "#a98ad1" },
];

export const TOP_COLORS: ColorDef[] = [
  { id: "putih", name: "Putih", base: "#f2eee6", shade: "#cfc8bb" },
  { id: "merah", name: "Merah", base: "#d4574a", shade: "#a63d33" },
  { id: "kuning", name: "Kuning", base: "#f0c24e", shade: "#c99a2c" },
  { id: "hijau", name: "Hijau", base: "#6fae6a", shade: "#4f874c" },
  { id: "biru", name: "Biru", base: "#5b8fd6", shade: "#3f6aa8" },
  { id: "ungu", name: "Ungu", base: "#9b7bd0", shade: "#755aa3" },
  { id: "pink", name: "Merah muda", base: "#ef9bb5", shade: "#c97690" },
  { id: "hitam", name: "Hitam", base: "#3d3a44", shade: "#25232b" },
];

export const COSMETICS: CosmeticDef[] = [
  { id: "pendek", name: "Pendek", slot: "rambut", price: 0 },
  { id: "poni", name: "Berponi", slot: "rambut", price: 0 },
  { id: "bob", name: "Bob", slot: "rambut", price: 0 },
  { id: "panjang", name: "Panjang", slot: "rambut", price: 0 },
  { id: "hijab", name: "Hijab", slot: "rambut", price: 0 },
  { id: "cepak", name: "Cepak", slot: "rambut", price: 0 },
  { id: "kuncir", name: "Kuncir kuda", slot: "rambut", price: 150 },
  { id: "keriting", name: "Keriting", slot: "rambut", price: 200 },
  { id: "sanggul", name: "Sanggul", slot: "rambut", price: 220 },
  { id: "kaos", name: "Kaos", slot: "atasan", price: 0 },
  { id: "kemeja", name: "Kemeja", slot: "atasan", price: 0 },
  { id: "hoodie", name: "Hoodie", slot: "atasan", price: 200 },
  { id: "sweter", name: "Sweter", slot: "atasan", price: 250 },
  { id: "jaket", name: "Jaket", slot: "atasan", price: 350 },
  { id: "batik", name: "Batik", slot: "atasan", price: 450 },
  { id: "tanpa", name: "Tanpa", slot: "aksesori", price: 0 },
  { id: "kacamata", name: "Kacamata", slot: "aksesori", price: 120 },
  { id: "bando", name: "Bando Bunga", slot: "aksesori", price: 150 },
  { id: "peci", name: "Peci", slot: "aksesori", price: 200 },
  { id: "topi", name: "Topi", slot: "aksesori", price: 250 },
  { id: "headphone", name: "Headphone", slot: "aksesori", price: 300 },
];

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = byId(COSMETICS);

// ---------------------------------------------------------------------------
// Radio

export const STATIONS: { id: StationId; name: string; desc: string }[] = [
  { id: "lofi", name: "Lo-fi Santai", desc: "Akor hangat dan ketukan pelan." },
  { id: "gamelan", name: "Gamelan Senja", desc: "Denting saron dan gong yang tenang." },
  { id: "hujan", name: "Suara Hujan", desc: "Rintik hujan dan guntur di kejauhan." },
];

// ---------------------------------------------------------------------------
// Kata penyemangat

export const CHEERS: string[] = [
  "Pelan-pelan saja, yang penting jalan terus.",
  "Kamu sudah bekerja keras hari ini.",
  "Jangan lupa minum air putih, ya.",
  "Istirahat juga bagian dari bekerja.",
  "Satu langkah kecil tetap sebuah kemajuan.",
  "Tarik napas dalam-dalam... lalu lanjut lagi.",
  "Tugas besar selesai dengan dicicil.",
  "Coba regangkan bahu sebentar.",
  "Kamu tidak harus sempurna untuk mulai.",
  "Yang sudah selesai hari ini layak dirayakan.",
  "Fokus pada satu hal dulu, sisanya menyusul.",
  "Matamu butuh istirahat: lihat jauh selama 20 detik.",
  "Kerja bagus! Hewan-hewan bangga padamu.",
  "Sudah makan? Jangan sampai lupa.",
  "Hari ini cukup lakukan yang terbaik yang kamu bisa.",
  "Tidak apa-apa kalau hari ini lambat.",
  "Senyum dulu sebentar :)",
  "Kamu lebih hebat dari yang kamu kira.",
  "Selesaikan satu, centang satu. Pasti terasa lega.",
  "Duduk tegak, bahu rileks, semangat lagi!",
];

/** Kalimat avatar saat diklik. */
export const AVATAR_LINES: string[] = [
  "Ayo, sedikit lagi!",
  "Aku temani sampai selesai.",
  "Mau istirahat sebentar?",
  "Semangat!",
  "Hmm... tinggal sedikit lagi.",
  "Kopinya masih hangat.",
];
