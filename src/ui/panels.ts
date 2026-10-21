// Isi panel: toko, kamar, gaya avatar, buku tamu, tugas, memo, fokus, musik, pengaturan.
// Setiap fungsi mengembalikan elemen baru; UI menggantinya saat data berubah.

import {
  COSMETICS,
  fits,
  GUESTS,
  GUEST_BY_ID,
  HAIR_COLORS,
  ITEMS,
  ITEM_BY_ID,
  RARITY_NAME,
  SKINS,
  SLOT_KIND_NAME,
  SLOTS,
  STATIONS,
  THEMES,
  TOP_COLORS,
} from "../core/data";
import type { Game } from "../core/game";
import { TODO_COINS, TODO_REWARDS_PER_DAY } from "../core/game";
import { formatClock, formatNumber, formatShort } from "../core/time";
import type { ColorDef, CosmeticSlot, SlotKind, StationId } from "../core/types";
import { heartsFor, roomBeauty } from "../core/visits";
import { h } from "./dom";
import { icon } from "./icons";
import { animalUrl, avatarUrl, itemUrl, silhouetteUrl, themeUrl } from "./images";
import type { SoundId } from "./sound";

/** Penjelasan bila penghitung sistem belum aktif. */
export let TYPING_HELP = "Di sistem ini avatar hanya ikut mengetik saat jendela Teman Kerja aktif.";

export function setTypingHelp(text: string): void {
  TYPING_HELP = text;
}

export type PanelId = "toko" | "kamar" | "gaya" | "buku" | "tugas" | "memo" | "fokus" | "musik" | "atur";

export const PANEL_TITLES: Record<PanelId, string> = {
  toko: "Toko",
  kamar: "Atur Kamar",
  gaya: "Gaya",
  buku: "Buku Tamu",
  tugas: "Daftar Tugas",
  memo: "Memo",
  fokus: "Fokus",
  musik: "Radio",
  atur: "Pengaturan",
};

export interface PanelContext {
  game: Game;
  rerender: () => void;
  toast: (text: string, ms?: number) => void;
  sound: (id: SoundId) => void;
  /** Keadaan per panel yang bertahan saat panel digambar ulang. */
  view: {
    shopTab: "barang" | "tema";
    shopFilter: SlotKind | "semua";
    guest: string | null;
  };
  actions: {
    setCorner: (corner: "kanan" | "kiri") => void;
    setScale: (scale: 2 | 3 | 4) => void;
    setTyping: (enabled: boolean) => void;
    playStation: (id: StationId | null) => void;
    hide: () => void;
    quit: () => void;
    typingSupported: () => boolean;
    /** null = tidak tersedia (mode browser). */
    autostart: () => boolean | null;
    setAutostart: (enabled: boolean) => void;
  };
}

function coinTag(n: number): HTMLElement {
  return h("span", { class: "price" }, icon("koin", 2, "icon-inline"), formatShort(n));
}

function chips<T extends string>(options: { id: T; label: string }[], active: T, onPick: (id: T) => void): HTMLElement {
  return h(
    "div",
    { class: "chips" },
    options.map((o) =>
      h("button", { class: `chip${o.id === active ? " active" : ""}`, onclick: () => onPick(o.id) }, o.label),
    ),
  );
}

function section(title: string, ...children: (Node | string | null | false)[]): HTMLElement {
  return h("div", { class: "section" }, h("div", { class: "section-title" }, title), ...children);
}

/** Barang ini disukai tamu (ditampilkan sebagai petunjuk kecil di toko). */
function attracts(itemId: string): boolean {
  return GUESTS.some((g) => g.likes.includes(itemId));
}

// ---------------------------------------------------------------------------
// Toko

export function shopPanel(ctx: PanelContext): HTMLElement {
  const { game, view } = ctx;
  const s = game.state;
  const body = h("div", { class: "panel-body" });
  body.append(
    chips(
      [
        { id: "barang", label: "Barang" },
        { id: "tema", label: "Dinding & Lantai" },
      ],
      view.shopTab,
      (id) => {
        view.shopTab = id;
        ctx.rerender();
      },
    ),
  );

  if (view.shopTab === "barang") {
    body.append(
      chips(
        [
          { id: "semua", label: "Semua" },
          { id: "lantai", label: "Lantai" },
          { id: "dinding", label: "Dinding" },
          { id: "meja", label: "Meja" },
          { id: "karpet", label: "Karpet" },
        ] as { id: SlotKind | "semua"; label: string }[],
        view.shopFilter,
        (id) => {
          view.shopFilter = id;
          ctx.rerender();
        },
      ),
    );
    const grid = h("div", { class: "grid3" });
    const items = ITEMS.filter((i) => view.shopFilter === "semua" || i.kind === view.shopFilter).sort(
      (a, b) => Number(s.owned.includes(a.id)) - Number(s.owned.includes(b.id)) || a.price - b.price,
    );
    for (const item of items) {
      const owned = s.owned.includes(item.id);
      const placed = owned && game.slotOf(item.id) !== null;
      grid.append(
        h(
          "div",
          { class: `tile${owned ? " owned" : ""}`, title: `${item.name}: ${item.desc}` },
          attracts(item.id) ? h("span", { class: "tile-badge", title: "Ada tamu yang menyukai barang ini" }, icon("tamu", 2, "icon-inline")) : null,
          h("div", { class: "tile-img" }, h("img", { class: "px", src: itemUrl(item.id, 2), alt: "" })),
          h("div", { class: "tile-name" }, item.name),
          owned
            ? h("div", { class: "tile-state" }, placed ? "Terpasang" : "Disimpan")
            : h(
                "button",
                {
                  class: "btn small btn-buy",
                  disabled: s.coins < item.price,
                  onclick: () => {
                    const res = game.buyItem(item.id, Date.now());
                    if (res.ok) {
                      ctx.sound("beli");
                      ctx.toast(res.slot ? `${item.name} dipasang di kamar.` : `${item.name} dibeli. Pasang lewat Atur Kamar.`);
                    } else {
                      ctx.sound("gagal");
                    }
                    ctx.rerender();
                  },
                },
                coinTag(item.price),
              ),
        ),
      );
    }
    body.append(grid);
  } else {
    for (const part of ["dinding", "lantai"] as const) {
      const grid = h("div", { class: "grid3" });
      for (const theme of THEMES.filter((t) => t.part === part)) {
        const owned = s.ownedThemes.includes(theme.id);
        const active = s.room.wall === theme.id || s.room.floor === theme.id;
        grid.append(
          h(
            "div",
            { class: `tile${owned ? " owned" : ""}${active ? " active" : ""}` },
            h("div", { class: "tile-img" }, h("img", { class: "px", src: themeUrl(theme.id, 2), alt: "" })),
            h("div", { class: "tile-name" }, theme.name),
            owned
              ? active
                ? h("div", { class: "tile-state" }, "Dipakai")
                : h(
                    "button",
                    {
                      class: "btn small",
                      onclick: () => {
                        game.setTheme(theme.id);
                        ctx.sound("klik");
                        ctx.rerender();
                      },
                    },
                    "Pakai",
                  )
              : h(
                  "button",
                  {
                    class: "btn small btn-buy",
                    disabled: s.coins < theme.price,
                    onclick: () => {
                      const res = game.buyTheme(theme.id);
                      ctx.sound(res.ok ? "beli" : "gagal");
                      ctx.rerender();
                    },
                  },
                  coinTag(theme.price),
                ),
          ),
        );
      }
      body.append(section(part === "dinding" ? "Dinding" : "Lantai", grid));
    }
  }
  return body;
}

// ---------------------------------------------------------------------------
// Atur kamar

export function roomPanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const s = game.state;
  const body = h("div", { class: "panel-body" });
  body.append(
    h(
      "div",
      { class: "note" },
      "Keindahan kamar: ",
      h("b", null, String(roomBeauty(s))),
      ". Pilih barang untuk tiap tempat. Barang yang dipindah otomatis dilepas dari tempat lamanya.",
    ),
  );
  const kinds: SlotKind[] = ["lantai", "dinding", "meja", "karpet"];
  for (const kind of kinds) {
    const rows = h("div", { class: "slot-list" });
    const owned = ITEMS.filter((i) => i.kind === kind && s.owned.includes(i.id));
    for (const slot of SLOTS.filter((sl) => sl.kind === kind)) {
      const current = s.room.slots[slot.id];
      const choices = owned.filter((i) => fits(i.id, slot.id));
      const select = h(
        "select",
        {
          class: "select",
          onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            game.placeItem(slot.id, v || null, Date.now());
            ctx.sound("klik");
            ctx.rerender();
          },
        },
        h("option", { value: "" }, "(kosong)"),
        choices.map((i) => {
          const where = game.slotOf(i.id);
          const label = where && where !== slot.id ? `${i.name} (pindahkan)` : i.name;
          return h("option", { value: i.id, selected: current === i.id }, label);
        }),
      );
      rows.append(
        h(
          "div",
          { class: "slot-row" },
          h("div", { class: "slot-thumb" }, current ? h("img", { class: "px", src: itemUrl(current, 1), alt: "" }) : null),
          h("div", { class: "slot-name" }, slot.name, slot.small ? h("span", { class: "note block" }, "barang pendek") : null),
          select,
        ),
      );
    }
    if (owned.length === 0) rows.append(h("div", { class: "note" }, "Belum punya barang jenis ini. Lihat Toko."));
    body.append(section(SLOT_KIND_NAME[kind], rows));
  }
  const themeSelect = (part: "dinding" | "lantai") =>
    h(
      "select",
      {
        class: "select",
        onchange: (e: Event) => {
          game.setTheme((e.target as HTMLSelectElement).value);
          ctx.sound("klik");
          ctx.rerender();
        },
      },
      THEMES.filter((t) => t.part === part && s.ownedThemes.includes(t.id)).map((t) =>
        h("option", { value: t.id, selected: s.room.wall === t.id || s.room.floor === t.id }, t.name),
      ),
    );
  body.append(
    section(
      "Tema",
      h("div", { class: "slot-row" }, h("div", { class: "slot-name" }, "Dinding"), themeSelect("dinding")),
      h("div", { class: "slot-row" }, h("div", { class: "slot-name" }, "Lantai"), themeSelect("lantai")),
    ),
  );
  return body;
}

// ---------------------------------------------------------------------------
// Gaya avatar

export function stylePanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const s = game.state;
  const a = s.avatar;
  const body = h("div", { class: "panel-body" });
  body.append(h("div", { class: "avatar-preview" }, h("img", { class: "px", src: avatarUrl(a, 4), alt: "Avatar" })));

  const swatches = (list: ColorDef[], active: string, pick: (id: string) => void) =>
    h(
      "div",
      { class: "swatches" },
      list.map((c) =>
        h("button", {
          class: `swatch${c.id === active ? " active" : ""}`,
          title: c.name,
          style: { background: c.base },
          onclick: () => {
            pick(c.id);
            ctx.sound("klik");
            ctx.rerender();
          },
        }),
      ),
    );

  const styles = (slot: CosmeticSlot) =>
    h(
      "div",
      { class: "chips wrap" },
      COSMETICS.filter((c) => c.slot === slot).map((c) => {
        const owned = s.ownedCosmetics.includes(c.id);
        const active = a.hair === c.id || a.top === c.id || a.accessory === c.id;
        return h(
          "button",
          {
            class: `chip${active ? " active" : ""}${owned ? "" : " locked"}`,
            disabled: !owned && s.coins < c.price,
            onclick: () => {
              const ok = owned ? game.equipCosmetic(c.id) : game.buyCosmetic(c.id).ok;
              ctx.sound(ok ? (owned ? "klik" : "beli") : "gagal");
              ctx.rerender();
            },
          },
          c.name,
          owned ? null : coinTag(c.price),
        );
      }),
    );

  body.append(
    section("Kulit", swatches(SKINS, a.skin, (id) => game.setAvatarColor("skin", id))),
    section("Rambut", styles("rambut")),
    section(a.hair === "hijab" ? "Warna hijab" : "Warna rambut", swatches(HAIR_COLORS, a.hairColor, (id) => game.setAvatarColor("hairColor", id))),
    section("Atasan", styles("atasan")),
    section("Warna atasan", swatches(TOP_COLORS, a.topColor, (id) => game.setAvatarColor("topColor", id))),
    section("Aksesori", styles("aksesori")),
  );
  return body;
}

// ---------------------------------------------------------------------------
// Buku tamu

function hearts(n: number): HTMLElement {
  return h(
    "span",
    { class: "hearts", title: `Keakraban ${n}/5` },
    Array.from({ length: 5 }, (_, i) => icon(i < n ? "hati" : "hatiKosong", 2, "icon-inline")),
  );
}

export function guestbookPanel(ctx: PanelContext): HTMLElement {
  const { game, view } = ctx;
  const s = game.state;
  const body = h("div", { class: "panel-body" });
  const found = GUESTS.filter((g) => s.guests[g.id]).length;

  if (view.guest && GUEST_BY_ID[view.guest]) {
    const def = GUEST_BY_ID[view.guest];
    const rec = s.guests[def.id];
    const back = h(
      "button",
      {
        class: "btn small",
        onclick: () => {
          view.guest = null;
          ctx.rerender();
        },
      },
      "‹ Kembali",
    );
    const present = s.visitors.find((v) => v.guestId === def.id);
    body.append(
      back,
      h(
        "div",
        { class: "guest-detail" },
        h("div", { class: "guest-portrait" }, h("img", { class: "px", src: rec ? animalUrl(def.id, 5) : silhouetteUrl(def.id, 5), alt: "" })),
        h("div", { class: "guest-name" }, rec ? def.name : "???"),
        h("span", { class: `rarity r-${def.rarity}` }, RARITY_NAME[def.rarity]),
        h("p", { class: "desc" }, rec ? def.desc : def.hint),
        rec && def.likes.length
          ? h(
              "div",
              { class: "likes" },
              h("span", null, "Suka: "),
              def.likes.map((id) => h("span", { class: "like" }, h("img", { class: "px", src: itemUrl(id, 1), alt: "" }), ITEM_BY_ID[id]?.name ?? id)),
            )
          : null,
        rec ? h("div", { class: "note" }, `Sudah berkunjung ${formatNumber(rec.visits)} kali.`, present ? " Sedang di kamarmu!" : "") : null,
        rec ? h("div", { class: "row" }, "Keakraban ", hearts(heartsFor(rec.affection))) : null,
        rec ? h("div", { class: "note" }, "Elus tamu saat berkunjung untuk menambah keakraban. Tiap hati baru, tamu meninggalkan hadiah.") : null,
      ),
    );
    return body;
  }

  body.append(h("div", { class: "note" }, `Ditemukan ${found} dari ${GUESTS.length}. Klik untuk melihat petunjuk.`));
  const grid = h("div", { class: "grid4" });
  for (const def of GUESTS) {
    const rec = s.guests[def.id];
    const present = s.visitors.some((v) => v.guestId === def.id);
    grid.append(
      h(
        "button",
        {
          class: `guest-tile r-border-${def.rarity}${present ? " present" : ""}`,
          title: rec ? def.name : "???",
          onclick: () => {
            view.guest = def.id;
            ctx.sound("klik");
            ctx.rerender();
          },
        },
        h("img", { class: "px", src: rec ? animalUrl(def.id, 2) : silhouetteUrl(def.id, 2), alt: "" }),
        h("span", { class: "guest-tile-name" }, rec ? def.name : "???"),
      ),
    );
  }
  body.append(grid);
  return body;
}

// ---------------------------------------------------------------------------
// Tugas

export function todoPanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const s = game.state;
  const body = h("div", { class: "panel-body" });
  const input = h("input", { class: "input", placeholder: "Tambah tugas, lalu Enter", maxLength: 120 }) as HTMLInputElement;
  const add = () => {
    if (game.addTodo(input.value, Date.now())) {
      input.value = "";
      ctx.sound("klik");
      ctx.rerender();
      window.setTimeout(() => (document.querySelector(".panel .input") as HTMLInputElement | null)?.focus(), 0);
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
  body.append(h("div", { class: "row" }, input, h("button", { class: "btn", onclick: add }, "Tambah")));

  const list = h("div", { class: "todo-list" });
  for (const todo of s.todos) {
    list.append(
      h(
        "div",
        { class: `todo${todo.done ? " done" : ""}` },
        h("input", {
          type: "checkbox",
          checked: todo.done,
          onchange: () => {
            const coins = game.toggleTodo(todo.id, Date.now());
            ctx.sound(todo.done ? "centang" : "klik");
            if (coins) ctx.toast(`Tugas selesai! +${coins} koin`);
            ctx.rerender();
          },
        }),
        h("span", { class: "todo-text" }, todo.text),
        h(
          "button",
          {
            class: "icon-btn",
            title: "Hapus",
            onclick: () => {
              game.removeTodo(todo.id);
              ctx.rerender();
            },
          },
          "×",
        ),
      ),
    );
  }
  if (s.todos.length === 0) list.append(h("div", { class: "note empty" }, "Belum ada tugas. Tulis satu hal kecil yang ingin kamu selesaikan."));
  body.append(list);
  const done = s.todos.filter((t) => t.done).length;
  body.append(
    h(
      "div",
      { class: "row between" },
      h("span", { class: "note" }, `+${TODO_COINS} koin per tugas (maks ${TODO_REWARDS_PER_DAY}/hari)`),
      done
        ? h(
            "button",
            {
              class: "btn small",
              onclick: () => {
                game.clearDoneTodos();
                ctx.rerender();
              },
            },
            `Hapus ${done} selesai`,
          )
        : null,
    ),
  );
  return body;
}

// ---------------------------------------------------------------------------
// Memo

export function memoPanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const body = h("div", { class: "panel-body" });
  const area = h("textarea", { class: "memo", placeholder: "Catat apa saja di sini. Tersimpan otomatis.", maxLength: 5000 }) as HTMLTextAreaElement;
  area.value = game.state.memo;
  const count = h("div", { class: "note right" }, `${area.value.length}/5000`);
  area.addEventListener("input", () => {
    game.setMemo(area.value);
    count.textContent = `${area.value.length}/5000`;
  });
  body.append(area, count);
  return body;
}

// ---------------------------------------------------------------------------
// Fokus

export function focusPanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const f = game.state.focus;
  const now = Date.now();
  const body = h("div", { class: "panel-body focus" });
  const paused = game.focusPaused();
  const label = f.phase === "fokus" ? (paused ? "Fokus (dijeda)" : "Sedang fokus") : f.phase === "istirahat" ? (paused ? "Istirahat (dijeda)" : "Istirahat") : "Siap fokus";
  body.append(
    h("div", { class: `focus-phase p-${f.phase}` }, label),
    h("div", { class: "focus-clock", "data-focus-clock": true }, formatClock(game.focusRemaining(now))),
  );
  const buttons = h("div", { class: "row center" });
  if (f.phase === "siap") {
    buttons.append(
      h(
        "button",
        {
          class: "btn btn-primary",
          onclick: () => {
            game.startFocus(Date.now());
            ctx.sound("klik");
            ctx.rerender();
          },
        },
        "Mulai fokus",
      ),
    );
  } else {
    buttons.append(
      h(
        "button",
        {
          class: "btn",
          onclick: () => {
            if (paused) game.resumeFocus(Date.now());
            else game.pauseFocus(Date.now());
            ctx.rerender();
          },
        },
        paused ? "Lanjut" : "Jeda",
      ),
    );
    if (f.phase === "istirahat") {
      buttons.append(
        h(
          "button",
          {
            class: "btn btn-primary",
            onclick: () => {
              game.startFocus(Date.now());
              ctx.rerender();
            },
          },
          "Lewati istirahat",
        ),
      );
    }
    buttons.append(
      h(
        "button",
        {
          class: "btn",
          onclick: () => {
            game.stopFocus();
            ctx.rerender();
          },
        },
        "Berhenti",
      ),
    );
  }
  body.append(buttons);

  if (f.phase === "siap") {
    body.append(
      section(
        "Lama fokus",
        chips(
          [15, 25, 45, 50].map((m) => ({ id: String(m), label: `${m} menit` })),
          String(f.focusMin),
          (id) => {
            game.setFocusLengths(Number(id), f.breakMin);
            ctx.rerender();
          },
        ),
      ),
      section(
        "Lama istirahat",
        chips(
          [5, 10, 15].map((m) => ({ id: String(m), label: `${m} menit` })),
          String(f.breakMin),
          (id) => {
            game.setFocusLengths(f.focusMin, Number(id));
            ctx.rerender();
          },
        ),
      ),
    );
  }
  body.append(
    h(
      "div",
      { class: "note center" },
      `Hari ini ${f.today} sesi · Total ${formatNumber(f.sessions)} sesi (${formatNumber(f.totalMin)} menit). Sesi selesai memberi koin.`,
    ),
  );
  return body;
}

// ---------------------------------------------------------------------------
// Radio

export function musicPanel(ctx: PanelContext): HTMLElement {
  const { game } = ctx;
  const r = game.state.radio;
  const body = h("div", { class: "panel-body" });
  for (const st of STATIONS) {
    const on = r.station === st.id;
    body.append(
      h(
        "button",
        {
          class: `station${on ? " on" : ""}`,
          onclick: () => {
            ctx.actions.playStation(on ? null : st.id);
            ctx.rerender();
          },
        },
        h("span", { class: "station-play" }, on ? "■" : "▶"),
        h("span", { class: "station-text" }, h("b", null, st.name), h("span", { class: "note" }, st.desc)),
      ),
    );
  }
  const slider = h("input", { type: "range", min: 0, max: 100, value: Math.round(r.volume * 100), class: "slider" }) as HTMLInputElement;
  slider.addEventListener("input", () => game.setRadioVolume(Number(slider.value) / 100));
  body.append(section("Volume radio", slider));
  body.append(h("div", { class: "note" }, "Semua musik dibuat langsung oleh aplikasi, jadi tidak pernah sama persis. Beberapa tamu suka musik tertentu."));
  return body;
}

// ---------------------------------------------------------------------------
// Pengaturan

export function settingsPanel(ctx: PanelContext): HTMLElement {
  const { game, actions } = ctx;
  const s = game.state;
  const set = s.settings;
  const body = h("div", { class: "panel-body" });

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, hint?: string) =>
    h(
      "label",
      { class: "toggle-row" },
      h("input", {
        type: "checkbox",
        checked: value,
        onchange: (e: Event) => {
          onChange((e.target as HTMLInputElement).checked);
          ctx.rerender();
        },
      }),
      h("span", null, label, hint ? h("span", { class: "note block" }, hint) : null),
    );

  body.append(
    section(
      "Posisi",
      chips(
        [
          { id: "kanan", label: "Kanan bawah" },
          { id: "kiri", label: "Kiri bawah" },
        ],
        set.corner,
        (id) => actions.setCorner(id as "kanan" | "kiri"),
      ),
    ),
    section(
      "Ukuran kamar",
      chips(
        [
          { id: "2", label: "Kecil" },
          { id: "3", label: "Sedang" },
          { id: "4", label: "Besar" },
        ],
        String(set.scale),
        (id) => actions.setScale(Number(id) as 2 | 3 | 4),
      ),
    ),
  );

  const volume = h("input", { type: "range", min: 0, max: 100, value: Math.round(set.volume * 100), class: "slider" }) as HTMLInputElement;
  volume.addEventListener("change", () => game.updateSettings({ volume: Number(volume.value) / 100 }));
  body.append(
    section(
      "Suara dan pemberitahuan",
      toggle("Efek suara", set.sound, (v) => game.updateSettings({ sound: v })),
      volume,
      toggle("Pemberitahuan saat sesi fokus selesai", set.notify, (v) => game.updateSettings({ notify: v })),
      toggle("Kata penyemangat sesekali", set.cheers, (v) => game.updateSettings({ cheers: v })),
    ),
  );

  const auto = actions.autostart();
  if (auto !== null) {
    body.append(section("Mulai", toggle("Jalankan saat komputer menyala", auto, (v) => actions.setAutostart(v))));
  }

  const supported = actions.typingSupported();
  body.append(
    section(
      "Ikut mengetik",
      toggle(
        "Avatar ikut mengetik saat kamu mengetik",
        s.typing.enabled,
        (v) => actions.setTyping(v),
        supported
          ? "Yang dihitung hanya JUMLAH ketukan keyboard, bukan tombolnya. Tidak ada yang disimpan atau dikirim."
          : TYPING_HELP,
      ),
    ),
  );

  body.append(
    section(
      "Statistik",
      h(
        "div",
        { class: "stats" },
        h("span", null, "Ketukan hari ini"),
        h("b", null, formatNumber(s.typing.today)),
        h("span", null, "Ketukan sepanjang masa"),
        h("b", null, formatNumber(s.typing.total)),
        h("span", null, "Rekor sehari"),
        h("b", null, formatNumber(s.typing.best)),
        h("span", null, "Koin terkumpul"),
        h("b", null, formatNumber(s.stats.coinsEarned)),
        h("span", null, "Kunjungan tamu"),
        h("b", null, formatNumber(s.stats.visits)),
        h("span", null, "Elusan"),
        h("b", null, formatNumber(s.stats.pets)),
        h("span", null, "Tugas selesai"),
        h("b", null, formatNumber(s.stats.tasksDone)),
        h("span", null, "Menit fokus"),
        h("b", null, formatNumber(s.focus.totalMin)),
      ),
    ),
    h(
      "div",
      { class: "row center" },
      h("button", { class: "btn", onclick: () => actions.hide() }, "Sembunyikan"),
      h("button", { class: "btn btn-danger", onclick: () => actions.quit() }, "Keluar"),
    ),
    h("div", { class: "note center" }, "Munculkan lagi lewat ikon Teman Kerja di tray (dekat jam)."),
  );
  return body;
}

/** Perbarui angka jam di panel fokus tanpa menggambar ulang seluruh panel. */
export function tickFocusClock(root: HTMLElement, game: Game): void {
  const el = root.querySelector("[data-focus-clock]");
  if (el) el.textContent = formatClock(game.focusRemaining(Date.now()));
}

export const PANEL_RENDERERS: Record<PanelId, (ctx: PanelContext) => HTMLElement> = {
  toko: shopPanel,
  kamar: roomPanel,
  gaya: stylePanel,
  buku: guestbookPanel,
  tugas: todoPanel,
  memo: memoPanel,
  fokus: focusPanel,
  musik: musicPanel,
  atur: settingsPanel,
};
