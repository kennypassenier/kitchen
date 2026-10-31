// Photos on recipes, shown and edited as kp-galleries. The files themselves (made smaller in the browser, sent to
// /data/photos, deleted, tracked per editing session) are in photo-files.js and re-exported here.
//   - `photoField` is the editor's field: the package's gallery (thumbnails, the Add tile whose picker offers the
//     camera on a phone, a press opens the picture large) and, under it, Earlier / Later / Remove per photo;
//   - `showPhotos` is the same gallery read-only, for the recipe page and cook mode.

import { h } from "../dom.js";
import { setGallery, setGalleryUploading, GALLERY_ADD_EVENT, holdFootprint, toast } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../i18n/index.js";
import { photoUrl, uploadPhoto, photoTracker } from "./photo-files.js";

export { MAX_SIDE, photoUrl, shrink, uploadPhoto, deletePhoto, photosOf, photoTracker } from "./photo-files.js";

/** @param {string[]} ids @param {string} label */
const itemsOf = (ids, label) => ids.map((id, i) => ({ id, src: photoUrl(id), alt: `${label} ${i + 1}` }));

/** Gallery options both uses share: no address hash (several galleries on a page), no caption. @param {Record<string, string>} [more] */
const galleryEl = (label, more = {}) => {
  const el = h("div", { class: "kp-gallery rp-photos", "data-kp-gallery": "", "data-kp-lightbox-hash": "off", "data-kp-caption": "none", "aria-label": label, ...more });
  // The package's footprint (Kenny, 29/10/2026: the photo section collapsed when empty, loading or failed): the gallery keeps
  // the height it had while ready under its loading, empty and failed plates. Apps attach it themselves; auto.js only does
  // the hosts that were in the page at load.
  holdFootprint(el);
  return el;
};

/**
 * Pictures shown read-only: thumbnails that open large. Fills `el` (made if missing) and returns it.
 * @param {HTMLElement | null} el @param {string[]} ids @param {string} label
 */
export function showPhotos(el, ids, label) {
  const gallery = el ?? galleryEl(label);
  setGallery(gallery, { items: itemsOf(ids, label), state: "ready", label });
  return gallery;
}

/** @typedef {{ list: string[], gallery: HTMLElement, controls: HTMLElement, wrap: HTMLElement, busy: boolean, max: number, label: string, compact: boolean, tracker: ReturnType<typeof photoTracker> }} FieldState */

/** @param {FieldState} f @param {string} id @param {string} act */
function focusOn(f, id, act) {
  const row = f.controls.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const wanted = row?.querySelector(`[data-act="${act}"]:not(:disabled)`) ?? row?.querySelector("button:not(:disabled)");
  /** @type {HTMLElement | null} */ (wanted)?.focus();
}

/** @param {FieldState} f @param {string} id @param {number} by */
function move(f, id, by) {
  const i = f.list.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= f.list.length) return;
  [f.list[i], f.list[j]] = [f.list[j], f.list[i]];
  paint(f);
  focusOn(f, id, by < 0 ? "earlier" : "later");
}

/** Earlier / Later / Remove for one photo. @param {FieldState} f @param {string} id @param {number} i */
function controlRow(f, id, i) {
  const button = (/** @type {string} */ act, /** @type {string} */ text, /** @type {string} */ extra = "") =>
    h("button", { type: "button", class: `kp-button kp-button--sm ${extra}`.trim(), "data-act": act, "aria-label": `${text}: ${f.label} ${i + 1}` }, text);
  const earlier = button("earlier", t("photo.earlier"));
  const later = button("later", t("photo.later"));
  const remove = button("remove", t("photo.remove"), "kp-button--ghost");
  /** @type {HTMLButtonElement} */ (earlier).disabled = i === 0;
  /** @type {HTMLButtonElement} */ (later).disabled = i === f.list.length - 1;
  earlier.addEventListener("click", () => move(f, id, -1));
  later.addEventListener("click", () => move(f, id, 1));
  remove.addEventListener("click", () => {
    f.list = f.list.filter((x) => x !== id);
    paint(f);
    /** @type {HTMLElement | null} */ (f.gallery.querySelector(".kp-gallery__open, .kp-gallery__add"))?.focus();
  });
  return h("li", { class: "rp-photoedit__row", "data-id": id }, h("span", { class: "rp-photoedit__name" }, t("photo.name", i + 1)), h("span", { class: "rp-photoedit__buttons" }, earlier, later, remove));
}

/** @param {FieldState} f */
function paint(f) {
  setGallery(f.gallery, { items: itemsOf(f.list, f.label), state: "ready", add: !f.compact && f.list.length < f.max, label: f.label });
  f.wrap.hidden = f.compact && f.list.length === 0;
  if (f.busy) setGalleryUploading(f.gallery, t("photo.sending"));
  f.controls.hidden = f.list.length === 0;
  // The editor's step line counts its photos (Kenny, 29/10/2026).
  f.gallery.dispatchEvent(new CustomEvent("rl-photos-change", { bubbles: true, detail: { count: f.list.length } }));
  f.controls.replaceChildren(...f.list.map((id, i) => controlRow(f, id, i)));
}

/** Send the picked files one after the other, and show each as it arrives. @param {FieldState} f @param {File[]} picked */
function addFiles(f, picked) {
  if (f.busy) return;
  const files = picked.slice(0, Math.max(0, f.max - f.list.length));
  void (async () => {
    f.busy = true;
    setGalleryUploading(f.gallery, t("photo.sending"));
    for (const file of files) {
      try {
        const id = await uploadPhoto(file);
        f.tracker.uploaded(id);
        f.list.push(id);
        paint(f);
      } catch (e) {
        toast(t("photo.notAdded", e instanceof Error ? e.message : String(e)), { live: "assertive", sticky: true });
      }
    }
    f.busy = false;
    paint(f);
  })();
}

/**
 * The editor's photo field. `compact` is the step line's strip (Kenny, 29/10/2026): no Add tile, the field is hidden while
 * it holds no photo, and `pick()` opens the picker (the camera button on the step's first line calls it).
 * @param {{ ids: string[], max: number, label: string, tracker: ReturnType<typeof photoTracker>, compact?: boolean }} spec
 */
export function photoField({ ids, max, label, tracker, compact = false }) {
  const gallery = galleryEl(label, compact ? {} : { "data-kp-grid-columns": "3" });
  const controls = h("ul", { class: "rp-photoedit", "aria-label": t("photo.orderRemoval", label) });
  // The camera button's picker: a phone offers the camera or the library, a PC the file chooser.
  const chooser = /** @type {HTMLInputElement} */ (h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, tabindex: "-1", "aria-hidden": "true" }));
  const wrap = h("div", { class: "rp-photofield" }, gallery, controls, chooser);
  /** @type {FieldState} */
  const f = { list: [...ids], gallery, controls, wrap, busy: false, max, label, compact, tracker };
  gallery.addEventListener(GALLERY_ADD_EVENT, (event) => addFiles(f, /** @type {CustomEvent} */ (event).detail.files));
  chooser.addEventListener("change", () => {
    addFiles(f, [...(chooser.files ?? [])]);
    chooser.value = "";
  });
  paint(f);
  return { el: wrap, get: () => [...f.list], set: (/** @type {string[]} */ v) => { f.list = v.slice(0, max); paint(f); }, pick: () => (f.list.length < max ? chooser.click() : undefined), full: () => f.list.length >= max };
}
