// The photo files of a recipe: made smaller in the browser, sent to /data/photos, deleted again, and tracked per editing
// session. No DOM here but the canvas; the gallery views are in photos.js.
//
// Kenny, 24/10/2026 05:23: a step can carry photos that make it clearer, and the recipe itself one. The server
// (src/photos.rs) keeps the files and issues the id a recipe stores (`step.photos`, `recipe.photo`, docs/agent/DATA.md).
//   - `shrink` draws the picture on a canvas of at most 1600 px on the long side and writes WebP (JPEG where the
//     browser cannot encode WebP), so a phone's 4 MB camera picture travels as a few hundred kB;
//   - `photoTracker` remembers which photos this editing session uploaded and which the recipe had, so Save
//     deletes the ones no longer referenced and Cancel deletes the ones that never got referenced.

import { kitchenNow } from "../api.js";
import { t } from "../i18n/index.js";
import { decode } from "./photo-decode.js";
import { sendRaw, deleteRaw } from "../raw.js";

/** The long side, in pixels, a photo is made smaller to. */
export const MAX_SIDE = 1600;
/**
 * What one photo may weigh when sent. The server's own cap is 4 MiB (src/photos.rs), but the kit refuses any body above
 * `KITCHEN_MAX_BODY_BYTES` (1 MiB unless the operator raises it), so the browser aims below that.
 */
const SEND_BYTES = 1000 * 1000;

/** @param {string} id */
export const photoUrl = (id) => `/data/photos/${encodeURIComponent(id)}`;

/** @param {HTMLCanvasElement} canvas @param {string} type @param {number} quality @returns {Promise<Blob | null>} */
const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** The canvas as WebP (JPEG as the fallback) under SEND_BYTES, at the first quality that fits, or null. @param {HTMLCanvasElement} canvas @returns {Promise<Blob | null>} */
async function encodeUnder(canvas) {
  for (const quality of [0.82, 0.65, 0.5]) {
    // A browser that cannot encode WebP answers with PNG; ask for JPEG then.
    let blob = await encode(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
    if (blob && (blob.type === "image/webp" || blob.type === "image/jpeg") && blob.size <= SEND_BYTES) return blob;
  }
  return null;
}

/**
 * The picture, at most MAX_SIDE px on the long side, as WebP (JPEG as the fallback).
 * @param {File} file @returns {Promise<Blob>}
 */
export async function shrink(file) {
  const source = await decode(file, t("photo.unreadable"));
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t("photo.noCanvas"));
  // Smaller still, step by step, until it fits under SEND_BYTES (a busy photo at 1600 px can be large).
  for (let round = 0; round < 4; round++) {
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await encodeUnder(canvas);
    if (blob) {
      if ("close" in source) source.close();
      return blob;
    }
    scale *= 0.75;
  }
  if ("close" in source) source.close();
  throw new Error(t("photo.tooLarge"));
}

/** Send one picture; resolves to its new id. @param {File} file */
export async function uploadPhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error(t("photo.notPicture", file.name || t("photo.thatFile")));
  const blob = await shrink(file);
  const res = await sendRaw("/data/photos", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }, { dropped: t("photo.dropped"), signedOut: t("photo.signedOut") });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) throw new Error(data?.error ?? t("photo.answered", res.status));
  return /** @type {string} */ (data.id);
}

/** Whether some recipe of the kitchen still refers to this photo (a copy shares the original's files). @param {string} id */
const referenced = (id) => (kitchenNow()?.recipes ?? []).some((r) => photosOf(r).includes(id));

/** Delete a photo file; a photo that is already gone is fine, and one that another recipe (a copy) still shows stays. @param {string} id */
export async function deletePhoto(id) {
  if (referenced(id)) return;
  try {
    await deleteRaw(photoUrl(id));
  } catch {
    /* an orphan file is harmless (docs/agent/DATA.md, known limits) */
  }
}

/** Every photo id a recipe refers to: its own and its steps'. @param {Record<string, any> | null | undefined} recipe @returns {string[]} */
export const photosOf = (recipe) => [recipe?.photo, ...(recipe?.steps ?? []).flatMap((/** @type {any} */ s) => s.photos ?? [])].filter((id) => typeof id === "string" && id !== "");

/**
 * Remembers what one editing session uploaded, so no file is left behind by it.
 * @param {string[]} original the photos the recipe had when the editor opened
 */
export function photoTracker(original) {
  const before = new Set(original);
  /** @type {Set<string>} */
  const uploaded = new Set();
  return {
    /** @param {string} id */
    uploaded: (id) => void uploaded.add(id),
    /** Saved: delete what the recipe no longer refers to. @param {string[]} final */
    settle: async (final) => {
      const keep = new Set(final);
      await Promise.all([...before, ...uploaded].filter((id) => !keep.has(id)).map(deletePhoto));
    },
    /** Cancelled: delete what this session uploaded. */
    discard: async () => {
      await Promise.all([...uploaded].map(deletePhoto));
    },
  };
}
