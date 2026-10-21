// Mesin permainan: memegang state, menjalankan aturan, dan mengabarkan perubahan
// lewat event. Tidak menyentuh DOM, jadi seluruhnya bisa diuji di Node.

import { COSMETIC_BY_ID, fits, GUEST_BY_ID, HAIR_COLORS, ITEM_BY_ID, SKINS, SLOT_BY_ID, THEME_BY_ID, TOP_COLORS } from "./data";
import { MAX_MEMO_LENGTH, MAX_TODO_LENGTH, MAX_TODOS, sanitizeTimes } from "./state";
import { HOUR, MINUTE, dateKey } from "./time";
import type { AvatarState, AwayReport, FocusPhase, GameState, LiveContext, Settings, StationId, Visit } from "./types";
import {
  assignSpot,
  giftFor,
  heartsFor,
  nextGap,
  pickGuest,
  RETRY_GAP,
  stayDuration,
  tipFor,
  type Rng,
} from "./visits";

/** Ketukan keyboard per koin. */
export const TAPS_PER_COIN = 25;
/** Koin per menit fokus yang selesai. */
export const FOCUS_COINS_PER_MIN = 1.6;
export const TODO_COINS = 5;
export const TODO_REWARDS_PER_DAY = 10;
/** Pemain dianggap sedang mengetik bila ada ketukan dalam rentang ini. */
export const TYPING_WINDOW = MINUTE;
/** Simulasi saat aplikasi tertutup paling lama sejauh ini ke belakang. */
export const MAX_AWAY = 12 * HOUR;
/** Jeda detik lebih panjang dari ini (komputer tidur, jendela dibekukan) diperlakukan seperti aplikasi tertutup. */
export const SLEEP_GAP = 2 * MINUTE;

export interface TickResult {
  /** Jeda panjang dijalankan sebagai simulasi "selama kamu pergi". */
  caughtUp: boolean;
  report: AwayReport | null;
}

export type CoinSource = "ketik" | "tamu" | "hadiah" | "fokus" | "tugas" | "elus" | "belanja";

export interface GameEvents {
  coins: { amount: number; total: number; source: CoinSource };
  arrive: { visit: Visit; first: boolean };
  leave: { visit: Visit; tip: number; gift: number; early: boolean };
  pet: { guestId: string; hearts: number; heartUp: boolean; rewarded: boolean };
  room: undefined;
  avatar: undefined;
  owned: undefined;
  taps: { count: number; today: number };
  focus: { phase: FocusPhase };
  focusDone: { coins: number; today: number };
  breakDone: undefined;
  todos: undefined;
  memo: undefined;
  radio: undefined;
  settings: undefined;
  typing: undefined;
}

type Listener<T> = (payload: T) => void;

export type BuyResult = { ok: true; slot: string | null } | { ok: false; reason: "uang" | "dimiliki" | "tidak-ada" };

export class Game {
  private listeners: { [K in keyof GameEvents]?: Listener<GameEvents[K]>[] } = {};
  private silent = false;
  private lastTapAt = -Infinity;
  private todoCounter = 0;

  constructor(
    public state: GameState,
    private rng: Rng = Math.random,
  ) {
    // Simpanan lama: tamu yang barang kesukaannya sudah tidak ada pindah tempat.
    this.relocateGuests(state.lastSeen);
  }

  // -------------------------------------------------------------------------
  // Event

  on<K extends keyof GameEvents>(event: K, cb: Listener<GameEvents[K]>): () => void {
    const list = (this.listeners[event] ??= []) as Listener<GameEvents[K]>[];
    list.push(cb);
    return () => {
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    };
  }

  private emit<K extends keyof GameEvents>(event: K, ...payload: GameEvents[K] extends undefined ? [] : [GameEvents[K]]): void {
    if (this.silent) return;
    const list = this.listeners[event] as Listener<GameEvents[K]>[] | undefined;
    if (!list) return;
    for (const cb of [...list]) {
      try {
        cb(payload[0] as GameEvents[K]);
      } catch (err) {
        console.error(`Pendengar event ${event} gagal`, err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Waktu

  /** Keadaan sesaat yang memengaruhi tamu. */
  liveContext(now: number): LiveContext {
    return {
      station: this.state.radio.station,
      typing: now - this.lastTapAt < TYPING_WINDOW,
      online: true,
    };
  }

  /**
   * Dipanggil kira-kira tiap detik selama aplikasi terbuka. Jeda yang panjang
   * (komputer tidur) dijalankan seperti saat aplikasi tertutup.
   */
  tick(now: number): TickResult {
    if (now < this.state.lastSeen - MINUTE) {
      // Jam komputer mundur: batasi waktu yang kini terlalu jauh di depan.
      sanitizeTimes(this.state, now);
    }
    if (now - this.state.lastSeen > SLEEP_GAP) return { caughtUp: true, report: this.catchUp(now) };
    this.step(now);
    return { caughtUp: false, report: null };
  }

  private step(now: number): void {
    this.rollDay(now);
    this.updateFocus(now);
    this.advanceVisits(now, this.liveContext(now));
    this.state.lastSeen = now;
  }

  /**
   * Jalankan apa yang terjadi selama aplikasi tertutup: tamu datang dan pergi,
   * koin yang mereka tinggalkan, dan sesi fokus yang selesai. Mengembalikan
   * ringkasan bila ada yang terjadi.
   */
  catchUp(now: number): AwayReport | null {
    const from = Math.min(this.state.lastSeen, now);
    const elapsed = now - from;
    if (elapsed < MINUTE) {
      this.step(now);
      return null;
    }
    const start = Math.max(from, now - MAX_AWAY);
    if (this.state.nextSpawnAt < start) this.state.nextSpawnAt = start;

    const report: AwayReport = { minutes: Math.floor(elapsed / MINUTE), visits: 0, coins: 0, newGuests: [] };
    const coinsBefore = this.state.coins;
    this.silent = true;
    try {
      this.rollDay(now);
      this.updateFocus(now);
      this.advanceVisits(now, { station: null, typing: false, online: false }, report);
    } finally {
      this.silent = false;
    }
    this.state.lastSeen = now;
    report.coins = this.state.coins - coinsBefore;
    // Kabari tampilan bahwa banyak hal bisa berubah sekaligus.
    this.emit("coins", { amount: 0, total: this.state.coins, source: "tamu" });
    this.emit("focus", { phase: this.state.focus.phase });
    return report.visits > 0 || report.coins > 0 ? report : null;
  }

  private rollDay(now: number): void {
    const key = dateKey(now);
    const t = this.state.typing;
    if (t.todayDate !== key) {
      t.today = 0;
      t.todayDate = key;
    }
    const f = this.state.focus;
    if (f.todayDate !== key) {
      f.today = 0;
      f.todayDate = key;
    }
    const s = this.state.stats;
    if (s.tasksRewardDate !== key) {
      s.tasksRewardedToday = 0;
      s.tasksRewardDate = key;
    }
  }

  // -------------------------------------------------------------------------
  // Koin

  private addCoins(amount: number, source: CoinSource): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.state.coins += amount;
    this.state.stats.coinsEarned += amount;
    this.emit("coins", { amount, total: this.state.coins, source });
  }

  private spend(amount: number): boolean {
    if (this.state.coins < amount) return false;
    this.state.coins -= amount;
    this.emit("coins", { amount: -amount, total: this.state.coins, source: "belanja" });
    return true;
  }

  // -------------------------------------------------------------------------
  // Mengetik

  /** Tambah ketukan keyboard. Mengembalikan koin yang didapat. */
  addTaps(count: number, now: number): number {
    if (!Number.isFinite(count) || count <= 0) return 0;
    const n = Math.min(Math.floor(count), 500);
    this.rollDay(now);
    this.lastTapAt = now;
    const t = this.state.typing;
    t.today += n;
    t.total += n;
    t.best = Math.max(t.best, t.today);
    t.carry += n;
    const coins = Math.floor(t.carry / TAPS_PER_COIN);
    t.carry -= coins * TAPS_PER_COIN;
    this.emit("taps", { count: n, today: t.today });
    this.addCoins(coins, "ketik");
    return coins;
  }

  isTyping(now: number): boolean {
    return now - this.lastTapAt < 1500;
  }

  setTypingEnabled(enabled: boolean): void {
    this.state.typing.enabled = enabled;
    this.state.typing.asked = true;
    this.emit("typing");
  }

  // -------------------------------------------------------------------------
  // Tamu

  private advanceVisits(until: number, ctx: LiveContext, report?: AwayReport): void {
    for (let guard = 0; guard < 2000; guard++) {
      let leaving: Visit | null = null;
      for (const v of this.state.visitors) if (!leaving || v.leaveAt < leaving.leaveAt) leaving = v;
      const spawnAt = this.state.nextSpawnAt;
      if (leaving && leaving.leaveAt <= until && leaving.leaveAt <= spawnAt) {
        this.leave(leaving, leaving.leaveAt, false);
        continue;
      }
      if (spawnAt > until) break;
      this.spawn(spawnAt, ctx, report);
    }
  }

  private spawn(at: number, ctx: LiveContext, report?: AwayReport): void {
    const def = pickGuest(this.state, ctx, at, this.rng);
    const spot = def ? assignSpot(def, this.state) : null;
    if (!def || !spot) {
      this.state.nextSpawnAt = at + RETRY_GAP;
      return;
    }
    const visit: Visit = { guestId: def.id, arrivedAt: at, leaveAt: at + stayDuration(def, this.rng), spot, petted: false };
    this.state.visitors.push(visit);
    const record = this.state.guests[def.id];
    const first = !record;
    if (record) {
      record.visits++;
      record.lastSeen = at;
    } else {
      this.state.guests[def.id] = { visits: 1, firstSeen: at, lastSeen: at, affection: 0, giftedHearts: 0 };
    }
    this.state.stats.visits++;
    this.state.nextSpawnAt = at + nextGap(this.rng);
    if (report) {
      report.visits++;
      if (first) report.newGuests.push(def.id);
    }
    this.emit("arrive", { visit, first });
  }

  private leave(visit: Visit, at: number, early: boolean): void {
    const i = this.state.visitors.indexOf(visit);
    if (i < 0) return;
    this.state.visitors.splice(i, 1);
    const def = GUEST_BY_ID[visit.guestId];
    const record = this.state.guests[visit.guestId];
    let tip = 0;
    let gift = 0;
    if (def && record) {
      const hearts = heartsFor(record.affection);
      tip = tipFor(def, hearts, visit.petted);
      if (hearts > record.giftedHearts) {
        for (let h = record.giftedHearts + 1; h <= hearts; h++) gift += giftFor(h);
        record.giftedHearts = hearts;
      }
      record.lastSeen = at;
    }
    this.state.lastLeft[visit.guestId] = at;
    this.emit("leave", { visit, tip, gift, early });
    this.addCoins(tip, "tamu");
    this.addCoins(gift, "hadiah");
  }

  /** Elus tamu. Hanya elusan pertama tiap kunjungan menambah keakraban. */
  pet(guestId: string): GameEvents["pet"] | null {
    const visit = this.state.visitors.find((v) => v.guestId === guestId);
    const record = this.state.guests[guestId];
    if (!visit || !record) return null;
    const before = heartsFor(record.affection);
    let rewarded = false;
    if (!visit.petted) {
      visit.petted = true;
      record.affection++;
      this.state.stats.pets++;
      rewarded = true;
    }
    const hearts = heartsFor(record.affection);
    const result = { guestId, hearts, heartUp: hearts > before, rewarded };
    this.emit("pet", result);
    if (rewarded) this.addCoins(1, "elus");
    return result;
  }

  /** Setelah kamar berubah: tamu yang barang kesukaannya hilang pindah tempat, atau pulang. */
  private relocateGuests(now: number): void {
    for (const visit of [...this.state.visitors]) {
      if (!visit.spot.startsWith("slot:")) continue;
      const def = GUEST_BY_ID[visit.guestId];
      const item = this.state.room.slots[visit.spot.slice(5)];
      if (def && item && def.likes.includes(item)) continue;
      const others = this.state.visitors.filter((v) => v !== visit);
      const spot = def ? assignSpot(def, this.state, others) : null;
      if (spot) visit.spot = spot;
      else this.leave(visit, now, true);
    }
  }

  // -------------------------------------------------------------------------
  // Toko dan kamar

  buyItem(id: string, now: number): BuyResult {
    const item = ITEM_BY_ID[id];
    if (!item) return { ok: false, reason: "tidak-ada" };
    if (this.state.owned.includes(id)) return { ok: false, reason: "dimiliki" };
    if (!this.spend(item.price)) return { ok: false, reason: "uang" };
    this.state.owned.push(id);
    this.emit("owned");
    const free = Object.entries(this.state.room.slots).find(([slotId, v]) => !v && fits(id, slotId));
    if (free) {
      this.placeItem(free[0], id, now);
      return { ok: true, slot: free[0] };
    }
    return { ok: true, slot: null };
  }

  /** Pasang barang di slot (null = kosongkan). Barang yang sudah terpasang di slot lain dipindah. */
  placeItem(slotId: string, itemId: string | null, now: number): boolean {
    const slot = SLOT_BY_ID[slotId];
    if (!slot) return false;
    if (itemId !== null) {
      if (!fits(itemId, slotId) || !this.state.owned.includes(itemId)) return false;
      for (const [other, v] of Object.entries(this.state.room.slots)) {
        if (v === itemId && other !== slotId) this.state.room.slots[other] = null;
      }
    }
    this.state.room.slots[slotId] = itemId;
    this.relocateGuests(now);
    this.emit("room");
    return true;
  }

  /** Slot tempat barang terpasang, atau null bila disimpan. */
  slotOf(itemId: string): string | null {
    for (const [slotId, v] of Object.entries(this.state.room.slots)) if (v === itemId) return slotId;
    return null;
  }

  buyTheme(id: string): BuyResult {
    const theme = THEME_BY_ID[id];
    if (!theme) return { ok: false, reason: "tidak-ada" };
    if (this.state.ownedThemes.includes(id)) return { ok: false, reason: "dimiliki" };
    if (!this.spend(theme.price)) return { ok: false, reason: "uang" };
    this.state.ownedThemes.push(id);
    this.emit("owned");
    this.setTheme(id);
    return { ok: true, slot: null };
  }

  setTheme(id: string): boolean {
    const theme = THEME_BY_ID[id];
    if (!theme || !this.state.ownedThemes.includes(id)) return false;
    if (theme.part === "dinding") this.state.room.wall = id;
    else this.state.room.floor = id;
    this.emit("room");
    return true;
  }

  buyCosmetic(id: string): BuyResult {
    const def = COSMETIC_BY_ID[id];
    if (!def) return { ok: false, reason: "tidak-ada" };
    if (this.state.ownedCosmetics.includes(id)) return { ok: false, reason: "dimiliki" };
    if (!this.spend(def.price)) return { ok: false, reason: "uang" };
    this.state.ownedCosmetics.push(id);
    this.emit("owned");
    this.equipCosmetic(id);
    return { ok: true, slot: null };
  }

  equipCosmetic(id: string): boolean {
    const def = COSMETIC_BY_ID[id];
    if (!def || !this.state.ownedCosmetics.includes(id)) return false;
    const a = this.state.avatar;
    if (def.slot === "rambut") a.hair = id;
    else if (def.slot === "atasan") a.top = id;
    else a.accessory = id;
    this.emit("avatar");
    return true;
  }

  /** Ganti warna avatar (gratis). */
  setAvatarColor(part: "skin" | "hairColor" | "topColor", id: string): boolean {
    const list = part === "skin" ? SKINS : part === "hairColor" ? HAIR_COLORS : TOP_COLORS;
    if (!list.some((c) => c.id === id)) return false;
    (this.state.avatar as AvatarState)[part] = id;
    this.emit("avatar");
    return true;
  }

  // -------------------------------------------------------------------------
  // Daftar tugas dan memo

  addTodo(text: string, now: number): boolean {
    const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TODO_LENGTH);
    if (!clean || this.state.todos.length >= MAX_TODOS) return false;
    const id = `t${now.toString(36)}${(this.todoCounter++).toString(36)}`;
    this.state.todos.push({ id, text: clean, done: false, createdAt: now });
    this.emit("todos");
    return true;
  }

  /** Centang/batal centang. Mengembalikan koin yang didapat. */
  toggleTodo(id: string, now: number): number {
    const todo = this.state.todos.find((t) => t.id === id);
    if (!todo) return 0;
    this.rollDay(now);
    todo.done = !todo.done;
    let coins = 0;
    if (todo.done) {
      todo.doneAt = now;
      if (!todo.rewarded) {
        todo.rewarded = true;
        this.state.stats.tasksDone++;
        if (this.state.stats.tasksRewardedToday < TODO_REWARDS_PER_DAY) {
          this.state.stats.tasksRewardedToday++;
          coins = TODO_COINS;
        }
      }
    } else {
      todo.doneAt = undefined;
    }
    this.emit("todos");
    this.addCoins(coins, "tugas");
    return coins;
  }

  editTodo(id: string, text: string): boolean {
    const todo = this.state.todos.find((t) => t.id === id);
    const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TODO_LENGTH);
    if (!todo || !clean) return false;
    todo.text = clean;
    this.emit("todos");
    return true;
  }

  removeTodo(id: string): void {
    const before = this.state.todos.length;
    this.state.todos = this.state.todos.filter((t) => t.id !== id);
    if (this.state.todos.length !== before) this.emit("todos");
  }

  clearDoneTodos(): number {
    const before = this.state.todos.length;
    this.state.todos = this.state.todos.filter((t) => !t.done);
    const removed = before - this.state.todos.length;
    if (removed) this.emit("todos");
    return removed;
  }

  setMemo(text: string): void {
    this.state.memo = text.slice(0, MAX_MEMO_LENGTH);
    this.emit("memo");
  }

  // -------------------------------------------------------------------------
  // Fokus (Pomodoro)

  private updateFocus(now: number): void {
    const f = this.state.focus;
    for (let guard = 0; guard < 4; guard++) {
      if (f.endsAt === null || now < f.endsAt) return;
      const endedAt = f.endsAt;
      if (f.phase === "fokus") {
        const coins = Math.round(f.focusMin * FOCUS_COINS_PER_MIN);
        f.sessions++;
        f.totalMin += f.focusMin;
        if (dateKey(endedAt) === f.todayDate) f.today++;
        f.phase = "istirahat";
        f.endsAt = endedAt + f.breakMin * MINUTE;
        this.emit("focusDone", { coins, today: f.today });
        this.addCoins(coins, "fokus");
        this.emit("focus", { phase: f.phase });
      } else if (f.phase === "istirahat") {
        f.phase = "siap";
        f.endsAt = null;
        this.emit("breakDone");
        this.emit("focus", { phase: f.phase });
      } else {
        f.endsAt = null;
        return;
      }
    }
  }

  startFocus(now: number): void {
    const f = this.state.focus;
    if (f.phase === "fokus") return;
    f.phase = "fokus";
    f.endsAt = now + f.focusMin * MINUTE;
    f.pausedLeft = null;
    this.emit("focus", { phase: f.phase });
  }

  pauseFocus(now: number): void {
    const f = this.state.focus;
    if (f.phase === "siap" || f.endsAt === null) return;
    f.pausedLeft = Math.max(0, f.endsAt - now);
    f.endsAt = null;
    this.emit("focus", { phase: f.phase });
  }

  resumeFocus(now: number): void {
    const f = this.state.focus;
    if (f.phase === "siap" || f.pausedLeft === null) return;
    f.endsAt = now + f.pausedLeft;
    f.pausedLeft = null;
    this.emit("focus", { phase: f.phase });
  }

  stopFocus(): void {
    const f = this.state.focus;
    f.phase = "siap";
    f.endsAt = null;
    f.pausedLeft = null;
    this.emit("focus", { phase: f.phase });
  }

  setFocusLengths(focusMin: number, breakMin: number): void {
    const f = this.state.focus;
    f.focusMin = Math.round(Math.min(90, Math.max(5, focusMin)));
    f.breakMin = Math.round(Math.min(30, Math.max(1, breakMin)));
    this.emit("focus", { phase: f.phase });
  }

  /** Sisa waktu fase sekarang (ms). Saat siap: panjang sesi fokus. */
  focusRemaining(now: number): number {
    const f = this.state.focus;
    if (f.endsAt !== null) return Math.max(0, f.endsAt - now);
    if (f.pausedLeft !== null) return f.pausedLeft;
    return f.focusMin * MINUTE;
  }

  focusPaused(): boolean {
    const f = this.state.focus;
    return f.phase !== "siap" && f.endsAt === null;
  }

  // -------------------------------------------------------------------------
  // Radio dan pengaturan

  setStation(station: StationId | null): void {
    this.state.radio.station = station;
    this.emit("radio");
  }

  setRadioVolume(volume: number): void {
    this.state.radio.volume = Math.min(1, Math.max(0, volume));
    this.emit("radio");
  }

  updateSettings(patch: Partial<Settings>): void {
    const s = this.state.settings;
    if (patch.sound !== undefined) s.sound = patch.sound;
    if (patch.volume !== undefined) s.volume = Math.min(1, Math.max(0, patch.volume));
    if (patch.corner === "kanan" || patch.corner === "kiri") s.corner = patch.corner;
    if (patch.scale === 2 || patch.scale === 3 || patch.scale === 4) s.scale = patch.scale;
    if (patch.notify !== undefined) s.notify = patch.notify;
    if (patch.cheers !== undefined) s.cheers = patch.cheers;
    this.emit("settings");
  }

  markShopSeen(): void {
    this.state.seenShop = true;
  }
}
