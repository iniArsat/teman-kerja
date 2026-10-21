import { describe, expect, it } from "vitest";
import { fits, GUESTS, ITEMS, SLOTS } from "../src/core/data";
import { Game, MAX_AWAY, TAPS_PER_COIN, TODO_REWARDS_PER_DAY } from "../src/core/game";
import { createInitialState, FIRST_SPAWN_MS, migrateState } from "../src/core/state";
import { HOUR, MINUTE } from "../src/core/time";
import { checkGuest, heartsFor, MAX_VISITORS, roomBeauty } from "../src/core/visits";
import type { GameState } from "../src/core/types";

/** Waktu lokal tetap: 20 Oktober 2026, jam tertentu. */
function at(hour: number, minute = 0): number {
  return new Date(2026, 9, 20, hour, minute).getTime();
}

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function newGame(now = at(10), seed = 1): Game {
  return new Game(createInitialState(now), seeded(seed));
}

const ONLINE = { station: null, typing: false, online: true } as const;

/** Jalankan detik demi detik (per 30 detik) seperti aplikasi yang terbuka. */
function advance(g: Game, to: number): void {
  for (let t = g.state.lastSeen + 30_000; t < to; t += 30_000) g.tick(t);
  g.tick(to);
}

describe("state", () => {
  it("state awal: barang awal terpasang dan dimiliki", () => {
    const s = createInitialState(at(10));
    expect(s.owned).toEqual(expect.arrayContaining(["bantal", "jendela", "mug"]));
    expect(s.room.slots["lantai-4"]).toBe("bantal");
    expect(Object.keys(s.room.slots)).toHaveLength(SLOTS.length);
    expect(s.nextSpawnAt).toBe(at(10) + FIRST_SPAWN_MS);
  });

  it("migrasi bolak-balik tidak mengubah state", () => {
    const g = newGame();
    g.state.coins = 9999;
    g.buyItem("timun", at(10));
    g.addTodo("Tugas", at(10));
    const copy = migrateState(JSON.parse(JSON.stringify(g.state)), at(11));
    expect(copy).toEqual({ ...g.state, lastSeen: copy.lastSeen });
  });

  it("migrasi membersihkan data rusak", () => {
    const s = migrateState(
      {
        version: 1,
        coins: -5,
        owned: ["bantal", "palsu", 3],
        room: { slots: { "lantai-1": "timun", "dinding-1": "bantal", "lantai-2": "bantal" }, wall: "tidak-ada" },
        avatar: { hair: "kuncir", skin: "biru" },
        guests: { oyen: { visits: 1 }, constructor: { visits: 9 }, kancil: { visits: 2 } },
        visitors: [
          { guestId: "oyen", spot: "titik:0", arrivedAt: 1, leaveAt: 2 },
          { guestId: "oyen", spot: "titik:1" },
          { guestId: "constructor", spot: "titik:2" },
          { guestId: "kancil", spot: "titik:9" },
          { guestId: "anoa", spot: "titik:3" },
        ],
        todos: [{ id: "a", text: "  " }, { id: "b", text: "ok" }],
        settings: { scale: 7, corner: "atas" },
      },
      at(10),
    );
    expect(s.coins).toBe(0);
    expect(s.owned).not.toContain("palsu");
    expect(s.room.slots["lantai-1"]).toBeNull(); // timun tidak dimiliki
    expect(s.room.slots["dinding-1"]).toBeNull(); // jenis slot salah
    expect(s.room.slots["lantai-2"]).toBe("bantal");
    expect(s.room.wall).toBe("krem");
    expect(s.avatar.hair).toBe("pendek"); // kuncir belum dibeli
    expect(s.avatar.skin).toBe("kulit-2");
    expect(s.visitors.map((v) => v.guestId)).toEqual(["oyen"]);
    expect(Object.keys(s.guests).sort()).toEqual(["kancil", "oyen"]);
    expect(s.todos.map((t) => t.id)).toEqual(["b"]);
    expect(s.settings.scale).toBe(3);
    expect(s.settings.corner).toBe("kanan");
  });

  it("menolak data yang bukan simpanan", () => {
    expect(() => migrateState({ coins: 1 }, at(10))).toThrow();
  });
});

describe("tamu", () => {
  it("tamu pertama: Oyen datang ke bantal", () => {
    const g = newGame();
    const arrivals: string[] = [];
    g.on("arrive", (e) => arrivals.push(e.visit.guestId + (e.first ? "!" : "")));
    g.tick(g.state.nextSpawnAt);
    expect(arrivals).toEqual(["oyen!"]);
    expect(g.state.visitors[0].spot).toBe("slot:lantai-4");
    expect(g.state.guests.oyen.visits).toBe(1);
  });

  it("tamu malam hanya datang malam hari", () => {
    const g = newGame(at(12));
    g.state.owned.push("mesin-kopi");
    g.state.room.slots["lantai-1"] = "mesin-kopi";
    const luwak = GUESTS.find((x) => x.id === "luwak")!;
    expect(checkGuest(luwak, g.state, ONLINE, at(12)).ok).toBe(false);
    expect(checkGuest(luwak, g.state, ONLINE, at(22)).ok).toBe(true);
    expect(checkGuest(luwak, g.state, ONLINE, at(3)).ok).toBe(true);
  });

  it("syarat radio, fokus, dan keindahan", () => {
    const g = newGame(at(12));
    const s = g.state;
    s.owned.push("radio", "pakis", "lampu-hangat");
    s.room.slots["lantai-1"] = "radio";
    s.room.slots["lantai-2"] = "pakis";
    s.room.slots["lantai-3"] = "lampu-hangat";
    const find = (id: string) => GUESTS.find((x) => x.id === id)!;
    expect(checkGuest(find("jalak"), s, ONLINE, at(12)).ok).toBe(false);
    expect(checkGuest(find("jalak"), s, { ...ONLINE, station: "lofi" }, at(12)).ok).toBe(true);
    expect(checkGuest(find("katak"), s, { ...ONLINE, station: "lofi" }, at(12)).ok).toBe(false);
    expect(checkGuest(find("katak"), s, { ...ONLINE, station: "hujan" }, at(12)).ok).toBe(true);
    expect(checkGuest(find("komodo"), s, ONLINE, at(12)).reason).toBe("fokus");
    s.focus.today = 3;
    s.focus.todayDate = "2026-10-20";
    expect(checkGuest(find("komodo"), s, ONLINE, at(12)).ok).toBe(true);
    // Hari berganti: sesi kemarin tidak dihitung.
    expect(checkGuest(find("komodo"), s, ONLINE, at(12) + 24 * HOUR).ok).toBe(false);
    expect(checkGuest(find("cendrawasih"), s, { ...ONLINE, station: "gamelan" }, at(12)).reason).toBe("keindahan");
  });

  it("keindahan maksimal (dengan aturan slot) cukup untuk Cendrawasih", () => {
    const s = createInitialState(at(12));
    s.owned = ITEMS.map((i) => i.id);
    const used = new Set<string>();
    // Isi slot kecil dulu agar barang tinggi tersisa untuk slot besar.
    const order = [...SLOTS].sort((a, b) => Number(!!b.small) - Number(!!a.small));
    for (const slot of order) {
      const best = ITEMS.filter((i) => !used.has(i.id) && fits(i.id, slot.id)).sort((a, b) => b.beauty - a.beauty)[0];
      if (best) {
        s.room.slots[slot.id] = best.id;
        used.add(best.id);
      }
    }
    s.room.wall = "kawung";
    s.room.floor = "teraso";
    const g = new Game(s);
    expect(g.placeItem("lantai-5", "rak-buku", at(12))).toBe(false);
    expect(roomBeauty(s)).toBeGreaterThanOrEqual(GUESTS.find((x) => x.id === "cendrawasih")!.needs!.beauty! + 15);
  });

  it("tamu pulang meninggalkan koin, hadiah saat hati baru", () => {
    const g = newGame();
    g.tick(g.state.nextSpawnAt);
    const visit = g.state.visitors[0];
    const res = g.pet("oyen");
    expect(res).toMatchObject({ rewarded: true, hearts: 1, heartUp: true });
    expect(g.pet("oyen")).toMatchObject({ rewarded: false, hearts: 1 });
    const coins = g.state.coins;
    let left: { tip: number; gift: number } | null = null;
    g.on("leave", (e) => (left = e));
    g.state.nextSpawnAt = visit.leaveAt + HOUR;
    advance(g, visit.leaveAt);
    expect(g.state.visitors).toHaveLength(0);
    expect(left).not.toBeNull();
    expect(left!.tip).toBeGreaterThan(0);
    expect(left!.gift).toBe(25);
    expect(g.state.coins).toBe(coins + left!.tip + left!.gift);
    expect(g.state.guests.oyen.giftedHearts).toBe(1);
  });

  it("tidak lebih dari tiga tamu dan tidak ada tamu ganda", () => {
    const g = newGame(at(12));
    const s = g.state;
    s.owned = ITEMS.map((i) => i.id);
    Object.assign(s.room.slots, { "lantai-1": "wortel", "lantai-2": "timun", "lantai-3": "terarium", "lantai-5": "ayunan", karpet: "karpet-rumput" });
    for (let i = 0; i < 40; i++) g.tick(s.nextSpawnAt);
    expect(s.visitors.length).toBeLessThanOrEqual(MAX_VISITORS);
    expect(new Set(s.visitors.map((v) => v.guestId)).size).toBe(s.visitors.length);
    expect(new Set(s.visitors.map((v) => v.spot)).size).toBe(s.visitors.length);
  });

  it("barang dilepas: tamu pindah ke titik lantai", () => {
    const g = newGame();
    g.tick(g.state.nextSpawnAt);
    expect(g.state.visitors[0].spot).toBe("slot:lantai-4");
    g.placeItem("lantai-4", null, at(10, 5));
    expect(g.state.visitors[0].spot).toMatch(/^titik:/);
  });

  it("tingkat hati", () => {
    expect([0, 1, 2, 3, 6, 9, 10, 15, 99].map(heartsFor)).toEqual([0, 1, 1, 2, 3, 3, 4, 5, 5]);
  });
});

describe("toko dan kamar", () => {
  it("membeli barang memasangnya di slot kosong", () => {
    const g = newGame();
    g.state.coins = 1000;
    const res = g.buyItem("timun", at(10));
    expect(res).toEqual({ ok: true, slot: "lantai-1" });
    expect(g.state.coins).toBe(850);
    expect(g.buyItem("timun", at(10))).toEqual({ ok: false, reason: "dimiliki" });
    expect(g.buyItem("akuarium", at(10))).toEqual({ ok: false, reason: "uang" });
  });

  it("memindah barang mengosongkan slot lama dan menolak slot salah jenis", () => {
    const g = newGame();
    expect(g.placeItem("lantai-1", "bantal", at(10))).toBe(true);
    expect(g.state.room.slots["lantai-4"]).toBeNull();
    expect(g.state.room.slots["lantai-1"]).toBe("bantal");
    expect(g.placeItem("dinding-1", "bantal", at(10))).toBe(false);
    expect(g.placeItem("lantai-2", "akuarium", at(10))).toBe(false);
  });

  it("tema dan kosmetik", () => {
    const g = newGame();
    g.state.coins = 2000;
    expect(g.buyTheme("bata").ok).toBe(true);
    expect(g.state.room.wall).toBe("bata");
    expect(g.setTheme("kawung")).toBe(false);
    expect(g.buyCosmetic("hoodie").ok).toBe(true);
    expect(g.state.avatar.top).toBe("hoodie");
    expect(g.equipCosmetic("batik")).toBe(false);
    expect(g.setAvatarColor("skin", "kulit-5")).toBe(true);
    expect(g.setAvatarColor("skin", "ungu")).toBe(false);
  });
});

describe("ketikan, tugas, fokus", () => {
  it("setiap 25 ketukan menjadi 1 koin", () => {
    const g = newGame();
    const coins = g.state.coins;
    expect(g.addTaps(TAPS_PER_COIN - 1, at(10))).toBe(0);
    expect(g.addTaps(2, at(10))).toBe(1);
    expect(g.state.coins).toBe(coins + 1);
    expect(g.state.typing.today).toBe(TAPS_PER_COIN + 1);
    // Hari berikutnya mulai dari nol, total tetap.
    g.addTaps(5, at(10) + 24 * HOUR);
    expect(g.state.typing.today).toBe(5);
    expect(g.state.typing.total).toBe(TAPS_PER_COIN + 6);
    expect(g.state.typing.best).toBe(TAPS_PER_COIN + 1);
  });

  it("tugas selesai memberi koin sekali, dengan batas harian", () => {
    const g = newGame();
    for (let i = 0; i < TODO_REWARDS_PER_DAY + 2; i++) g.addTodo(`tugas ${i}`, at(10));
    const id = g.state.todos[0].id;
    expect(g.toggleTodo(id, at(10))).toBe(5);
    expect(g.toggleTodo(id, at(10))).toBe(0);
    expect(g.toggleTodo(id, at(10))).toBe(0);
    let total = 5;
    for (const t of g.state.todos.slice(1)) total += g.toggleTodo(t.id, at(10));
    expect(total).toBe(TODO_REWARDS_PER_DAY * 5);
    expect(g.addTodo("   ", at(10))).toBe(false);
    expect(g.clearDoneTodos()).toBe(TODO_REWARDS_PER_DAY + 2);
  });

  it("sesi fokus: selesai, istirahat, lalu siap", () => {
    const g = newGame();
    const events: string[] = [];
    g.on("focusDone", (e) => events.push(`selesai:${e.coins}`));
    g.on("breakDone", () => events.push("istirahat-selesai"));
    g.state.nextSpawnAt = at(23);
    g.startFocus(at(10));
    advance(g, at(10, 24));
    expect(g.state.focus.phase).toBe("fokus");
    g.pauseFocus(at(10, 24));
    advance(g, at(11));
    expect(g.state.focus.phase).toBe("fokus");
    g.resumeFocus(at(11));
    advance(g, at(11, 1));
    expect(events).toEqual(["selesai:40"]);
    expect(g.state.focus.phase).toBe("istirahat");
    advance(g, at(11, 6));
    expect(events).toEqual(["selesai:40", "istirahat-selesai"]);
    expect(g.state.focus.phase).toBe("siap");
    expect(g.state.focus.today).toBe(1);
  });
});

describe("saat aplikasi tertutup", () => {
  it("tamu datang dan pergi, koin terkumpul", () => {
    const g = newGame(at(9));
    g.state.lastSeen = at(9);
    const report = g.catchUp(at(13));
    expect(report).not.toBeNull();
    expect(report!.visits).toBeGreaterThan(3);
    expect(report!.coins).toBeGreaterThan(0);
    expect(report!.newGuests).toEqual(["oyen"]);
    expect(g.state.lastSeen).toBe(at(13));
  });

  it("dibatasi 12 jam dan tidak memakai syarat radio", () => {
    const g = newGame(at(9));
    const s: GameState = g.state;
    s.owned.push("radio");
    s.room.slots["lantai-1"] = "radio";
    s.radio.station = "lofi";
    s.lastSeen = at(9) - 5 * 24 * HOUR;
    s.nextSpawnAt = s.lastSeen + MINUTE;
    const report = g.catchUp(at(9))!;
    expect(report.newGuests).not.toContain("jalak");
    // Paling banyak satu kedatangan per 3 menit selama 12 jam.
    expect(report.visits).toBeLessThanOrEqual(MAX_AWAY / (3 * MINUTE) + 1);
  });

  it("komputer tidur saat aplikasi terbuka: dijalankan seperti tertutup", () => {
    const g = newGame(at(9));
    g.state.owned.push("radio");
    g.state.room.slots["lantai-1"] = "radio";
    g.state.radio.station = "lofi";
    let events = 0;
    g.on("arrive", () => events++);
    g.tick(at(9));
    const res = g.tick(at(9) + 60 * HOUR);
    expect(res.caughtUp).toBe(true);
    expect(res.report!.newGuests).not.toContain("jalak");
    expect(events).toBe(0);
    expect(res.report!.coins).toBeLessThan(3000);
  });

  it("jam mundur: waktu masa depan dibatasi", () => {
    const g = newGame(at(9));
    g.tick(at(9) + 40_000);
    const v = g.state.visitors[0];
    v.leaveAt = at(9) + 365 * 24 * HOUR;
    g.state.nextSpawnAt = at(9) + 365 * 24 * HOUR;
    g.state.lastSeen = at(9) + 300 * 24 * HOUR;
    g.tick(at(9) + 60_000);
    expect(v.leaveAt).toBeLessThanOrEqual(at(9) + 60_000 + 40 * MINUTE);
    expect(g.state.nextSpawnAt).toBeLessThanOrEqual(at(9) + 60_000 + 8 * MINUTE);
  });

  it("koin tidak pernah menjadi NaN", () => {
    const g = newGame(at(9));
    (g as unknown as { addCoins: (n: number, s: string) => void }).addCoins(NaN, "tamu");
    expect(g.state.coins).toBe(150);
  });

  it("jeda singkat tidak menghasilkan laporan", () => {
    const g = newGame(at(9));
    expect(g.catchUp(at(9) + 30_000)).toBeNull();
  });
});
