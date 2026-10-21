// Tipe data inti Teman Kerja. Semua state permainan bisa diserialisasi ke JSON.

export type Rarity = "biasa" | "langka" | "epik" | "legenda";

/** Tempat barang bisa dipasang di kamar. */
export type SlotKind = "lantai" | "dinding" | "meja" | "karpet";

export type StationId = "lofi" | "gamelan" | "hujan";

export type DayPart = "pagi" | "siang" | "sore" | "malam";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: SlotKind;
  /** Nilai keindahan kamar yang disumbangkan barang ini. */
  beauty: number;
  /** Menyala di malam hari. */
  glow?: boolean;
  /** Barang tinggi tidak boleh di slot depan (menutupi kamar). */
  tall?: boolean;
  /** Dimiliki sejak awal. */
  starter?: boolean;
}

export interface ThemeDef {
  id: string;
  name: string;
  price: number;
  part: "dinding" | "lantai";
  beauty: number;
  starter?: boolean;
}

export interface GuestNeeds {
  /** Radio harus menyala; "apa-saja" berarti stasiun apa pun. */
  radio?: StationId | "apa-saja";
  /** Jumlah sesi fokus selesai hari ini, minimal. */
  focusToday?: number;
  /** Nilai keindahan kamar, minimal. */
  beauty?: number;
  /** Pemain sedang aktif mengetik. */
  typing?: boolean;
}

export interface GuestDef {
  id: string;
  name: string;
  /** Keterangan di buku tamu setelah ditemukan. */
  desc: string;
  /** Petunjuk yang terlihat sebelum ditemukan. */
  hint: string;
  rarity: Rarity;
  /** Barang kesukaan; salah satunya harus terpasang. Kosong = tidak perlu barang. */
  likes: string[];
  /** Hanya datang pada waktu tertentu (waktu komputer). */
  time?: "siang" | "malam";
  needs?: GuestNeeds;
  /** Lama berkunjung, menit [min, maks]. */
  stay: [number, number];
  /** Bisa terbang (hinggap di atas barang). */
  flies?: boolean;
}

export type CosmeticSlot = "rambut" | "atasan" | "aksesori";

export interface CosmeticDef {
  id: string;
  name: string;
  slot: CosmeticSlot;
  price: number;
}

export interface ColorDef {
  id: string;
  name: string;
  /** Warna utama dan bayangannya. */
  base: string;
  shade: string;
  light?: string;
}

export interface AvatarState {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  accessory: string;
}

export interface RoomState {
  /** slotId -> itemId (atau null bila kosong). */
  slots: Record<string, string | null>;
  wall: string;
  floor: string;
}

export interface Visit {
  guestId: string;
  arrivedAt: number;
  leaveAt: number;
  /** Tempat duduk: "slot:<slotId>" atau "titik:<n>". */
  spot: string;
  /** Sudah dielus pada kunjungan ini. */
  petted: boolean;
}

export interface GuestRecord {
  visits: number;
  firstSeen: number;
  lastSeen: number;
  /** Poin keakraban dari elusan; menentukan hati. */
  affection: number;
  /** Jumlah hati yang hadiahnya sudah diberikan. */
  giftedHearts: number;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  doneAt?: number;
  /** Sudah memberi koin (agar centang-batal-centang tidak menambah koin terus). */
  rewarded?: boolean;
}

export type FocusPhase = "siap" | "fokus" | "istirahat";

export interface FocusState {
  phase: FocusPhase;
  /** Waktu fase berakhir (ms), null bila siap atau dijeda. */
  endsAt: number | null;
  /** Sisa waktu saat dijeda (ms). */
  pausedLeft: number | null;
  focusMin: number;
  breakMin: number;
  /** Sesi selesai hari ini dan tanggalnya (YYYY-MM-DD). */
  today: number;
  todayDate: string;
  sessions: number;
  totalMin: number;
}

export interface TypingState {
  enabled: boolean;
  /** Pemain sudah ditanya izinnya. */
  asked: boolean;
  today: number;
  todayDate: string;
  total: number;
  best: number;
  /** Sisa ketukan yang belum menjadi koin. */
  carry: number;
}

export interface RadioState {
  station: StationId | null;
  volume: number;
}

export interface Settings {
  sound: boolean;
  volume: number;
  corner: "kanan" | "kiri";
  /** Ukuran kamar (perbesaran piksel). */
  scale: 2 | 3 | 4;
  /** Ingatkan dengan notifikasi saat sesi fokus selesai. */
  notify: boolean;
  /** Kata penyemangat sesekali muncul. */
  cheers: boolean;
}

export interface Stats {
  visits: number;
  pets: number;
  tasksDone: number;
  coinsEarned: number;
  tasksRewardedToday: number;
  tasksRewardDate: string;
}

export interface AwayReport {
  minutes: number;
  visits: number;
  coins: number;
  newGuests: string[];
}

export interface GameState {
  version: number;
  createdAt: number;
  lastSeen: number;
  coins: number;
  owned: string[];
  ownedThemes: string[];
  ownedCosmetics: string[];
  room: RoomState;
  avatar: AvatarState;
  visitors: Visit[];
  guests: Record<string, GuestRecord>;
  /** Waktu tamu terakhir pulang, untuk jeda sebelum datang lagi. */
  lastLeft: Record<string, number>;
  nextSpawnAt: number;
  todos: Todo[];
  memo: string;
  focus: FocusState;
  typing: TypingState;
  radio: RadioState;
  settings: Settings;
  stats: Stats;
  /** Barang baru yang belum dilihat di toko (titik penanda). */
  seenShop: boolean;
}

/** Keadaan sesaat yang tidak disimpan tetapi memengaruhi tamu. */
export interface LiveContext {
  /** Radio sedang berbunyi (stasiun), null bila mati. */
  station: StationId | null;
  /** Pemain mengetik dalam satu menit terakhir. */
  typing: boolean;
  /** Aplikasi sedang terbuka (bukan simulasi saat tertutup). */
  online: boolean;
}
