// State awal dan pembersihan simpanan (simpanan lama atau rusak sebagian tetap bisa dimuat).

import {
  COSMETIC_BY_ID,
  COSMETICS,
  fits,
  FLOOR_SPOTS,
  GUEST_BY_ID,
  HAIR_COLORS,
  ITEM_BY_ID,
  ITEMS,
  SKINS,
  SLOT_BY_ID,
  SLOTS,
  THEME_BY_ID,
  THEMES,
  TOP_COLORS,
} from "./data";
import { dateKey, MINUTE } from "./time";
import type {
  AvatarState,
  FocusState,
  GameState,
  GuestRecord,
  RadioState,
  RoomState,
  Settings,
  Stats,
  StationId,
  Todo,
  TypingState,
  Visit,
} from "./types";

export const SAVE_VERSION = 1;

/** Tamu pertama datang tak lama setelah permainan dimulai. */
export const FIRST_SPAWN_MS = 40_000;

export const MAX_TODOS = 50;
export const MAX_TODO_LENGTH = 120;
export const MAX_MEMO_LENGTH = 5000;

export function defaultRoom(): RoomState {
  const slots: Record<string, string | null> = Object.fromEntries(SLOTS.map((s) => [s.id, null]));
  slots["lantai-4"] = "bantal";
  slots["dinding-4"] = "jendela";
  slots["meja-1"] = "mug";
  return { slots, wall: "krem", floor: "kayu" };
}

export function defaultAvatar(): AvatarState {
  return { skin: "kulit-2", hair: "pendek", hairColor: "hitam", top: "kaos", topColor: "kuning", accessory: "tanpa" };
}

export function defaultFocus(now: number): FocusState {
  return {
    phase: "siap",
    endsAt: null,
    pausedLeft: null,
    focusMin: 25,
    breakMin: 5,
    today: 0,
    todayDate: dateKey(now),
    sessions: 0,
    totalMin: 0,
  };
}

export function defaultTyping(now: number): TypingState {
  return { enabled: false, asked: false, today: 0, todayDate: dateKey(now), total: 0, best: 0, carry: 0 };
}

export function defaultSettings(): Settings {
  return { sound: true, volume: 0.6, corner: "kanan", scale: 3, notify: true, cheers: true };
}

export function defaultStats(now: number): Stats {
  return {
    visits: 0,
    pets: 0,
    tasksDone: 0,
    coinsEarned: 0,
    tasksRewardedToday: 0,
    tasksRewardDate: dateKey(now),
  };
}

export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    coins: 150,
    owned: ITEMS.filter((i) => i.starter).map((i) => i.id),
    ownedThemes: THEMES.filter((t) => t.starter).map((t) => t.id),
    ownedCosmetics: COSMETICS.filter((c) => c.price === 0).map((c) => c.id),
    room: defaultRoom(),
    avatar: defaultAvatar(),
    visitors: [],
    guests: {},
    lastLeft: {},
    nextSpawnAt: now + FIRST_SPAWN_MS,
    todos: [],
    memo: "",
    focus: defaultFocus(now),
    typing: defaultTyping(now),
    radio: { station: null, volume: 0.5 },
    settings: defaultSettings(),
    stats: defaultStats(now),
    seenShop: false,
  };
}

// ---------------------------------------------------------------------------
// Migrasi / pembersihan

type Raw = Record<string, unknown>;

function obj(v: unknown): Raw {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, fallback: string, maxLen = 200): string {
  return typeof v === "string" ? v.slice(0, maxLen) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function idList(v: unknown, valid: (id: string) => boolean): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && valid(x)))];
}

const STATION_IDS: readonly StationId[] = ["lofi", "gamelan", "hujan"];

function migrateRoom(raw: unknown, owned: string[], ownedThemes: string[]): RoomState {
  const r = obj(raw);
  const base = defaultRoom();
  const slotsRaw = obj(r.slots);
  const used = new Set<string>();
  const slots: Record<string, string | null> = {};
  for (const slot of SLOTS) {
    const id = slotsRaw[slot.id];
    const item = typeof id === "string" ? ITEM_BY_ID[id] : undefined;
    // Barang harus dimiliki, cocok dengan jenis slot, dan hanya dipasang sekali.
    if (item && fits(item.id, slot.id) && owned.includes(item.id) && !used.has(item.id)) {
      slots[slot.id] = item.id;
      used.add(item.id);
    } else {
      slots[slot.id] = r.slots === undefined ? base.slots[slot.id] : null;
    }
  }
  const wallId = str(r.wall, base.wall);
  const floorId = str(r.floor, base.floor);
  const wall = THEME_BY_ID[wallId]?.part === "dinding" && ownedThemes.includes(wallId) ? wallId : base.wall;
  const floor = THEME_BY_ID[floorId]?.part === "lantai" && ownedThemes.includes(floorId) ? floorId : base.floor;
  return { slots, wall, floor };
}

function migrateAvatar(raw: unknown, ownedCosmetics: string[]): AvatarState {
  const a = obj(raw);
  const base = defaultAvatar();
  const cosmetic = (v: unknown, slot: string, fallback: string): string => {
    const id = typeof v === "string" ? v : "";
    const def = COSMETIC_BY_ID[id];
    return def && def.slot === slot && ownedCosmetics.includes(id) ? id : fallback;
  };
  return {
    skin: oneOf(a.skin, SKINS.map((s) => s.id), base.skin),
    hair: cosmetic(a.hair, "rambut", base.hair),
    hairColor: oneOf(a.hairColor, HAIR_COLORS.map((c) => c.id), base.hairColor),
    top: cosmetic(a.top, "atasan", base.top),
    topColor: oneOf(a.topColor, TOP_COLORS.map((c) => c.id), base.topColor),
    accessory: cosmetic(a.accessory, "aksesori", base.accessory),
  };
}

/** Tempat duduk yang sah: "titik:0..5" atau "slot:<id slot lantai/karpet/dinding>". */
export function validSpot(spot: string): boolean {
  const m = /^titik:(\d+)$/.exec(spot);
  if (m) return Number(m[1]) < FLOOR_SPOTS;
  if (!spot.startsWith("slot:")) return false;
  const kind = SLOT_BY_ID[spot.slice(5)]?.kind;
  return kind === "lantai" || kind === "karpet" || kind === "dinding";
}

function migrateVisits(raw: unknown, now: number): Visit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const spots = new Set<string>();
  const out: Visit[] = [];
  for (const entry of raw) {
    const v = obj(entry);
    const guestId = str(v.guestId, "");
    const spot = str(v.spot, "");
    if (!GUEST_BY_ID[guestId] || seen.has(guestId) || !validSpot(spot) || spots.has(spot)) continue;
    seen.add(guestId);
    spots.add(spot);
    out.push({
      guestId,
      arrivedAt: num(v.arrivedAt, now),
      leaveAt: num(v.leaveAt, now),
      spot,
      petted: bool(v.petted, false),
    });
  }
  return out.slice(0, 3);
}

function migrateGuests(raw: unknown): Record<string, GuestRecord> {
  const g = obj(raw);
  const out: Record<string, GuestRecord> = {};
  for (const [id, value] of Object.entries(g)) {
    if (!GUEST_BY_ID[id]) continue;
    const r = obj(value);
    out[id] = {
      visits: Math.floor(num(r.visits, 0, 0)),
      firstSeen: num(r.firstSeen, 0, 0),
      lastSeen: num(r.lastSeen, 0, 0),
      affection: Math.floor(num(r.affection, 0, 0)),
      giftedHearts: Math.floor(num(r.giftedHearts, 0, 0, 5)),
    };
  }
  return out;
}

function migrateTodos(raw: unknown, now: number): Todo[] {
  if (!Array.isArray(raw)) return [];
  const out: Todo[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    const t = obj(entry);
    const text = str(t.text, "", MAX_TODO_LENGTH).trim();
    const id = str(t.id, "", 40);
    if (!text || !id || ids.has(id)) continue;
    ids.add(id);
    out.push({
      id,
      text,
      done: bool(t.done, false),
      createdAt: num(t.createdAt, now),
      doneAt: typeof t.doneAt === "number" ? t.doneAt : undefined,
      rewarded: bool(t.rewarded, false) || undefined,
    });
  }
  return out.slice(0, MAX_TODOS);
}

function migrateFocus(raw: unknown, now: number): FocusState {
  const f = obj(raw);
  const base = defaultFocus(now);
  const phase = oneOf(f.phase, ["siap", "fokus", "istirahat"] as const, "siap");
  const endsAt = typeof f.endsAt === "number" && Number.isFinite(f.endsAt) ? f.endsAt : null;
  const pausedLeft = typeof f.pausedLeft === "number" && Number.isFinite(f.pausedLeft) ? f.pausedLeft : null;
  const valid = phase === "siap" || endsAt !== null || pausedLeft !== null;
  return {
    phase: valid ? phase : "siap",
    endsAt: valid && phase !== "siap" ? endsAt : null,
    pausedLeft: valid && phase !== "siap" && endsAt === null ? pausedLeft : null,
    focusMin: Math.round(num(f.focusMin, base.focusMin, 5, 90)),
    breakMin: Math.round(num(f.breakMin, base.breakMin, 1, 30)),
    today: Math.floor(num(f.today, 0, 0)),
    todayDate: str(f.todayDate, base.todayDate, 10),
    sessions: Math.floor(num(f.sessions, 0, 0)),
    totalMin: Math.floor(num(f.totalMin, 0, 0)),
  };
}

function migrateTyping(raw: unknown, now: number): TypingState {
  const t = obj(raw);
  const base = defaultTyping(now);
  return {
    enabled: bool(t.enabled, false),
    asked: bool(t.asked, false),
    today: Math.floor(num(t.today, 0, 0)),
    todayDate: str(t.todayDate, base.todayDate, 10),
    total: Math.floor(num(t.total, 0, 0)),
    best: Math.floor(num(t.best, 0, 0)),
    carry: Math.floor(num(t.carry, 0, 0, 1000)),
  };
}

function migrateRadio(raw: unknown): RadioState {
  const r = obj(raw);
  const station = typeof r.station === "string" && (STATION_IDS as readonly string[]).includes(r.station)
    ? (r.station as StationId)
    : null;
  return { station, volume: num(r.volume, 0.5, 0, 1) };
}

function migrateSettings(raw: unknown): Settings {
  const s = obj(raw);
  const base = defaultSettings();
  const scale = num(s.scale, base.scale);
  return {
    sound: bool(s.sound, base.sound),
    volume: num(s.volume, base.volume, 0, 1),
    corner: oneOf(s.corner, ["kanan", "kiri"] as const, base.corner),
    scale: scale === 2 || scale === 4 ? scale : 3,
    notify: bool(s.notify, base.notify),
    cheers: bool(s.cheers, base.cheers),
  };
}

function migrateStats(raw: unknown, now: number): Stats {
  const s = obj(raw);
  const base = defaultStats(now);
  return {
    visits: Math.floor(num(s.visits, 0, 0)),
    pets: Math.floor(num(s.pets, 0, 0)),
    tasksDone: Math.floor(num(s.tasksDone, 0, 0)),
    coinsEarned: Math.floor(num(s.coinsEarned, 0, 0)),
    tasksRewardedToday: Math.floor(num(s.tasksRewardedToday, 0, 0)),
    tasksRewardDate: str(s.tasksRewardDate, base.tasksRewardDate, 10),
  };
}

/** Ubah data simpanan apa pun menjadi GameState yang valid. */
export function migrateState(raw: unknown, now: number): GameState {
  const r = obj(raw);
  if (typeof r.version !== "number") throw new Error("bukan simpanan Teman Kerja");
  const base = createInitialState(now);

  const owned = idList(r.owned, (id) => !!ITEM_BY_ID[id]);
  for (const id of base.owned) if (!owned.includes(id)) owned.push(id);
  const ownedThemes = idList(r.ownedThemes, (id) => !!THEME_BY_ID[id]);
  for (const id of base.ownedThemes) if (!ownedThemes.includes(id)) ownedThemes.push(id);
  const ownedCosmetics = idList(r.ownedCosmetics, (id) => !!COSMETIC_BY_ID[id]);
  for (const id of base.ownedCosmetics) if (!ownedCosmetics.includes(id)) ownedCosmetics.push(id);

  const lastLeftRaw = obj(r.lastLeft);
  const lastLeft: Record<string, number> = {};
  for (const [id, t] of Object.entries(lastLeftRaw)) {
    if (GUEST_BY_ID[id] && typeof t === "number" && Number.isFinite(t)) lastLeft[id] = t;
  }

  const room = migrateRoom(r.room, owned, ownedThemes);
  const guests = migrateGuests(r.guests);
  // Tamu tanpa catatan buku tamu tidak bisa dielus dan tidak memberi koin: buang.
  const visitors = migrateVisits(r.visitors, now).filter((v) => !!guests[v.guestId]);

  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: num(r.createdAt, now),
    lastSeen: num(r.lastSeen, now, 0, now),
    coins: Math.floor(num(r.coins, base.coins, 0, 1e12)),
    owned,
    ownedThemes,
    ownedCosmetics,
    room,
    avatar: migrateAvatar(r.avatar, ownedCosmetics),
    visitors,
    guests,
    lastLeft,
    nextSpawnAt: num(r.nextSpawnAt, now + FIRST_SPAWN_MS),
    todos: migrateTodos(r.todos, now),
    memo: str(r.memo, "", MAX_MEMO_LENGTH),
    focus: migrateFocus(r.focus, now),
    typing: migrateTyping(r.typing, now),
    radio: migrateRadio(r.radio),
    settings: migrateSettings(r.settings),
    stats: migrateStats(r.stats, now),
    seenShop: bool(r.seenShop, false),
  };
  sanitizeTimes(state, now);
  return state;
}

/** Jeda kedatangan dan lama kunjungan terpanjang (untuk membatasi waktu masa depan). */
const MAX_SPAWN_GAP = 8 * MINUTE;
const MAX_STAY = 40 * MINUTE;

/**
 * Batasi waktu yang terlalu jauh di masa depan, misalnya setelah jam komputer
 * sempat dimajukan lalu dibetulkan. Tanpa ini tamu tidak pernah pulang dan tidak
 * ada yang datang sampai waktu itu tiba.
 */
export function sanitizeTimes(state: GameState, now: number): void {
  state.lastSeen = Math.min(state.lastSeen, now);
  state.nextSpawnAt = Math.min(state.nextSpawnAt, now + MAX_SPAWN_GAP);
  for (const v of state.visitors) {
    v.arrivedAt = Math.min(v.arrivedAt, now);
    v.leaveAt = Math.min(v.leaveAt, now + MAX_STAY);
  }
  for (const id of Object.keys(state.lastLeft)) state.lastLeft[id] = Math.min(state.lastLeft[id], now);
  for (const rec of Object.values(state.guests)) {
    rec.firstSeen = Math.min(rec.firstSeen, now);
    rec.lastSeen = Math.min(rec.lastSeen, now);
  }
  const f = state.focus;
  const length = (f.phase === "istirahat" ? f.breakMin : f.focusMin) * MINUTE;
  if (f.endsAt !== null) f.endsAt = Math.min(f.endsAt, now + length);
  if (f.pausedLeft !== null) f.pausedLeft = Math.min(Math.max(0, f.pausedLeft), length);
}
