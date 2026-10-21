// Titik masuk: menyambungkan inti game, tampilan kamar, antarmuka, suara, dan jembatan desktop.

import "./ui/style.css";
import { CHEERS, GUEST_BY_ID } from "./core/data";
import { Game } from "./core/game";
import { AutoSaver, loadState } from "./core/save";
import { MINUTE } from "./core/time";
import { ClickThroughController, htmlHitTest } from "./platform/clickThrough";
import {
  createSaveBackend,
  dockWindow,
  getAutostart,
  hideWindow,
  isMac,
  isTauri,
  setAutostart,
  onInputTaps,
  onQuitRequested,
  onScheduleDue,
  onVisibilityChanged,
  quitApp,
  setClickThrough,
  setSchedule,
  setTypingHook,
} from "./platform/desktop";
import { RoomView } from "./render/scene";
import { configureSound, playSound, setRadioPaused, setRadioVolume, setStation, unlockAudio } from "./ui/sound";
import { setTypingHelp } from "./ui/panels";
import { UI } from "./ui/ui";

async function main(): Promise<void> {
  const backend = createSaveBackend();
  const { state, fresh, problem } = await loadState(backend, Date.now());
  const game = new Game(state);
  const report = game.catchUp(Date.now());
  // Simpanan lama yang rusak diamankan dulu; bila gagal dibaca, jangan menimpa apa pun.
  let saveBlocked = problem === "gagal-baca";
  if (problem === "rusak") {
    try {
      await backend.preserveBroken?.();
    } catch (err) {
      console.error("Gagal mengamankan simpanan rusak.", err);
      saveBlocked = true;
    }
  }
  const saver = new AutoSaver(saveBlocked ? { load: async () => null, save: async () => {} } : backend, () => game.state, 30_000);

  if (!isTauri) document.body.classList.add("browser");

  const view = new RoomView(game);
  let typingWide = false;
  let typingSupported = isTauri;
  let visible = true;
  let autostart = await getAutostart();

  const applySound = () => {
    configureSound(game.state.settings.sound, game.state.settings.volume);
    setRadioVolume(game.state.radio.volume);
    setStation(game.state.radio.station);
  };
  applySound();
  // Browser biasa baru mengizinkan suara setelah interaksi pertama.
  window.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
      setStation(game.state.radio.station);
    },
    { capture: true, once: true },
  );

  // Pengait ketikan hanya terpasang saat fitur menyala DAN jendela tampil.
  const applyTyping = async () => {
    typingWide = await setTypingHook(game.state.typing.enabled && visible);
  };

  const ui = new UI(game, view, {
    setCorner: (corner) => {
      game.updateSettings({ corner });
      ui.applyCorner();
      void dockWindow(corner);
    },
    setScale: (scale) => {
      game.updateSettings({ scale });
      view.setScale(scale);
    },
    setTyping: (enabled) => {
      game.setTypingEnabled(enabled);
      void checkTyping().then(() => ui.refresh("atur"));
    },
    playStation: (id) => {
      unlockAudio();
      game.setStation(id);
    },
    hide: () => {
      void saver.saveNow();
      void hideWindow();
    },
    quit: async () => {
      await saver.saveNow();
      await quitApp();
    },
    typingSupported: () => typingSupported,
    autostart: () => autostart,
    setAutostart: (enabled) => {
      void setAutostart(enabled).then((v) => {
        autostart = v;
        ui.refresh("atur");
      });
    },
  });

  const handleTaps = (count: number) => {
    const now = Date.now();
    game.addTaps(count, now);
    view.onTaps(count);
  };
  await onInputTaps(handleTaps);
  // Ketukan di jendela sendiri (misalnya mengetik tugas) saat pengait sistem tidak aktif.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!typingWide && !e.repeat && game.state.typing.enabled) handleTaps(1);
    },
    { capture: true },
  );
  if (isMac) {
    setTypingHelp(
      "Penghitung belum aktif. Izinkan Teman Kerja di System Settings → Privacy & Security → Input Monitoring, lalu buka ulang aplikasinya.",
    );
  }
  // Pengait sistem tersedia di Windows dan macOS; bila gagal dipasang, beri tahu pemain.
  const checkTyping = async () => {
    await applyTyping();
    typingSupported = !isTauri ? false : !(game.state.typing.enabled && visible && !typingWide);
    if (isTauri && isMac && game.state.typing.enabled && !typingWide) {
      ui.toast("Agar avatar ikut mengetik di Mac, izinkan Teman Kerja di Privacy & Security → Input Monitoring, lalu buka ulang.", 10000);
    }
  };
  await checkTyping();

  // ---------------------------------------------------------------------------
  // Event game -> tampilan dan antarmuka

  game.on("coins", () => ui.coinsChanged());
  game.on("arrive", ({ visit, first }) => {
    view.guestArrived();
    playSound(first ? "baru" : "datang");
    if (first) ui.showNewGuest(visit.guestId);
    ui.refresh("buku");
  });
  game.on("leave", ({ visit, tip, gift }) => {
    view.guestLeft(visit.guestId, tip, gift);
    if (gift > 0) {
      playSound("koin");
      ui.toast(`${GUEST_BY_ID[visit.guestId]?.name} meninggalkan hadiah ${gift} koin!`);
    }
    ui.refresh("buku");
  });
  game.on("room", () => {
    view.refreshRoom();
    ui.refresh("kamar", "toko");
  });
  game.on("owned", () => ui.refresh("toko", "kamar", "gaya"));
  game.on("avatar", () => {
    view.avatarChanged();
    ui.refresh("gaya");
  });
  game.on("todos", () => ui.refresh("tugas"));
  game.on("radio", () => {
    setRadioVolume(game.state.radio.volume);
    setStation(game.state.radio.station);
  });
  game.on("settings", () => {
    configureSound(game.state.settings.sound, game.state.settings.volume);
    scheduleNotifications();
    ui.refresh("atur");
  });
  game.on("typing", () => ui.refresh("atur"));
  game.on("focus", () => {
    scheduleNotifications();
    ui.refresh("fokus");
    ui.updateHud(Date.now());
  });
  game.on("focusDone", ({ coins }) => {
    playSound("fokus");
    view.perform("regang", "senang", 2500);
    view.celebrate();
    view.floatAtAvatar(`+${coins}`, "coin");
    view.say("Sesi fokus selesai! Istirahat dulu, yuk.", 6000);
  });
  game.on("breakDone", () => {
    playSound("istirahat");
    view.say("Istirahat selesai. Siap lanjut?", 6000);
  });

  // Pemberitahuan sistem untuk akhir sesi fokus (berbunyi walau jendela tersembunyi).
  function scheduleNotifications(): void {
    const f = game.state.focus;
    if (!game.state.settings.notify || f.endsAt === null || f.phase === "siap") {
      void setSchedule([]);
      return;
    }
    const focusing = f.phase === "fokus";
    void setSchedule([
      {
        key: `fokus:${f.phase}:${f.endsAt}`,
        at: f.endsAt,
        title: focusing ? "Sesi fokus selesai" : "Istirahat selesai",
        body: focusing ? `Kerja bagus! Istirahat ${f.breakMin} menit dulu.` : "Siap untuk sesi fokus berikutnya?",
        notify: true,
      },
    ]);
  }
  scheduleNotifications();
  await onScheduleDue(() => game.tick(Date.now()));

  // ---------------------------------------------------------------------------
  // Putaran utama

  const loop = () => {
    requestAnimationFrame(loop);
    try {
      if (visible) view.frame();
    } catch (err) {
      console.error("Gagal menggambar kamar.", err);
    }
  };
  requestAnimationFrame(loop);
  window.setInterval(() => {
    const now = Date.now();
    const res = game.tick(now);
    if (res.caughtUp) {
      // Komputer baru bangun dari tidur: samakan tamu tanpa animasi dan beri ringkasan.
      view.syncGuests(performance.now(), false);
      ui.refresh();
      if (res.report) ui.showAwayReport(res.report);
    }
    ui.updateHud(now);
  }, 1000);
  saver.start();

  // Kata penyemangat sesekali.
  let nextCheer = Date.now() + (fresh ? 3 : 12) * MINUTE;
  window.setInterval(() => {
    const now = Date.now();
    if (!game.state.settings.cheers || now < nextCheer || !visible) return;
    nextCheer = now + (25 + Math.random() * 25) * MINUTE;
    view.say(CHEERS[Math.floor(Math.random() * CHEERS.length)], 7000);
  }, 30_000);

  // Sambutan dan laporan saat dibuka.
  if (problem === "gagal-baca") {
    window.setTimeout(
      () => ui.toast("Simpanan tidak bisa dibaca. Progres tidak disimpan dulu agar data lama aman. Coba tutup lalu buka lagi Teman Kerja.", 15000),
      1200,
    );
  } else if (problem === "rusak") {
    window.setTimeout(
      () =>
        ui.toast(
          saveBlocked
            ? "Simpanan rusak dan tidak bisa diamankan. Progres tidak disimpan dulu."
            : "Simpanan lama rusak, jadi permainan dimulai baru. Salinannya disimpan sebagai save-rusak-*.json di folder data.",
          15000,
        ),
      1200,
    );
  } else if (fresh) {
    window.setTimeout(() => view.say("Halo! Ini kamar kerjamu. Tamu pertama sebentar lagi datang.", 7000), 1500);
  } else if (report) {
    window.setTimeout(() => ui.showAwayReport(report), 1200);
  } else {
    window.setTimeout(() => view.say("Selamat datang kembali!", 4000), 1200);
  }

  // Izin penghitung ketukan: tanyakan sekali, setelah pemain sempat melihat kamar.
  if (!game.state.typing.asked) {
    window.setTimeout(
      () =>
        !game.state.typing.asked &&
        ui.askTyping((yes) => {
          game.setTypingEnabled(yes);
          void checkTyping();
          if (yes) {
            playSound("centang");
            view.say("Asyik! Coba ketik sesuatu di mana saja.", 6000);
          }
        }, isTauri),
      fresh ? 9000 : 3000,
    );
  }

  const clickThrough = new ClickThroughController(
    (x, y) => htmlHitTest(x, y) || view.hitTest(x, y) !== null,
    () => {},
  );
  clickThrough.start();

  await onVisibilityChanged((v) => {
    visible = v;
    // Radio berhenti saat jendela disembunyikan (misalnya saat game layar penuh).
    setRadioPaused(!v);
    void applyTyping();
    if (v) clickThrough.reset();
    else void saver.saveNow();
  });
  await onQuitRequested(async () => {
    await saver.saveNow();
    await quitApp();
  });
  window.addEventListener("beforeunload", () => void saver.saveNow());
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // Hanya saat pengembangan: akses dari konsol, misalnya tk.game.state.coins = 1e5.
  if (import.meta.env.DEV) Object.assign(window, { tk: { game, view, ui } });

  await dockWindow(game.state.settings.corner);
  void setClickThrough(true);
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Teman Kerja gagal dimulai: ${String(err)}`;
});
