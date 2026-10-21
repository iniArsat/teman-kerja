// Aturan kunjungan tamu: siapa yang boleh datang, ke mana ia duduk, berapa lama,
// dan berapa koin yang ditinggalkan. Murni (tanpa DOM) agar mudah diuji.

import { FLOOR_SPOTS, GUESTS, ITEM_BY_ID, RARITY_TIP, RARITY_WEIGHT, SLOT_BY_ID, THEME_BY_ID } from "./data";
import { MINUTE, dateKey, isNight } from "./time";
import type { GameState, GuestDef, LiveContext, Visit } from "./types";

export const MAX_VISITORS = 3;
/** Jeda antar kedatangan, menit. */
export const SPAWN_GAP: [number, number] = [3, 8];
/** Bila tidak ada tamu yang bisa datang, cek lagi setelah ini. */
export const RETRY_GAP = 2 * MINUTE;
/** Tamu yang baru pulang tidak datang lagi sebelum jeda ini lewat. */
export const RETURN_COOLDOWN = 15 * MINUTE;

/** Ambang poin keakraban untuk 1..5 hati. */
export const HEART_THRESHOLDS = [1, 3, 6, 10, 15];

export type Rng = () => number;

export function heartsFor(affection: number): number {
  let hearts = 0;
  for (const t of HEART_THRESHOLDS) if (affection >= t) hearts++;
  return hearts;
}

export function placedItems(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const id of Object.values(state.room.slots)) if (id) out.add(id);
  return out;
}

/** Nilai keindahan kamar: barang terpasang ditambah tema dinding dan lantai. */
export function roomBeauty(state: GameState): number {
  let total = 0;
  for (const id of placedItems(state)) total += ITEM_BY_ID[id]?.beauty ?? 0;
  total += THEME_BY_ID[state.room.wall]?.beauty ?? 0;
  total += THEME_BY_ID[state.room.floor]?.beauty ?? 0;
  return total;
}

/** Sesi fokus hari ini (0 bila tanggalnya sudah lewat). */
export function focusToday(state: GameState, now: number): number {
  return state.focus.todayDate === dateKey(now) ? state.focus.today : 0;
}

export interface Eligibility {
  ok: boolean;
  /** Alasan singkat bila belum memenuhi (untuk pengujian dan petunjuk). */
  reason?: string;
}

export function checkGuest(def: GuestDef, state: GameState, ctx: LiveContext, now: number): Eligibility {
  const placed = placedItems(state);
  if (def.likes.length > 0 && !def.likes.some((id) => placed.has(id))) return { ok: false, reason: "barang" };
  if (def.time === "malam" && !isNight(now)) return { ok: false, reason: "waktu" };
  if (def.time === "siang" && isNight(now)) return { ok: false, reason: "waktu" };
  const needs = def.needs;
  if (needs) {
    if (needs.radio) {
      if (!ctx.station) return { ok: false, reason: "radio" };
      if (needs.radio !== "apa-saja" && ctx.station !== needs.radio) return { ok: false, reason: "radio" };
    }
    if (needs.focusToday !== undefined && focusToday(state, now) < needs.focusToday) return { ok: false, reason: "fokus" };
    if (needs.beauty !== undefined && roomBeauty(state) < needs.beauty) return { ok: false, reason: "keindahan" };
    if (needs.typing && !ctx.typing) return { ok: false, reason: "mengetik" };
  }
  return { ok: true };
}

/** Tempat duduk untuk tamu: di barang kesukaannya bila kosong, kalau tidak di titik lantai bebas. */
export function assignSpot(def: GuestDef, state: GameState, visitors: Visit[] = state.visitors): string | null {
  const taken = new Set(visitors.map((v) => v.spot));
  for (const [slotId, itemId] of Object.entries(state.room.slots)) {
    if (!itemId || !def.likes.includes(itemId)) continue;
    const kind = SLOT_BY_ID[slotId]?.kind;
    // Burung boleh hinggap di atas barang dinding (misalnya jam).
    const ok = kind === "lantai" || kind === "karpet" || (kind === "dinding" && def.flies);
    if (!ok) continue;
    const spot = `slot:${slotId}`;
    if (!taken.has(spot)) return spot;
  }
  for (let i = 0; i < FLOOR_SPOTS; i++) {
    const spot = `titik:${i}`;
    if (!taken.has(spot)) return spot;
  }
  return null;
}

/** Tamu yang saat ini boleh datang, beserta bobot peluangnya. */
export function candidates(state: GameState, ctx: LiveContext, now: number): { def: GuestDef; weight: number }[] {
  const present = new Set(state.visitors.map((v) => v.guestId));
  const out: { def: GuestDef; weight: number }[] = [];
  for (const def of GUESTS) {
    if (present.has(def.id)) continue;
    const left = state.lastLeft[def.id];
    if (left !== undefined && now - left < RETURN_COOLDOWN) continue;
    if (!checkGuest(def, state, ctx, now).ok) continue;
    let weight = RARITY_WEIGHT[def.rarity];
    // Syarat tambahan susah dipenuhi: hadiahi dengan peluang lebih besar.
    if (def.needs) weight *= 2;
    // Tamu yang belum pernah datang sedikit lebih bersemangat.
    if (!state.guests[def.id]) weight *= 1.5;
    out.push({ def, weight });
  }
  return out;
}

export function pickGuest(state: GameState, ctx: LiveContext, now: number, rng: Rng): GuestDef | null {
  if (state.visitors.length >= MAX_VISITORS) return null;
  const list = candidates(state, ctx, now).filter((c) => assignSpot(c.def, state) !== null);
  const total = list.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const c of list) {
    roll -= c.weight;
    if (roll < 0) return c.def;
  }
  return list[list.length - 1].def;
}

export function stayDuration(def: GuestDef, rng: Rng): number {
  const [lo, hi] = def.stay;
  return Math.round((lo + rng() * (hi - lo)) * MINUTE);
}

export function nextGap(rng: Rng): number {
  const [lo, hi] = SPAWN_GAP;
  return Math.round((lo + rng() * (hi - lo)) * MINUTE);
}

/** Koin yang ditinggalkan saat pulang (belum termasuk hadiah hati). */
export function tipFor(def: GuestDef, hearts: number, petted: boolean): number {
  return RARITY_TIP[def.rarity] + hearts * 3 + (petted ? 2 : 0);
}

/** Hadiah sekali saat keakraban naik ke level hati baru. */
export function giftFor(hearts: number): number {
  return 25 * hearts;
}
