// The cover-photo offer of an imported recipe (Kenny, 29/10/2026 14:27): "Use this photo as the cover?". The page the
// recipe came from offered a picture, but nothing is loaded from that site until Yes is pressed, and then not by the
// browser: the kitchen fetches it (POST /data/import/image, src/import.rs, the same safe fetch as the page), the browser
// makes it smaller and sends it through the ordinary photo upload (recipe/photos.js `uploadPhoto`), and the id it gets
// is the recipe's photo. No third-party image ever reaches the browser, so the site learns nothing about who reads it.

import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { uploadPhoto, showPhotos } from "./photos.js";
import { t } from "../i18n/index.js";
import { sendRaw } from "../raw.js";

/** The words for an import failure's code. @param {string} code */
export const importReason = (code) => {
  const key = `imp.err.${code}`;
  const word = t(key);
  return word === key ? t("imp.err.other") : word;
};

/**
 * The picture at `url`, fetched by the kitchen, as a File the photo upload takes.
 * @param {string} url @returns {Promise<File>}
 */
export async function fetchCover(url) {
  const res = await sendRaw("/data/import/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }, { dropped: t("photo.dropped"), signedOut: t("photo.signedOut") });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(importReason(String(data?.error ?? "")));
  }
  const blob = await res.blob();
  return new File([blob], "cover", { type: blob.type });
}

let serial = 0;

/**
 * The card above the editor's form. `picked(id)` is called with the new photo's id once it is uploaded.
 * @param {{ url: string, picked: (id: string) => void }} spec
 */
export function coverCard({ url, picked }) {
  const n = ++serial;
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    /* shown as written */
  }
  const yes = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("imp.coverYes"));
  const no = h("button", { type: "button", class: "kp-button" }, t("imp.coverNo"));
  const data = h("div", { class: "kp-card__data" }, h("div", { class: "kp-row-actions" }, yes, no));
  const card = h(
    "section",
    { class: "kp-card ri-cover", "data-kp-state": "ready", "aria-labelledby": `ri-cover-t-${n}`, "data-kp-loading-words": t("imp.coverLoading") },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: `ri-cover-t-${n}` }, t("imp.coverTitle"))),
    h("p", { class: "kp-card__body" }, t("imp.coverText", host)),
    h("div", { class: "kp-card__stage" }, data),
  );
  attachCardStates(card);

  const use = async () => {
    setCardState(card, "loading", { words: t("imp.coverLoading") });
    try {
      const id = await uploadPhoto(await fetchCover(url));
      picked(id);
      data.replaceChildren(showPhotos(null, [id], t("imp.coverTitle")), h("p", { class: "ri-cover__done", role: "status" }, t("imp.coverDone")));
      setCardState(card, "ready");
    } catch (e) {
      setCardState(card, "error", { title: t("imp.coverFail"), text: e instanceof Error ? e.message : String(e) });
    }
  };
  yes.addEventListener("click", () => void use());
  no.addEventListener("click", () => card.remove());
  card.addEventListener(CARD_RETRY_EVENT, () => void use());
  return card;
}
