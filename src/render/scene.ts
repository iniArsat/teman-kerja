// Tampilan kamar: kanvas berpiksel rendah yang diperbesar, avatar yang ikut
// mengetik, tamu yang datang dan pergi, serta efek. Menyusun bingkai dengan
// FrameComposer dan menaruh teks (gelembung, angka melayang) di lapisan DOM.

import { GUEST_BY_ID, ITEM_BY_ID } from "../core/data";
import type { Game } from "../core/game";
import { hourOf } from "../core/time";
import type { Visit } from "../core/types";
import { animalFrames } from "./animals";
import { AVATAR_ANCHOR, renderAvatar, type AvatarFace, type AvatarFrame, type AvatarPose } from "./avatar";
import { FrameComposer, lightingAt, type DrawSprite } from "./compose";
import { AVATAR_HANDS, AVATAR_SEAT, DOOR, FLOOR_SPOTS, LAPTOP } from "./layout";
import { skyAt } from "./models";
import { particleImage, type ParticleShape } from "./particles";
import type { PixelImage } from "./pixel";
import { buildStaticScene, screenOf, type Point3, type StaticScene } from "./staticScene";

const FRAME_MS = 50;
const WALK_SPEED = 4.5; // satuan voxel per detik
const SLEEP_AFTER = 5 * 60_000;

interface GuestActor {
  id: string;
  spot: string;
  state: "masuk" | "duduk" | "pindah" | "pulang";
  pos: Point3;
  from: Point3;
  to: Point3;
  t: number;
  duration: number;
  flies: boolean;
  facing: "kiri" | "kanan";
  nextBlink: number;
  blinkUntil: number;
  hopUntil: number;
  nextFidget: number;
  alpha: number;
}

interface Particle {
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  /** Mengikuti gravitasi kecil (koin) atau melayang naik (hati, not). */
  gravity: number;
}

interface Box {
  x: number;
  y: number;
  img: PixelImage;
}

export type HitResult = { kind: "avatar" } | { kind: "guest"; id: string } | { kind: "room" };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class RoomView {
  readonly el: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly overlay: HTMLDivElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private scene: StaticScene;
  private composer: FrameComposer;
  private staticKey = "";
  private guests = new Map<string, GuestActor>();
  private particles: Particle[] = [];
  private avatarFrames = new Map<string, AvatarFrame>();
  private avatarStyle = "";
  private lastFrame = 0;
  private cssScale = 3;
  private boxes: { guest: Map<string, Box>; avatar: Box | null } = { guest: new Map(), avatar: null };
  private bubble: { el: HTMLDivElement; until: number } | null = null;

  // Animasi avatar
  private typeFlip = false;
  private lastTapAt = -Infinity;
  private lastInputAt = performance.now();
  private action: { pose: AvatarPose; face: AvatarFace; until: number } | null = null;
  private nextIdleAction = performance.now() + rand(15_000, 30_000);
  private nextBlink = performance.now() + 2000;
  private blinkUntil = 0;
  private nextZ = 0;
  private nextNote = 0;

  /** Dipanggil saat kursor bergerak di atas kamar (untuk label nama tamu). */
  onHover: (hit: HitResult | null, clientX: number, clientY: number) => void = () => {};

  constructor(private game: Game) {
    this.el = document.createElement("div");
    this.el.className = "room";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "room-canvas";
    this.overlay = document.createElement("div");
    this.overlay.className = "room-overlay";
    this.el.append(this.canvas, this.overlay);
    this.ctx = this.canvas.getContext("2d")!;
    const now = performance.now();
    this.scene = this.buildStatic(Date.now());
    this.composer = new FrameComposer(this.scene);
    this.canvas.width = this.scene.img.w;
    this.canvas.height = this.scene.img.h;
    this.setScale(game.state.settings.scale);
    this.syncGuests(now, false);

    this.canvas.addEventListener("pointermove", (e) => this.onHover(this.hitTest(e.clientX, e.clientY), e.clientX, e.clientY));
    this.canvas.addEventListener("pointerleave", (e) => this.onHover(null, e.clientX, e.clientY));
    window.addEventListener("resize", () => this.setScale(this.game.state.settings.scale));
  }

  /** Ukuran piksel layar per piksel seni; dibulatkan ke piksel perangkat agar tajam. */
  setScale(scale: number): void {
    const dpr = window.devicePixelRatio || 1;
    const device = Math.max(1, Math.round(scale * dpr));
    this.cssScale = device / dpr;
    const w = this.scene.img.w * this.cssScale;
    const h = this.scene.img.h * this.cssScale;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
  }

  get pixelScale(): number {
    return this.cssScale;
  }

  // -------------------------------------------------------------------------
  // Kamar statis

  private staticKeyFor(now: number): string {
    const room = this.game.state.room;
    const placed = Object.values(room.slots);
    const d = new Date(now);
    let key = JSON.stringify(room);
    if (placed.includes("jam")) key += `|j${d.getHours()}:${d.getMinutes()}`;
    if (placed.includes("jendela")) key += `|w${JSON.stringify(skyAt(hourOf(now)))}`;
    return key;
  }

  private buildStatic(now: number): StaticScene {
    const d = new Date(now);
    this.staticKey = this.staticKeyFor(now);
    return buildStaticScene(this.game.state.room, d.getHours(), d.getMinutes());
  }

  /** Bangun ulang kamar bila isinya (atau jam/langit) berubah. */
  refreshRoom(wall = Date.now()): void {
    if (this.staticKeyFor(wall) === this.staticKey) return;
    this.scene = this.buildStatic(wall);
    this.composer.setScene(this.scene);
    this.syncGuests(performance.now(), true);
  }

  // -------------------------------------------------------------------------
  // Tamu

  private spotPoint(spot: string): Point3 {
    if (spot.startsWith("slot:")) {
      const p = this.scene.anchors[spot.slice(5)];
      if (p) return { ...p };
    }
    const n = Number(spot.split(":")[1]) || 0;
    const f = FLOOR_SPOTS[n % FLOOR_SPOTS.length];
    return { x: f.x, y: f.y, z: 0 };
  }

  private facingAt(p: Point3): "kiri" | "kanan" {
    // Menghadap ke tengah kamar.
    const center = screenOf(this.scene, { x: 13, y: 13, z: 0 });
    const s = screenOf(this.scene, p);
    return s.sx < center.sx - 6 ? "kanan" : "kiri";
  }

  /** Samakan aktor tamu dengan daftar kunjungan di state. */
  syncGuests(now: number, animate: boolean): void {
    const visits = new Map<string, Visit>(this.game.state.visitors.map((v) => [v.guestId, v]));
    for (const [id, actor] of this.guests) {
      if (!visits.has(id) && actor.state !== "pulang") this.startLeaving(actor, now);
    }
    for (const visit of visits.values()) {
      const actor = this.guests.get(visit.guestId);
      if (!actor) {
        this.addGuest(visit, now, animate);
      } else if (actor.spot !== visit.spot || actor.state === "pulang") {
        actor.spot = visit.spot;
        actor.alpha = 1;
        this.walk(actor, this.spotPoint(visit.spot), now, "pindah");
      } else if (actor.state === "duduk") {
        // Barang di bawahnya mungkin berganti tinggi.
        const p = this.spotPoint(visit.spot);
        if (p.x !== actor.pos.x || p.y !== actor.pos.y || p.z !== actor.pos.z) this.walk(actor, p, now, "pindah");
      }
    }
  }

  private addGuest(visit: Visit, now: number, animate: boolean): void {
    const def = GUEST_BY_ID[visit.guestId];
    if (!def) return;
    const target = this.spotPoint(visit.spot);
    const actor: GuestActor = {
      id: visit.guestId,
      spot: visit.spot,
      state: "duduk",
      pos: { ...target },
      from: { ...target },
      to: { ...target },
      t: 1,
      duration: 1,
      flies: !!def.flies,
      facing: this.facingAt(target),
      nextBlink: now + rand(1000, 4000),
      blinkUntil: 0,
      hopUntil: 0,
      nextFidget: now + rand(6000, 14000),
      alpha: 1,
    };
    this.guests.set(visit.guestId, actor);
    if (animate) {
      actor.pos = { x: DOOR.x, y: DOOR.y, z: 0 };
      this.walk(actor, target, now, "masuk");
      this.burst("poof", this.screenPos(actor.pos), 1);
    }
  }

  private walk(actor: GuestActor, to: Point3, now: number, state: GuestActor["state"]): void {
    actor.from = { ...actor.pos };
    actor.to = { ...to };
    actor.t = 0;
    const dist = Math.hypot(to.x - actor.pos.x, to.y - actor.pos.y) + Math.abs(to.z - actor.pos.z);
    // Perjalanan jauh dipercepat agar tidak lebih dari 5 detik.
    actor.duration = Math.max(400, Math.min(5000, (dist / WALK_SPEED) * 1000));
    actor.state = state;
    const a = screenOf(this.scene, actor.from);
    const b = screenOf(this.scene, to);
    if (Math.abs(b.sx - a.sx) > 1) actor.facing = b.sx < a.sx ? "kiri" : "kanan";
    void now;
  }

  private startLeaving(actor: GuestActor, now: number): void {
    this.walk(actor, { x: DOOR.x, y: DOOR.y, z: 0 }, now, "pulang");
  }

  /** Tamu pulang: tampilkan koin yang ditinggalkan. */
  guestLeft(guestId: string, tip: number, gift: number): void {
    const actor = this.guests.get(guestId);
    if (actor) {
      const p = this.screenPos(actor.pos);
      if (tip + gift > 0) {
        this.burst("coin", p, Math.min(6, 2 + Math.floor((tip + gift) / 30)));
        this.floatText(`+${tip + gift}`, p.x, p.y - 14, "coin");
      }
    }
    this.syncGuests(performance.now(), true);
  }

  guestArrived(): void {
    this.syncGuests(performance.now(), true);
  }

  /** Efek elusan: lompat kecil dan hati. */
  petEffect(guestId: string, heartUp: boolean): void {
    const actor = this.guests.get(guestId);
    if (!actor) return;
    const now = performance.now();
    actor.hopUntil = now + 350;
    const p = this.screenPos(actor.pos);
    this.burst("heart", { x: p.x, y: p.y - 10 }, heartUp ? 5 : 2);
  }

  private screenPos(p: Point3): { x: number; y: number } {
    const s = screenOf(this.scene, p);
    return { x: s.sx, y: s.sy };
  }

  // -------------------------------------------------------------------------
  // Avatar

  /** Ketukan keyboard baru: avatar mengetik. */
  onTaps(count: number): void {
    const now = performance.now();
    this.lastTapAt = now;
    this.lastInputAt = now;
    this.typeFlip = !this.typeFlip;
    if (this.action && this.action.pose === "tidur") this.action = null;
    if (Math.random() < Math.min(0.6, count * 0.15)) {
      const k = screenOf(this.scene, { x: LAPTOP.x + rand(1, 4), y: LAPTOP.y + 0.5, z: 8.5 });
      this.particles.push({ shape: "dot", x: k.sx, y: k.sy, vx: rand(-6, 6), vy: rand(-22, -12), born: now, life: 450, gravity: 40 });
    }
  }

  /** Pemain berinteraksi (klik, buka panel): avatar bangun. */
  poke(): void {
    this.lastInputAt = performance.now();
  }

  /** Avatar melakukan gerakan sebentar. */
  perform(pose: AvatarPose, face: AvatarFace, ms: number): void {
    this.lastInputAt = performance.now();
    this.action = { pose, face, until: performance.now() + ms };
  }

  /** Gelembung kata di atas kepala avatar. */
  say(text: string, ms = 4000): void {
    this.bubble?.el.remove();
    const el = document.createElement("div");
    el.className = "bubble";
    el.textContent = text;
    this.overlay.append(el);
    this.bubble = { el, until: performance.now() + ms };
    this.positionBubble();
  }

  private positionBubble(): void {
    if (!this.bubble) return;
    const head = screenOf(this.scene, { x: AVATAR_SEAT.x, y: AVATAR_SEAT.y, z: AVATAR_SEAT.z + 13 });
    this.bubble.el.style.left = `${head.sx * this.cssScale}px`;
    this.bubble.el.style.top = `${head.sy * this.cssScale}px`;
  }

  avatarChanged(): void {
    this.avatarFrames.clear();
  }

  private avatarFrame(pose: AvatarPose, face: AvatarFace): AvatarFrame {
    const style = JSON.stringify(this.game.state.avatar);
    if (style !== this.avatarStyle) {
      this.avatarFrames.clear();
      this.avatarStyle = style;
    }
    const key = `${pose}|${face}`;
    let frame = this.avatarFrames.get(key);
    if (!frame) {
      frame = renderAvatar(this.game.state.avatar, pose, face);
      this.avatarFrames.set(key, frame);
    }
    return frame;
  }

  private avatarPose(now: number): { pose: AvatarPose; face: AvatarFace } {
    if (this.action && now < this.action.until) return { pose: this.action.pose, face: this.action.face };
    this.action = null;
    const blink = now < this.blinkUntil;
    if (now >= this.nextBlink) {
      this.blinkUntil = now + 140;
      this.nextBlink = now + rand(2500, 5500);
    }
    if (now - this.lastTapAt < 700) return { pose: this.typeFlip ? "ketik-a" : "ketik-b", face: blink ? "kedip" : "biasa" };
    const focusing = this.game.state.focus.phase === "fokus";
    if (!focusing && now - this.lastInputAt > SLEEP_AFTER) {
      if (now >= this.nextZ) {
        this.nextZ = now + 1400;
        const head = screenOf(this.scene, { x: AVATAR_SEAT.x, y: AVATAR_SEAT.y, z: AVATAR_SEAT.z + 9 });
        this.particles.push({ shape: "z", x: head.sx + 4, y: head.sy - 4, vx: 6, vy: -8, born: now, life: 1800, gravity: 0 });
      }
      return { pose: "tidur", face: "tidur" };
    }
    if (now >= this.nextIdleAction) {
      this.nextIdleAction = now + rand(20_000, 45_000);
      const hasMug = Object.values(this.game.state.room.slots).includes("mug");
      const choice = Math.random();
      if (hasMug && choice < 0.5) this.action = { pose: "minum", face: "kedip", until: now + 2600 };
      else this.action = { pose: "regang", face: "senang", until: now + 1800 };
      return { pose: this.action.pose, face: this.action.face };
    }
    return { pose: "diam", face: blink ? "kedip" : "biasa" };
  }

  // -------------------------------------------------------------------------
  // Efek

  burst(shape: ParticleShape, at: { x: number; y: number }, count: number): void {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const up = shape === "heart" || shape === "note" || shape === "sparkle";
      this.particles.push({
        shape,
        x: at.x + rand(-4, 4),
        y: at.y + rand(-3, 2),
        vx: rand(-10, 10),
        vy: up ? rand(-18, -10) : shape === "coin" ? rand(-30, -18) : rand(-6, 0),
        born: now + i * 60,
        life: shape === "poof" ? 500 : 1100,
        gravity: shape === "coin" ? 60 : 0,
      });
    }
  }

  /** Teks kecil yang melayang naik (misalnya +12 koin). */
  floatText(text: string, x: number, y: number, kind = ""): void {
    const el = document.createElement("div");
    el.className = `floater ${kind}`;
    el.textContent = text;
    el.style.left = `${x * this.cssScale}px`;
    el.style.top = `${y * this.cssScale}px`;
    this.overlay.append(el);
    window.setTimeout(() => el.remove(), 1400);
  }

  floatAtAvatar(text: string, kind = ""): void {
    const p = screenOf(this.scene, { x: AVATAR_SEAT.x, y: AVATAR_SEAT.y, z: AVATAR_SEAT.z + 11 });
    this.floatText(text, p.sx, p.sy, kind);
  }

  celebrate(): void {
    const p = screenOf(this.scene, { x: AVATAR_SEAT.x, y: AVATAR_SEAT.y, z: AVATAR_SEAT.z + 12 });
    this.burst("sparkle", { x: p.sx, y: p.sy }, 8);
  }

  // -------------------------------------------------------------------------
  // Bingkai

  /** Panggil tiap requestAnimationFrame; menggambar paling banyak 20 kali per detik. */
  frame(): void {
    // Animasi memakai jam monoton; hanya cahaya dan isi kamar yang memakai jam dinding.
    const now = performance.now();
    if (now - this.lastFrame < FRAME_MS) return;
    const dt = Math.min(200, now - this.lastFrame);
    this.lastFrame = now;
    const wall = Date.now();
    this.refreshRoom(wall);
    this.update(now, dt);
    this.draw(now, wall);
  }

  private update(now: number, dt: number): void {
    for (const [id, actor] of this.guests) {
      if (actor.t < 1) {
        actor.t = Math.min(1, actor.t + dt / actor.duration);
        const t = actor.t;
        actor.pos = {
          x: lerp(actor.from.x, actor.to.x, t),
          y: lerp(actor.from.y, actor.to.y, t),
          z: lerp(actor.from.z, actor.to.z, t),
        };
        if (actor.flies) actor.pos.z += Math.sin(Math.PI * t) * 8;
        else if (actor.to.z !== actor.from.z) actor.pos.z += Math.sin(Math.PI * t) * 3;
        if (actor.state === "pulang") actor.alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        if (t >= 1) {
          if (actor.state === "pulang") {
            this.burst("poof", this.screenPos(actor.pos), 1);
            this.guests.delete(id);
            continue;
          }
          actor.state = "duduk";
          actor.facing = this.facingAt(actor.pos);
        }
      } else if (now >= actor.nextFidget) {
        actor.nextFidget = now + rand(7000, 16000);
        if (Math.random() < 0.5) actor.hopUntil = now + 300;
        else actor.facing = actor.facing === "kiri" ? "kanan" : "kiri";
      }
      if (now >= actor.nextBlink) {
        actor.blinkUntil = now + 160;
        actor.nextBlink = now + rand(2500, 6000);
      }
    }

    // Not musik melayang dari radio atau laptop saat radio menyala.
    if (this.game.state.radio.station && now >= this.nextNote) {
      this.nextNote = now + rand(1800, 3200);
      const radioSlot = Object.entries(this.game.state.room.slots).find(([, v]) => v === "radio")?.[0];
      const src = radioSlot && this.scene.anchors[radioSlot] ? this.scene.anchors[radioSlot] : { x: LAPTOP.x + 2, y: LAPTOP.y + 2, z: 11 };
      const p = screenOf(this.scene, { ...src, z: src.z + 2 });
      this.particles.push({ shape: "note", x: p.sx + rand(-3, 3), y: p.sy, vx: rand(-4, 4), vy: -10, born: now, life: 2200, gravity: 0 });
    }

    this.particles = this.particles.filter((p) => now - p.born < p.life);
    if (this.bubble && now > this.bubble.until) {
      const el = this.bubble.el;
      el.classList.add("hide");
      window.setTimeout(() => el.remove(), 300);
      this.bubble = null;
    }
  }

  private draw(now: number, wall: number): void {
    const sprites: DrawSprite[] = [];
    const overlays: DrawSprite[] = [];
    this.boxes.guest.clear();

    // Avatar: badan sebagai papan tegak di kursi, lengan di kedalaman tangan.
    const { pose, face } = this.avatarPose(now);
    const frame = this.avatarFrame(pose, face);
    const seat = screenOf(this.scene, AVATAR_SEAT);
    const ax = Math.round(seat.sx - (AVATAR_ANCHOR.x + 1));
    const ay = Math.round(seat.sy - (AVATAR_ANCHOR.y + 1));
    const seatDepth = AVATAR_SEAT.x + AVATAR_SEAT.y + AVATAR_SEAT.z;
    sprites.push({ img: frame.body, x: ax, y: ay, depthTop: seatDepth + (AVATAR_ANCHOR.y + 1) / 2, depthPerRow: -0.5 });
    sprites.push({ img: frame.arms, x: ax, y: ay, depthTop: AVATAR_HANDS.x + AVATAR_HANDS.y + AVATAR_HANDS.z, depthPerRow: 0 });
    this.boxes.avatar = { x: ax, y: ay, img: frame.body };

    // Tamu.
    for (const actor of this.guests.values()) {
      const frames = animalFrames(actor.id, actor.facing);
      const walking = actor.t < 1;
      const img = now < actor.blinkUntil && !walking ? frames.blink : frames.idle;
      const s = screenOf(this.scene, actor.pos);
      let hop = 0;
      if (walking && !actor.flies) hop = Math.abs(Math.sin(actor.t * actor.duration * 0.012)) * 2;
      if (now < actor.hopUntil) hop += Math.sin(((actor.hopUntil - now) / 350) * Math.PI) * 3;
      const x = Math.round(s.sx - img.w / 2);
      const y = Math.round(s.sy - (img.h - 1) - hop);
      const depth = actor.pos.x + actor.pos.y + actor.pos.z;
      sprites.push({ img, x, y, depthTop: depth + (img.h - 1) / 2, depthPerRow: -0.5, alpha: actor.alpha });
      if (actor.state !== "pulang") this.boxes.guest.set(actor.id, { x, y, img });
    }

    for (const p of this.particles) {
      const age = (now - p.born) / 1000;
      if (age < 0) continue;
      const img = particleImage(p.shape);
      const x = p.x + p.vx * age;
      const y = p.y + p.vy * age + 0.5 * p.gravity * age * age;
      const fade = 1 - (now - p.born) / p.life;
      overlays.push({ img, x: Math.round(x - img.w / 2), y: Math.round(y - img.h / 2), depthTop: 0, depthPerRow: 0, alpha: Math.min(1, fade * 2) });
    }

    const out = this.composer.compose(sprites, lightingAt(hourOf(wall), this.scene.glows), overlays);
    if (!this.imageData || this.imageData.width !== out.w || this.imageData.height !== out.h) {
      this.imageData = new ImageData(out.w, out.h);
    }
    this.imageData.data.set(out.data);
    this.ctx.putImageData(this.imageData, 0, 0);
    this.positionBubble();
  }

  // -------------------------------------------------------------------------
  // Klik dan hover

  /** Apa yang ada di bawah kursor (koordinat klien), atau null bila transparan. */
  hitTest(clientX: number, clientY: number): HitResult | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = Math.floor((clientX - rect.left) / this.cssScale);
    const py = Math.floor((clientY - rect.top) / this.cssScale);
    if (px < 0 || py < 0 || px >= this.scene.img.w || py >= this.scene.img.h) return null;
    const inside = (b: Box) => {
      const lx = px - b.x;
      const ly = py - b.y;
      if (lx < 0 || ly < 0 || lx >= b.img.w || ly >= b.img.h) return false;
      return b.img.data[(ly * b.img.w + lx) * 4 + 3] > 0;
    };
    // Tamu di depan diutamakan.
    const guests = [...this.boxes.guest.entries()].sort((a, b) => b[1].y + b[1].img.h - (a[1].y + a[1].img.h));
    for (const [id, box] of guests) if (inside(box)) return { kind: "guest", id };
    if (this.boxes.avatar && inside(this.boxes.avatar)) return { kind: "avatar" };
    const out = this.composer.out;
    return out.data[(py * out.w + px) * 4 + 3] > 0 ? { kind: "room" } : null;
  }

  /** Posisi klien (px) kepala tamu, untuk label. */
  guestClientPos(id: string): { x: number; y: number } | null {
    const box = this.boxes.guest.get(id);
    if (!box) return null;
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (box.x + box.img.w / 2) * this.cssScale, y: rect.top + box.y * this.cssScale };
  }

  /** Apakah barang terpasang (dipakai untuk efek). */
  hasItem(id: string): boolean {
    return !!ITEM_BY_ID[id] && Object.values(this.game.state.room.slots).includes(id);
  }
}
