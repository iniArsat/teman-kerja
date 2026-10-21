// Mengubah gambar piksel menjadi data URL untuk elemen <img>, dengan cache.

import { animalFrames, animalSilhouette } from "../render/animals";
import { renderAvatar, type AvatarPose } from "../render/avatar";
import { blit, createImage, type PixelImage } from "../render/pixel";
import { itemThumb, themeThumb } from "../render/thumbs";
import type { AvatarState } from "../core/types";

export function toDataUrl(img: PixelImage, scale = 1): string {
  const base = document.createElement("canvas");
  base.width = img.w;
  base.height = img.h;
  base.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
  if (scale === 1) return base.toDataURL("image/png");
  const big = document.createElement("canvas");
  big.width = img.w * scale;
  big.height = img.h * scale;
  const ctx = big.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, big.width, big.height);
  return big.toDataURL("image/png");
}

const cache = new Map<string, string>();

function cached(key: string, make: () => PixelImage, scale: number): string {
  const k = `${key}@${scale}`;
  let url = cache.get(k);
  if (!url) {
    url = toDataUrl(make(), scale);
    cache.set(k, url);
  }
  return url;
}

export function itemUrl(id: string, scale = 2): string {
  return cached(`item:${id}`, () => itemThumb(id), scale);
}

export function themeUrl(id: string, scale = 2): string {
  return cached(`theme:${id}`, () => themeThumb(id), scale);
}

export function animalUrl(id: string, scale = 3): string {
  return cached(`animal:${id}`, () => animalFrames(id).idle, scale);
}

export function silhouetteUrl(id: string, scale = 3): string {
  return cached(`sil:${id}`, () => animalSilhouette(id), scale);
}

/** Potret avatar (tanpa cache, karena gayanya sering berganti di panel). */
export function avatarUrl(avatar: AvatarState, scale = 4, pose: AvatarPose = "lambai"): string {
  const frame = renderAvatar(avatar, pose, "senang");
  const img = createImage(frame.body.w, frame.body.h - 6);
  blit(img, frame.body, 0, 0);
  blit(img, frame.arms, 0, 0);
  return toDataUrl(img, scale);
}
