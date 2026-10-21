//! Sisi native Teman Kerja: jendela transparan di pojok layar, klik tembus, ikon
//! tray, penyembunyian otomatis saat ada aplikasi layar penuh, file simpanan,
//! pemberitahuan akhir sesi fokus, jalankan saat komputer menyala, dan penghitung
//! ketukan keyboard agar avatar ikut mengetik (hanya jumlahnya, bukan tombolnya).

use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_notification::NotificationExt;

const MAIN: &str = "main";
/// Ukuran bawaan jendela, piksel logis (kamar di pojok, sisanya ruang panel).
const DEFAULT_W: f64 = 940.0;
const DEFAULT_H: f64 = 760.0;

#[derive(Default)]
struct Visibility {
    /// Disembunyikan pengguna lewat tray atau tombol "Sembunyikan".
    user_hidden: AtomicBool,
    /// Disembunyikan otomatis karena ada aplikasi layar penuh.
    auto_hidden: AtomicBool,
    /// Pengguna menampilkan jendela saat aplikasi layar penuh aktif: jangan
    /// disembunyikan otomatis sampai keadaan layar penuh berakhir.
    forced_visible: AtomicBool,
}

type SharedVisibility = Arc<Visibility>;

/// Pojok tempat jendela ditempel; diingat agar tray/monitor baru memakai pojok yang sama.
#[derive(Clone, Copy)]
struct Dock {
    left: bool,
    width: f64,
    height: f64,
}

type SharedDock = Arc<Mutex<Dock>>;

#[derive(Serialize)]
struct CursorInfo {
    /// Posisi kursor relatif terhadap jendela, piksel logis (sama dengan koordinat CSS).
    x: f64,
    y: f64,
    inside: bool,
}

// ---------------------------------------------------------------------------
// Jendela

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

/// Tempelkan jendela ke pojok kanan bawah atau kiri bawah area kerja (di atas taskbar/Dock).
fn dock(window: &WebviewWindow, d: Dock) -> tauri::Result<()> {
    let monitor = match window.current_monitor()? {
        Some(m) => m,
        None => match window.primary_monitor()? {
            Some(m) => m,
            None => return Ok(()),
        },
    };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let w = ((d.width * scale).round() as u32).min(area.size.width);
    let h = ((d.height * scale).round() as u32).min(area.size.height);
    window.set_size(PhysicalSize::new(w, h))?;
    let x = if d.left {
        area.position.x
    } else {
        area.position.x + area.size.width as i32 - w as i32
    };
    window.set_position(PhysicalPosition::new(x, area.position.y + area.size.height as i32 - h as i32))?;
    Ok(())
}

#[tauri::command]
fn dock_window(window: WebviewWindow, state: State<'_, SharedDock>, corner: String, width: f64, height: f64) -> Result<(), String> {
    let d = Dock {
        left: corner == "kiri",
        width: width.clamp(400.0, 2000.0),
        height: height.clamp(300.0, 2000.0),
    };
    *state.lock().unwrap_or_else(|e| e.into_inner()) = d;
    dock(&window, d).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, ignore: bool) -> Result<(), String> {
    // Di Linux jendela yang belum tampil belum punya permukaan; abaikan dengan aman.
    if !window.is_visible().unwrap_or(false) {
        return Ok(());
    }
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

/// Tampilkan jendela lalu pasang lagi klik tembus. Urutannya penting:
/// di Linux, klik tembus hanya bisa dipasang setelah jendela tampil.
fn show_window(window: &WebviewWindow) -> tauri::Result<()> {
    window.show()?;
    window.set_ignore_cursor_events(true)
}

#[tauri::command]
fn cursor_in_window(window: WebviewWindow) -> Result<CursorInfo, String> {
    let cursor = window.cursor_position().map_err(|e| e.to_string())?;
    let pos = window.inner_position().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let rx = cursor.x - pos.x as f64;
    let ry = cursor.y - pos.y as f64;
    let inside = rx >= 0.0 && ry >= 0.0 && rx < size.width as f64 && ry < size.height as f64;
    Ok(CursorInfo {
        x: rx / scale,
        y: ry / scale,
        inside,
    })
}

fn set_user_hidden(app: &AppHandle, vis: &Visibility, hidden: bool) {
    vis.user_hidden.store(hidden, Ordering::SeqCst);
    if !hidden {
        vis.auto_hidden.store(false, Ordering::SeqCst);
        vis.forced_visible.store(platform::fullscreen_app_active(), Ordering::SeqCst);
    }
    if let Some(w) = main_window(app) {
        if hidden {
            let _ = w.hide();
        } else {
            let d = *app.state::<SharedDock>().lock().unwrap_or_else(|e| e.into_inner());
            let _ = dock(&w, d);
            let _ = show_window(&w);
        }
    }
    let _ = app.emit("visibility-changed", !hidden);
}

fn toggle_visibility(app: &AppHandle) {
    let vis = app.state::<SharedVisibility>();
    let visible = main_window(app).and_then(|w| w.is_visible().ok()).unwrap_or(false);
    set_user_hidden(app, &vis, visible);
}

#[tauri::command]
fn window_visible(window: WebviewWindow) -> bool {
    window.is_visible().unwrap_or(true)
}

#[tauri::command]
fn hide_window(app: AppHandle, vis: State<'_, SharedVisibility>) {
    set_user_hidden(&app, &vis, true);
}

/// Munculkan lagi jendela yang disembunyikan pengguna.
#[tauri::command]
fn show_window_cmd(app: AppHandle, vis: State<'_, SharedVisibility>) {
    if vis.user_hidden.load(Ordering::SeqCst) {
        set_user_hidden(&app, &vis, false);
    }
}

/// Keluar dengan rapi; bila ada layanan sistem yang menahan proses (misalnya tray
/// tanpa DBus di Linux), proses dihentikan paksa setelah jeda singkat.
fn exit_app(app: &AppHandle) {
    app.exit(0);
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(1500));
        std::process::exit(0);
    });
}

/// Minta frontend menyimpan dulu; bila tidak menjawab dalam 2 detik, keluar tetap jalan.
fn request_quit(app: &AppHandle) {
    let _ = app.emit("request-quit", ());
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(2));
        exit_app(&handle);
    });
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    exit_app(&app);
}

// ---------------------------------------------------------------------------
// File simpanan: save.json + cadangan save.json.bak di folder data aplikasi.

fn save_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("save.json"))
}

fn read_if_exists(path: &PathBuf) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn load_save(app: AppHandle) -> Result<Option<String>, String> {
    read_if_exists(&save_path(&app)?)
}

#[tauri::command]
fn load_backup(app: AppHandle) -> Result<Option<String>, String> {
    read_if_exists(&save_path(&app)?.with_extension("json.bak"))
}

/// Simpanan yang tidak bisa dipakai disalin ke save-rusak-<waktu>.json (dan .bak)
/// sebelum permainan baru menyimpan di atasnya.
#[tauri::command]
fn preserve_broken_save(app: AppHandle) -> Result<(), String> {
    let path = save_path(&app)?;
    let stamp = now_ms() as u64;
    for (from, suffix) in [(path.clone(), "json"), (path.with_extension("json.bak"), "bak.json")] {
        if from.exists() {
            let to = path.with_file_name(format!("save-rusak-{stamp}.{suffix}"));
            std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn write_save(app: AppHandle, data: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&data).map_err(|e| format!("data simpanan tidak valid: {e}"))?;
    let path = save_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        file.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        // Pastikan isi benar-benar di disk sebelum menggantikan simpanan lama.
        file.sync_all().map_err(|e| e.to_string())?;
    }
    // Simpanan lama yang valid menjadi cadangan. Bila proses berhenti di antara dua
    // rename, load_save kosong dan frontend memakai cadangan.
    if let Ok(Some(old)) = read_if_exists(&path) {
        if serde_json::from_str::<serde_json::Value>(&old).is_ok() {
            std::fs::rename(&path, path.with_extension("json.bak")).map_err(|e| e.to_string())?;
        }
    }
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Jadwal pemberitahuan (akhir sesi fokus). Pengecekan waktu dilakukan di sini,
// bukan di halaman web, karena timer JavaScript diperlambat saat jendela tersembunyi.

#[derive(Deserialize, Clone)]
struct DueItem {
    key: String,
    /// Waktu berbunyi, ms sejak epoch.
    at: f64,
    title: String,
    body: String,
    notify: bool,
}

#[derive(Default)]
struct ScheduleInner {
    items: Vec<DueItem>,
    /// Kunci yang sudah berbunyi (dengan waktunya), agar jadwal yang dikirim ulang
    /// sebelum halaman sempat memprosesnya tidak berbunyi dua kali.
    fired: HashMap<String, f64>,
}

#[derive(Default)]
struct Schedule(Mutex<ScheduleInner>);

type SharedSchedule = Arc<Schedule>;

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}

#[tauri::command]
fn set_schedule(items: Vec<DueItem>, schedule: State<'_, SharedSchedule>) {
    let mut inner = schedule.0.lock().unwrap_or_else(|e| e.into_inner());
    // Jadwal yang sudah jatuh tempo tetapi belum sempat berbunyi tetap dipertahankan:
    // halaman bisa saja mengirim jadwal baru (misalnya istirahat) sedetik lebih dulu.
    let now = now_ms();
    let mut kept: Vec<DueItem> = std::mem::take(&mut inner.items).into_iter().filter(|i| i.at <= now).collect();
    for item in items {
        if !inner.fired.contains_key(&item.key) && !kept.iter().any(|k| k.key == item.key) {
            kept.push(item);
        }
    }
    inner.items = kept;
}

fn spawn_scheduler(app: AppHandle, schedule: SharedSchedule) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1000));
        let now = now_ms();
        let due: Vec<DueItem> = {
            let mut inner = schedule.0.lock().unwrap_or_else(|e| e.into_inner());
            let items = std::mem::take(&mut inner.items);
            let (due, rest): (Vec<DueItem>, Vec<DueItem>) = items.into_iter().partition(|i| i.at <= now);
            inner.items = rest;
            if !due.is_empty() {
                inner.fired.retain(|_, at| now - *at < 86_400_000.0);
                for item in &due {
                    inner.fired.insert(item.key.clone(), now);
                }
            }
            due
        };
        for item in due {
            if item.notify {
                let _ = app.notification().builder().title(&item.title).body(&item.body).show();
            }
            let _ = app.emit("schedule-due", item.key);
        }
    });
}

// ---------------------------------------------------------------------------
// Jalankan saat komputer menyala

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| e.to_string())?;
    Ok(launcher.is_enabled().unwrap_or(enabled))
}

// ---------------------------------------------------------------------------
// Deteksi aplikasi layar penuh (game, presentasi, video)

#[cfg(windows)]
mod platform {
    use windows_sys::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUERY_USER_NOTIFICATION_STATE, QUNS_BUSY, QUNS_PRESENTATION_MODE,
        QUNS_RUNNING_D3D_FULL_SCREEN,
    };

    pub fn fullscreen_app_active() -> bool {
        let mut state: QUERY_USER_NOTIFICATION_STATE = 0;
        let hr = unsafe { SHQueryUserNotificationState(&mut state) };
        hr >= 0 && matches!(state, QUNS_BUSY | QUNS_RUNNING_D3D_FULL_SCREEN | QUNS_PRESENTATION_MODE)
    }
}

#[cfg(not(windows))]
mod platform {
    /// Belum diimplementasikan di macOS/Linux; jendela tetap tampil.
    pub fn fullscreen_app_active() -> bool {
        false
    }
}

fn spawn_fullscreen_watcher(app: AppHandle, vis: SharedVisibility) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1500));
        let Some(window) = main_window(&app) else { continue };
        let user_hidden = vis.user_hidden.load(Ordering::SeqCst);
        if platform::fullscreen_app_active() {
            let forced = vis.forced_visible.load(Ordering::SeqCst);
            if !user_hidden && !forced && !vis.auto_hidden.swap(true, Ordering::SeqCst) {
                let _ = window.hide();
                let _ = app.emit("visibility-changed", false);
            }
            continue;
        }
        vis.forced_visible.store(false, Ordering::SeqCst);
        if vis.auto_hidden.swap(false, Ordering::SeqCst) && !user_hidden {
            let _ = show_window(&window);
            let _ = app.emit("visibility-changed", true);
        }
    });
}

// ---------------------------------------------------------------------------
// Avatar ikut mengetik: hitung ketukan keyboard di seluruh sistem.
// Hanya JUMLAH yang dicatat. Tombol apa yang ditekan tidak disimpan, tidak dikirim
// ke halaman, dan tidak pernah keluar dari komputer. Pengait dilepas saat fitur dimatikan.

/// Ketukan yang belum dikirim ke halaman.
static TAPS: AtomicU32 = AtomicU32::new(0);

#[cfg(windows)]
mod input_hook {
    use super::TAPS;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Mutex;
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, PeekMessageW, PostThreadMessageW, SetWindowsHookExW,
        TranslateMessage, UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, LLKHF_INJECTED, MSG, PM_NOREMOVE,
        WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    /// Waktu (ms sejak boot, dari Windows) tombol terakhir kali turun; 0 = sedang tidak ditekan.
    /// Tombol yang ditahan mengirim key-down berulang (auto-repeat) dan hanya dihitung
    /// sekali. Bila key-up tidak pernah sampai (layar kunci, Ctrl+Alt+Del, jendela
    /// admin), jeda lebih dari 1 detik dianggap tekanan baru.
    static LAST_DOWN: [AtomicU32; 256] = {
        #[allow(clippy::declare_interior_mutable_const)]
        const UP: AtomicU32 = AtomicU32::new(0);
        [UP; 256]
    };
    const REPEAT_GAP_MS: u32 = 1000;
    /// Id thread pengait; 0 = tidak berjalan.
    static THREAD: AtomicU32 = AtomicU32::new(0);
    static LOCK: Mutex<()> = Mutex::new(());

    unsafe extern "system" fn keyboard(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 && lparam != 0 {
            let info = &*(lparam as *const KBDLLHOOKSTRUCT);
            let slot = &LAST_DOWN[(info.vkCode & 0xff) as usize];
            match wparam as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => {
                    let now = info.time.max(1);
                    let before = slot.swap(now, Ordering::Relaxed);
                    let fresh = before == 0 || now.wrapping_sub(before) > REPEAT_GAP_MS;
                    // Ketukan buatan program (makro) tidak dihitung.
                    if fresh && info.flags & LLKHF_INJECTED == 0 {
                        TAPS.fetch_add(1, Ordering::Relaxed);
                    }
                }
                WM_KEYUP | WM_SYSKEYUP => slot.store(0, Ordering::Relaxed),
                _ => {}
            }
        }
        CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
    }

    /// Pasang atau lepas pengait. Mengembalikan true bila pengait sedang terpasang.
    pub fn set_enabled(enabled: bool) -> bool {
        let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let running = THREAD.load(Ordering::SeqCst);
        if !enabled {
            if running != 0 {
                // Thread pengait keluar dari loop pesan lalu melepas pengaitnya.
                unsafe { PostThreadMessageW(running, WM_QUIT, 0, 0) };
                THREAD.store(0, Ordering::SeqCst);
            }
            return false;
        }
        if running != 0 {
            return true;
        }
        let (tx, rx) = std::sync::mpsc::channel::<bool>();
        std::thread::spawn(move || unsafe {
            let module = GetModuleHandleW(std::ptr::null());
            let kb = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard), module, 0);
            if kb.is_null() {
                let _ = tx.send(false);
                return;
            }
            // Pastikan antrean pesan thread ini ada sebelum id-nya diumumkan,
            // agar WM_QUIT dari set_enabled(false) pasti diterima.
            let mut msg: MSG = std::mem::zeroed();
            PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
            THREAD.store(GetCurrentThreadId(), Ordering::SeqCst);
            let _ = tx.send(true);
            // Pengait tingkat rendah butuh loop pesan di thread yang memasangnya.
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            UnhookWindowsHookEx(kb);
            for slot in &LAST_DOWN {
                slot.store(0, Ordering::Relaxed);
            }
        });
        rx.recv().unwrap_or(false)
    }
}

/// macOS: event tap "hanya mendengar" untuk tombol keyboard. Butuh izin
/// Input Monitoring (System Settings → Privacy & Security). Tanpa izin, macOS
/// diminta menampilkan permintaan izin, dan halaman diberi tahu bahwa pengait belum aktif.
#[cfg(target_os = "macos")]
mod input_hook {
    use super::TAPS;
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};
    use std::sync::Mutex;

    type CFMachPortRef = *mut c_void;
    type CFRunLoopSourceRef = *mut c_void;
    type CFRunLoopRef = *mut c_void;
    type CFStringRef = *const c_void;
    type CGEventRef = *mut c_void;
    type CGEventTapProxy = *mut c_void;
    type CGEventTapCallBack = extern "C" fn(CGEventTapProxy, u32, CGEventRef, *mut c_void) -> CGEventRef;

    const K_CG_SESSION_EVENT_TAP: u32 = 1;
    const K_CG_HEAD_INSERT_EVENT_TAP: u32 = 0;
    const K_CG_EVENT_TAP_OPTION_LISTEN_ONLY: u32 = 1;
    const K_CG_EVENT_KEY_DOWN: u32 = 10;
    const K_CG_EVENT_TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
    const K_CG_EVENT_TAP_DISABLED_BY_USER_INPUT: u32 = 0xFFFF_FFFF;
    const K_CG_KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            events_of_interest: u64,
            callback: CGEventTapCallBack,
            user_info: *mut c_void,
        ) -> CFMachPortRef;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
        fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
        fn CGPreflightListenEventAccess() -> bool;
        fn CGRequestListenEventAccess() -> bool;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        static kCFRunLoopCommonModes: CFStringRef;
        fn CFMachPortCreateRunLoopSource(alloc: *const c_void, port: CFMachPortRef, order: isize) -> CFRunLoopSourceRef;
        fn CFRunLoopGetCurrent() -> CFRunLoopRef;
        fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
        fn CFRunLoopRun();
        fn CFRunLoopStop(rl: CFRunLoopRef);
        fn CFRetain(cf: *const c_void) -> *const c_void;
        fn CFRelease(cf: *const c_void);
        fn CFMachPortInvalidate(port: CFMachPortRef);
    }

    /// Run loop thread pengait (0 = tidak berjalan; disimpan dengan CFRetain) dan port tap
    /// untuk diaktifkan ulang.
    static RUN_LOOP: AtomicUsize = AtomicUsize::new(0);
    static TAP: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
    static LOCK: Mutex<()> = Mutex::new(());

    extern "C" fn callback(_proxy: CGEventTapProxy, kind: u32, event: CGEventRef, _info: *mut c_void) -> CGEventRef {
        match kind {
            K_CG_EVENT_KEY_DOWN => {
                // Tombol yang ditahan (auto-repeat) hanya dihitung sekali.
                let repeat = unsafe { CGEventGetIntegerValueField(event, K_CG_KEYBOARD_EVENT_AUTOREPEAT) };
                if repeat == 0 {
                    TAPS.fetch_add(1, Ordering::Relaxed);
                }
            }
            // macOS mematikan tap yang dianggap lambat; nyalakan lagi.
            K_CG_EVENT_TAP_DISABLED_BY_TIMEOUT | K_CG_EVENT_TAP_DISABLED_BY_USER_INPUT => {
                let tap = TAP.load(Ordering::SeqCst);
                if !tap.is_null() {
                    unsafe { CGEventTapEnable(tap, true) };
                }
            }
            _ => {}
        }
        event
    }

    pub fn set_enabled(enabled: bool) -> bool {
        let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let running = RUN_LOOP.load(Ordering::SeqCst);
        if !enabled {
            let rl = RUN_LOOP.swap(0, Ordering::SeqCst);
            if rl != 0 {
                unsafe {
                    CFRunLoopStop(rl as CFRunLoopRef);
                    CFRelease(rl as *const c_void);
                }
            }
            return false;
        }
        if running != 0 {
            return true;
        }
        // Tanpa izin Input Monitoring, minta izin (macOS menampilkan dialognya sekali).
        if !unsafe { CGPreflightListenEventAccess() } {
            unsafe { CGRequestListenEventAccess() };
            return false;
        }
        let (tx, rx) = std::sync::mpsc::channel::<bool>();
        std::thread::spawn(move || unsafe {
            let mask: u64 = 1 << K_CG_EVENT_KEY_DOWN;
            let tap = CGEventTapCreate(
                K_CG_SESSION_EVENT_TAP,
                K_CG_HEAD_INSERT_EVENT_TAP,
                K_CG_EVENT_TAP_OPTION_LISTEN_ONLY,
                mask,
                callback,
                std::ptr::null_mut(),
            );
            if tap.is_null() {
                let _ = tx.send(false);
                return;
            }
            let source = CFMachPortCreateRunLoopSource(std::ptr::null(), tap, 0);
            if source.is_null() {
                CFRelease(tap as *const c_void);
                let _ = tx.send(false);
                return;
            }
            let rl = CFRunLoopGetCurrent();
            CFRunLoopAddSource(rl, source, kCFRunLoopCommonModes);
            CGEventTapEnable(tap, true);
            TAP.store(tap, Ordering::SeqCst);
            // Run loop ditahan (retain) selama alamatnya disimpan, agar CFRunLoopStop
            // dari thread lain tidak pernah menyentuh memori yang sudah dilepas.
            CFRetain(rl as *const c_void);
            RUN_LOOP.store(rl as usize, Ordering::SeqCst);
            let _ = tx.send(true);
            CFRunLoopRun();
            // Run loop berhenti (dihentikan, atau sumbernya hilang sendiri): bereskan.
            {
                let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
                if RUN_LOOP
                    .compare_exchange(rl as usize, 0, Ordering::SeqCst, Ordering::SeqCst)
                    .is_ok()
                {
                    CFRelease(rl as *const c_void);
                }
                let _ = TAP.compare_exchange(tap, std::ptr::null_mut(), Ordering::SeqCst, Ordering::SeqCst);
            }
            CGEventTapEnable(tap, false);
            CFMachPortInvalidate(tap);
            CFRelease(source as *const c_void);
            CFRelease(tap as *const c_void);
        });
        rx.recv().unwrap_or(false)
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod input_hook {
    /// Belum ada di Linux; halaman memakai ketukan di dalam jendela sendiri.
    pub fn set_enabled(_enabled: bool) -> bool {
        false
    }
}

/// Nyalakan/matikan penghitung ketukan. true bila penghitung seluruh sistem aktif.
#[tauri::command]
fn set_typing_hook(enabled: bool) -> bool {
    input_hook::set_enabled(enabled)
}

/// Kirim jumlah ketukan ke halaman beberapa kali per detik.
fn spawn_tap_emitter(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(100));
        let taps = TAPS.swap(0, Ordering::Relaxed);
        if taps > 0 {
            let _ = app.emit("input-taps", taps);
        }
    });
}

// ---------------------------------------------------------------------------
// Tray

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Tampilkan / sembunyikan", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Teman Kerja")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_visibility(app),
            "quit" => request_quit(app),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let visibility: SharedVisibility = Arc::new(Visibility::default());
    let schedule: SharedSchedule = Arc::new(Schedule::default());
    let docked: SharedDock = Arc::new(Mutex::new(Dock {
        left: false,
        width: DEFAULT_W,
        height: DEFAULT_H,
    }));

    tauri::Builder::default()
        // Membuka aplikasi kedua kali cukup menampilkan jendela yang sudah ada.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let vis = app.state::<SharedVisibility>();
            set_user_hidden(app, &vis, false);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(visibility.clone())
        .manage(schedule.clone())
        .manage(docked.clone())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                request_quit(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            dock_window,
            set_click_through,
            cursor_in_window,
            hide_window,
            show_window_cmd,
            window_visible,
            quit_app,
            load_save,
            load_backup,
            write_save,
            preserve_broken_save,
            set_schedule,
            set_typing_hook,
            get_autostart,
            set_autostart,
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            build_tray(app)?;
            if let Some(window) = app.get_webview_window(MAIN) {
                let d = *docked.lock().unwrap_or_else(|e| e.into_inner());
                dock(&window, d)?;
                show_window(&window)?;
            }
            spawn_fullscreen_watcher(app.handle().clone(), visibility.clone());
            spawn_scheduler(app.handle().clone(), schedule.clone());
            spawn_tap_emitter(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Teman Kerja");
}
