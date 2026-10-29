// Photos on recipes: made smaller in the browser, sent to /data/photos, shown and edited as kp-galleries.
//
// Kenny, 24/10/2026 05:23: a step can carry photos that make it clearer, and the recipe itself one. The
// server (src/photos.rs) keeps the files and issues the id a recipe stores (`step.photos`, `recipe.photo`,
// docs/agent/DATA.md). This module is the browser half:
//   - `shrink` draws the picture on a canvas of at most 1600 px on the long side and writes WebP (JPEG where the
//     browser cannot encode WebP), so a phone's 4 MB camera picture travels as a few hundred kB;
//   - `photoField` is the editor's field: the package's gallery (thumbnails, the Add tile whose picker offers the
//     camera on a phone, a press opens the picture large) and, under it, Earlier / Later / Remove per photo;
//   - `showPhotos` is the same gallery read-only, for the recipe page and cook mode;
//   - `photoTracker` remembers which photos this editing session uploaded and which the recipe had, so Save
//     deletes the ones no longer referenced and Cancel deletes the ones that never got referenced.

import { h } from "../dom.js";
import { setGallery, setGalleryUploading, GALLERY_ADD_EVENT } from "/static/kp/js/gallery.js";
import { toast } from "/static/kp/js/overlays.js";
import { kitchenNow } from "../api.js";
import { t } from "../i18n/index.js";

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

/**
 * The picture, at most MAX_SIDE px on the long side, as WebP (JPEG as the fallback).
 * @param {File} file @returns {Promise<Blob>}
 */
export async function shrink(file) {
  /** @type {ImageBitmap | HTMLImageElement} */
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t("photo.unreadable")));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
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
    for (const quality of [0.82, 0.65, 0.5]) {
      // A browser that cannot encode WebP answers with PNG; ask for JPEG then.
      let blob = await encode(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
      if (blob && (blob.type === "image/webp" || blob.type === "image/jpeg") && blob.size <= SEND_BYTES) {
        if ("close" in source) source.close();
        return blob;
      }
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
  let res;
  try {
    res = await fetch("/data/photos", { method: "POST", headers: { "Content-Type": blob.type }, body: blob, credentials: "same-origin" });
  } catch {
    throw new Error(t("photo.dropped"));
  }
  if (res.status === 401) {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error(t("photo.signedOut"));
  }
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
    await fetch(photoUrl(id), { method: "DELETE", credentials: "same-origin" });
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

/** @param {string[]} ids @param {string} label */
const itemsOf = (ids, label) => ids.map((id, i) => ({ id, src: photoUrl(id), alt: `${label} ${i + 1}` }));

/** Gallery options both uses share: no address hash (several galleries on a page), no caption. @param {Record<string, string>} [more] */
const galleryEl = (label, more = {}) =>
  h("div", { class: "kp-gallery rp-photos", "data-kp-gallery": "", "data-kp-lightbox-hash": "off", "data-kp-caption": "none", "aria-label": label, ...more });

/**
 * Pictures shown read-only: thumbnails that open large. Fills `el` (made if missing) and returns it.
 * @param {HTMLElement | null} el @param {string[]} ids @param {string} label
 */
export function showPhotos(el, ids, label) {
  const gallery = el ?? galleryEl(label);
  setGallery(gallery, { items: itemsOf(ids, label), state: "ready", label });
  return gallery;
}

/**
 * The editor's photo field. `compact` is the step line's strip (Kenny, 29/10/2026): no Add tile, the field is hidden while
 * it holds no photo, and `pick()` opens the picker (the camera button on the step's first line calls it).
 * @param {{ ids: string[], max: number, label: string, tracker: ReturnType<typeof photoTracker>, compact?: boolean }} spec
 */
export function photoField({ ids, max, label, tracker, compact = false }) {
  let list = [...ids];
  const gallery = galleryEl(label, compact ? {} : { "data-kp-grid-columns": "3" });
  const controls = h("ul", { class: "rp-photoedit", "aria-label": t("photo.orderRemoval", label) });
  let busy = false;

  /** @param {string} id @param {string} act */
  const focusOn = (id, act) => {
    const row = controls.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const wanted = row?.querySelector(`[data-act="${act}"]:not(:disabled)`) ?? row?.querySelector("button:not(:disabled)");
    /** @type {HTMLElement | null} */ (wanted)?.focus();
  };

  /** @param {string} id @param {number} by */
  const move = (id, by) => {
    const i = list.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    paint();
    focusOn(id, by < 0 ? "earlier" : "later");
  };

  function paint() {
    setGallery(gallery, { items: itemsOf(list, label), state: "ready", add: !compact && list.length < max, label });
    wrap.hidden = compact && list.length === 0;
    if (busy) setGalleryUploading(gallery, t("photo.sending"));
    controls.hidden = list.length === 0;
    // The editor's step line counts its photos (Kenny, 29/10/2026).
    gallery.dispatchEvent(new CustomEvent("rl-photos-change", { bubbles: true, detail: { count: list.length } }));
    controls.replaceChildren(
      ...list.map((id, i) => {
        const button = (/** @type {string} */ act, /** @type {string} */ text, /** @type {string} */ extra = "") =>
          h("button", { type: "button", class: `kp-button kp-button--sm ${extra}`.trim(), "data-act": act, "aria-label": `${text}: ${label} ${i + 1}` }, text);
        const earlier = button("earlier", t("photo.earlier"));
        const later = button("later", t("photo.later"));
        const remove = button("remove", t("photo.remove"), "kp-button--ghost");
        /** @type {HTMLButtonElement} */ (earlier).disabled = i === 0;
        /** @type {HTMLButtonElement} */ (later).disabled = i === list.length - 1;
        earlier.addEventListener("click", () => move(id, -1));
        later.addEventListener("click", () => move(id, 1));
        remove.addEventListener("click", () => {
          list = list.filter((x) => x !== id);
          paint();
          /** @type {HTMLElement | null} */ (gallery.querySelector(".kp-gallery__open, .kp-gallery__add"))?.focus();
        });
        return h("li", { class: "rp-photoedit__row", "data-id": id }, h("span", { class: "rp-photoedit__name" }, t("photo.name", i + 1)), h("span", { class: "rp-photoedit__buttons" }, earlier, later, remove));
      }),
    );
  }

  /** @param {File[]} picked */
  const addFiles = (picked) => {
    if (busy) return;
    const files = picked.slice(0, Math.max(0, max - list.length));
    void (async () => {
      busy = true;
      setGalleryUploading(gallery, t("photo.sending"));
      for (const file of files) {
        try {
          const id = await uploadPhoto(file);
          tracker.uploaded(id);
          list.push(id);
          paint();
        } catch (e) {
          toast(t("photo.notAdded", e instanceof Error ? e.message : String(e)), { live: "assertive", sticky: true });
        }
      }
      busy = false;
      paint();
    })();
  };
  gallery.addEventListener(GALLERY_ADD_EVENT, (event) => addFiles(/** @type {CustomEvent} */ (event).detail.files));
  // The camera button's picker: a phone offers the camera or the library, a PC the file chooser.
  const chooser = /** @type {HTMLInputElement} */ (h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, tabindex: "-1", "aria-hidden": "true" }));
  chooser.addEventListener("change", () => {
    addFiles([...(chooser.files ?? [])]);
    chooser.value = "";
  });
  const wrap = h("div", { class: "rp-photofield" }, gallery, controls, chooser);

  paint();
  return { el: wrap, get: () => [...list], pick: () => (list.length < max ? chooser.click() : undefined), full: () => list.length >= max };
}
