// Pembantu waktu dan format angka. Semua memakai jam lokal komputer.

import type { DayPart } from "./types";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Tanggal lokal sebagai "YYYY-MM-DD". */
export function dateKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Jam lokal desimal, misalnya 13.5 untuk 13:30. */
export function hourOf(ms: number): number {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
}

export function dayPart(ms: number): DayPart {
  const h = hourOf(ms);
  if (h >= 5 && h < 10) return "pagi";
  if (h >= 10 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
}

/** Malam untuk keperluan tamu: 18:00 sampai 05:59. */
export function isNight(ms: number): boolean {
  const h = hourOf(ms);
  return h >= 18 || h < 6;
}

const NUMBER = new Intl.NumberFormat("id-ID");

export function formatNumber(n: number): string {
  return NUMBER.format(Math.floor(n));
}

/** Angka ringkas: 1.234 → "1.234", 12.345 → "12,3 rb", 1.234.567 → "1,23 jt". */
export function formatShort(n: number): string {
  const v = Math.floor(n);
  if (v < 10_000) return formatNumber(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(1).replace(".", ",")} rb`;
  return `${(v / 1_000_000).toFixed(2).replace(".", ",")} jt`;
}

/** Sisa waktu sebagai "mm:dd" atau "j:mm:dd". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "3 jam 5 menit", "12 menit", "kurang dari semenit". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 1) return "kurang dari semenit";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  return m === 0 ? `${h} jam` : `${h} jam ${m} menit`;
}
