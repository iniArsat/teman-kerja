// Kerangka antarmuka: kamar di pojok, bilah alat tegak di sampingnya, HUD di
// bawah kamar, panel yang terbuka di samping, toast, label tamu, dan kartu tamu baru.

import { GUEST_BY_ID, ITEM_BY_ID, RARITY_NAME } from "../core/data";
import type { Game } from "../core/game";
import { formatClock, formatDuration, formatNumber, formatShort, MINUTE } from "../core/time";
import type { AwayReport, StationId } from "../core/types";
import { heartsFor } from "../core/visits";
import type { HitResult, RoomView } from "../render/scene";
import { clear, h } from "./dom";
import { icon, type IconId } from "./icons";
import { animalUrl } from "./images";
import { PANEL_RENDERERS, PANEL_TITLES, tickFocusClock, type PanelContext, type PanelId } from "./panels";
import { playSound } from "./sound";

export interface UIActions {
  setCorner: (corner: "kanan" | "kiri") => void;
  setScale: (scale: 2 | 3 | 4) => void;
  setTyping: (enabled: boolean) => void;
  playStation: (id: StationId | null) => void;
  hide: () => void;
  quit: () => void;
  typingSupported: () => boolean;
  autostart: () => boolean | null;
  setAutostart: (enabled: boolean) => void;
}

const TOOLBAR: { id: PanelId; icon: IconId; label: string }[] = [
  { id: "toko", icon: "toko", label: "Toko" },
  { id: "kamar", icon: "kamar", label: "Atur kamar" },
  { id: "gaya", icon: "gaya", label: "Gaya avatar" },
  { id: "buku", icon: "buku", label: "Buku tamu" },
  { id: "tugas", icon: "tugas", label: "Daftar tugas" },
  { id: "memo", icon: "memo", label: "Memo" },
  { id: "fokus", icon: "fokus", label: "Fokus (Pomodoro)" },
  { id: "musik", icon: "musik", label: "Radio" },
  { id: "atur", icon: "atur", label: "Pengaturan" },
];

export class UI {
  readonly root: HTMLElement;
  private dock: HTMLDivElement;
  private panelEl: HTMLDivElement;
  private panelBody: HTMLDivElement | null = null;
  private toolbar: HTMLDivElement;
  private hud: HTMLDivElement;
  private toasts: HTMLDivElement;
  /** Ruang di atas kamar: kartu tamu baru / dialog, lalu toast. */
  private above: HTMLDivElement;
  private cardSlot: HTMLDivElement;
  private label: HTMLDivElement;
  private buttons = new Map<PanelId, HTMLButtonElement>();
  private current: PanelId | null = null;
  private rendered: PanelId | null = null;
  private dialog: HTMLElement | null = null;
  private newCard: HTMLElement | null = null;
  private hoverGuest: string | null = null;
  private hud_: { coins: HTMLElement; taps: HTMLElement; focus: HTMLElement; focusText: HTMLElement; guests: HTMLElement };
  private ctx: PanelContext;
  private dirty = false;

  constructor(
    private game: Game,
    private view: RoomView,
    actions: UIActions,
  ) {
    this.root = document.getElementById("ui")!;
    this.dock = h("div", { class: "dock" });
    this.panelEl = h("div", { class: "card panel hidden", "data-hit": true });
    this.toolbar = h("div", { class: "toolbar card", "data-hit": true });
    for (const t of TOOLBAR) {
      const btn = h(
        "button",
        { class: "tool", title: t.label, "aria-label": t.label, onclick: () => this.toggle(t.id) },
        icon(t.icon, 2, "tool-icon"),
      );
      this.buttons.set(t.id, btn);
      this.toolbar.append(btn);
    }

    const coins = h("b", { class: "num" }, "0");
    const taps = h("b", { class: "num" }, "0");
    const guests = h("b", { class: "num" }, "0");
    const focusText = h("b", { class: "num" }, "");
    const focus = h(
      "button",
      { class: "pill pill-focus hidden", title: "Buka Fokus", onclick: () => this.open("fokus") },
      icon("fokus", 2, "icon-inline"),
      focusText,
    );
    this.hud = h(
      "div",
      { class: "hud", "data-hit": true },
      h("span", { class: "pill", title: "Koin" }, icon("koin", 2, "icon-inline"), coins),
      h("span", { class: "pill", title: "Ketukan keyboard hari ini" }, icon("ketik", 2, "icon-inline"), taps),
      h("span", { class: "pill", title: "Tamu di kamar" }, icon("tamu", 2, "icon-inline"), guests),
      focus,
    );
    this.hud_ = { coins, taps, focus, focusText, guests };

    this.toasts = h("div", { class: "toasts" });
    this.cardSlot = h("div", { class: "card-slot" });
    this.above = h("div", { class: "above" }, this.cardSlot, this.toasts);
    const roomCol = h("div", { class: "room-col" }, this.above, view.el, this.hud);
    this.dock.append(this.panelEl, this.toolbar, roomCol);
    this.label = h("div", { class: "guest-label hidden" });
    this.root.append(this.dock, this.label);

    this.ctx = {
      game,
      rerender: () => this.renderPanel(),
      toast: (t, ms) => this.toast(t, ms),
      sound: (id) => playSound(id),
      view: { shopTab: "barang", shopFilter: "semua", guest: null },
      actions,
    };

    view.onHover = (hit, x, y) => this.hover(hit, x, y);
    view.canvas.addEventListener("click", (e) => this.clickRoom(view.hitTest(e.clientX, e.clientY)));
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.dialog) this.closeDialog();
      else if (this.newCard) this.closeNewGuest();
      else this.close();
    });
    this.applyCorner();
    this.updateHud(Date.now());
  }

  // -------------------------------------------------------------------------
  // Panel

  toggle(id: PanelId): void {
    if (this.current === id) this.close();
    else this.open(id);
  }

  open(id: PanelId): void {
    this.current = id;
    if (id === "toko") this.game.markShopSeen();
    playSound("klik");
    this.view.poke();
    this.renderPanel();
  }

  close(): void {
    if (!this.current) return;
    this.current = null;
    this.ctx.view.guest = null;
    this.panelEl.classList.add("hidden");
    this.refreshButtons();
  }

  get openPanel(): PanelId | null {
    return this.current;
  }

  openGuest(id: string): void {
    this.ctx.view.guest = id;
    this.open("buku");
  }

  renderPanel(): void {
    this.dirty = false;
    this.refreshButtons();
    if (!this.current) return;
    const id = this.current;
    const scroll = this.rendered === id ? (this.panelBody?.scrollTop ?? 0) : 0;
    this.rendered = id;
    clear(this.panelEl);
    this.panelEl.classList.remove("hidden");
    this.panelEl.append(
      h(
        "div",
        { class: "panel-head" },
        h("span", { class: "panel-title" }, PANEL_TITLES[id]),
        id === "toko" || id === "gaya" ? h("span", { class: "pill small" }, icon("koin", 2, "icon-inline"), formatShort(this.game.state.coins)) : null,
        h("button", { class: "icon-btn", title: "Tutup", onclick: () => this.close() }, "×"),
      ),
    );
    this.panelBody = PANEL_RENDERERS[id](this.ctx) as HTMLDivElement;
    this.panelEl.append(this.panelBody);
    this.panelBody.scrollTop = scroll;
  }

  /** Data berubah: gambar ulang panel, kecuali pemain sedang mengetik di dalamnya. */
  refresh(...panels: PanelId[]): void {
    if (!this.current || (panels.length && !panels.includes(this.current))) return;
    const active = document.activeElement;
    if (active && this.panelEl.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
      this.dirty = true;
      return;
    }
    this.renderPanel();
  }

  private refreshButtons(): void {
    for (const [id, btn] of this.buttons) btn.classList.toggle("active", id === this.current);
    this.buttons.get("toko")?.classList.toggle("has-dot", !this.game.state.seenShop);
  }

  // -------------------------------------------------------------------------
  // HUD dan detik

  /** Dipanggil tiap detik. */
  updateHud(now: number): void {
    const s = this.game.state;
    this.hud_.coins.textContent = formatShort(s.coins);
    this.hud_.taps.textContent = formatShort(s.typing.today);
    this.hud_.guests.textContent = String(s.visitors.length);
    const f = s.focus;
    const showFocus = f.phase !== "siap";
    this.hud_.focus.classList.toggle("hidden", !showFocus);
    this.hud_.focus.classList.toggle("break", f.phase === "istirahat");
    if (showFocus) this.hud_.focusText.textContent = (this.game.focusPaused() ? "⏸ " : "") + formatClock(this.game.focusRemaining(now));
    if (this.current === "fokus") tickFocusClock(this.panelEl, this.game);
    if (this.dirty) this.refresh();
    if (this.hoverGuest) this.updateLabel(now);
  }

  /** Koin berubah: perbarui HUD segera dan tombol beli di toko. */
  coinsChanged(): void {
    this.hud_.coins.textContent = formatShort(this.game.state.coins);
    this.refresh("toko", "gaya");
  }

  // -------------------------------------------------------------------------
  // Kamar: hover dan klik

  private hover(hit: HitResult | null, _x: number, _y: number): void {
    const id = hit?.kind === "guest" ? hit.id : null;
    this.view.canvas.style.cursor = hit && hit.kind !== "room" ? "pointer" : "default";
    if (id !== this.hoverGuest) {
      this.hoverGuest = id;
      this.label.classList.toggle("hidden", !id);
    }
    if (id) this.updateLabel(Date.now());
  }

  private updateLabel(now: number): void {
    const id = this.hoverGuest;
    if (!id) return;
    const visit = this.game.state.visitors.find((v) => v.guestId === id);
    const pos = this.view.guestClientPos(id);
    const def = GUEST_BY_ID[id];
    if (!visit || !pos || !def) {
      this.hoverGuest = null;
      this.label.classList.add("hidden");
      return;
    }
    const rec = this.game.state.guests[id];
    clear(this.label);
    this.label.append(h("b", null, def.name), h("span", { class: "note" }, `pulang ${formatClock(visit.leaveAt - now)}`));
    const hearts = rec ? heartsFor(rec.affection) : 0;
    if (hearts > 0) this.label.append(h("span", { class: "label-hearts" }, Array.from({ length: hearts }, () => icon("hati", 1, "icon-tiny"))));
    const rect = this.root.getBoundingClientRect();
    this.label.style.left = `${pos.x - rect.left}px`;
    this.label.style.top = `${pos.y - rect.top - 6}px`;
  }

  private clickRoom(hit: HitResult | null): void {
    if (!hit) return;
    this.view.poke();
    if (hit.kind === "guest") {
      const res = this.game.pet(hit.id);
      if (res) {
        playSound("elus");
        this.view.petEffect(hit.id, res.heartUp);
        if (res.heartUp) this.toast(`${GUEST_BY_ID[hit.id]?.name} makin akrab denganmu!`);
      }
    } else if (hit.kind === "avatar") {
      this.view.perform("lambai", "senang", 1600);
      playSound("klik");
    }
  }

  // -------------------------------------------------------------------------
  // Toast, dialog, kartu

  toast(text: string, ms = 4000, action?: { label: string; run: () => void }): void {
    const el = h(
      "div",
      { class: "card toast", "data-hit": action ? true : undefined },
      h("span", null, text),
      action
        ? h(
            "button",
            {
              class: "btn small",
              onclick: () => {
                action.run();
                el.remove();
              },
            },
            action.label,
          )
        : null,
    );
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => {
      el.classList.add("hide");
      window.setTimeout(() => el.remove(), 300);
    }, ms);
  }

  /** Kartu "Tamu baru!" saat seekor hewan datang untuk pertama kali. */
  showNewGuest(id: string): void {
    const def = GUEST_BY_ID[id];
    if (!def) return;
    this.closeNewGuest();
    const reason = def.likes.length ? `Datang karena ${def.likes.map((l) => ITEM_BY_ID[l]?.name ?? l).join(", ")}` : "Datang karena kamarmu indah";
    const card = h(
      "div",
      { class: "card new-guest", "data-hit": true },
      h("div", { class: "new-title" }, "Tamu baru!"),
      h("img", { class: "px new-img", src: animalUrl(id, 5), alt: "" }),
      h("div", { class: "guest-name" }, def.name),
      h("span", { class: `rarity r-${def.rarity}` }, RARITY_NAME[def.rarity]),
      h("div", { class: "note" }, reason),
      h(
        "div",
        { class: "row center" },
        h(
          "button",
          {
            class: "btn btn-primary small",
            onclick: () => {
              this.closeNewGuest();
              this.openGuest(id);
            },
          },
          "Buku tamu",
        ),
        h("button", { class: "btn small", onclick: () => this.closeNewGuest() }, "Tutup"),
      ),
    );
    this.newCard = card;
    this.cardSlot.append(card);
    window.setTimeout(() => {
      if (this.newCard === card) this.closeNewGuest();
    }, 9000);
  }

  closeNewGuest(): void {
    this.newCard?.remove();
    this.newCard = null;
  }

  /** Ringkasan apa yang terjadi selama aplikasi tertutup. */
  showAwayReport(report: AwayReport): void {
    const names = report.newGuests.map((id) => GUEST_BY_ID[id]?.name).filter(Boolean);
    const parts = [`Selama kamu pergi (${formatDuration(report.minutes * MINUTE)}):`];
    if (report.visits) parts.push(`${report.visits} tamu mampir`);
    if (report.coins) parts.push(`${formatNumber(report.coins)} koin terkumpul`);
    let text = parts[0] + " " + parts.slice(1).join(", ") + ".";
    if (names.length) text += ` Tamu baru: ${names.join(", ")}!`;
    this.toast(text, 9000, names.length ? { label: "Lihat", run: () => this.openGuest(report.newGuests[0]) } : undefined);
  }

  /** Minta izin penghitung ketukan (sekali, saat pertama kali dibuka). */
  askTyping(onAnswer: (yes: boolean) => void, supported: boolean): void {
    if (this.dialog) return;
    const answer = (yes: boolean) => {
      this.closeDialog();
      onAnswer(yes);
    };
    this.dialog = h(
      "div",
      { class: "card dialog", "data-hit": true },
      h("div", { class: "dialog-title" }, "Boleh avatarmu ikut mengetik?"),
      h(
        "p",
        { class: "desc" },
        supported
          ? "Setiap kamu menekan tombol keyboard di aplikasi mana pun, avatarmu ikut mengetik di laptopnya, dan setiap 25 ketukan menjadi 1 koin."
          : "Avatarmu ikut mengetik saat kamu mengetik di jendela Teman Kerja, dan setiap 25 ketukan menjadi 1 koin.",
      ),
      h(
        "p",
        { class: "desc" },
        h("b", null, "Privasi: "),
        "yang dihitung hanya JUMLAH ketukan. Tombol apa yang kamu tekan tidak dicatat, tidak disimpan, dan tidak dikirim ke mana pun. Bisa dimatikan kapan saja di Pengaturan.",
      ),
      h(
        "div",
        { class: "row center" },
        h("button", { class: "btn btn-primary", onclick: () => answer(true) }, "Boleh"),
        h("button", { class: "btn", onclick: () => answer(false) }, "Nanti saja"),
      ),
    );
    this.cardSlot.prepend(this.dialog);
  }

  closeDialog(): void {
    this.dialog?.remove();
    this.dialog = null;
  }

  // -------------------------------------------------------------------------
  // Tata letak

  applyCorner(): void {
    const corner = this.game.state.settings.corner;
    this.root.classList.toggle("corner-kiri", corner === "kiri");
    this.root.classList.toggle("corner-kanan", corner === "kanan");
  }
}
