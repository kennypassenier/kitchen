// The list of edits the kitchen refused on replay (feat-offline-kitchen). Kenny's kit decision (02/11/2026,
// "Overslaan"): a refused edit goes to the kit's failed list and the rest of the queue continues. The kit raises a toast
// with "Review" (`chassis-data-review`), but draws no list (chassis-rs 4.2.0 + cd68fd9); this is that list, in the
// kit's drawer (`dialog.kp-drawer`, as cook mode's More sheet): per edit what it changed, when, why, and two choices,
// "Keep the kitchen's version" (kit `drop`) or "Save mine over it" (kit `resave`, with the server's current revision).

import { h } from "../dom.js";
import { closeDialog } from "/static/kp/dist/js/motion.js";
import { toast } from "/static/kp/dist/js/overlays.js";
import { kitData } from "../api/kit-data.js";
import { kitchenNow } from "../api.js";
import { lang, t } from "../i18n/index.js";
import { whatOf, whenOf, whyOf } from "./describe.js";

/** The kit's event behind its toast's "Review" button. */
export const REVIEW_EVENT = "chassis-data-review";

/** @typedef {import("../api/kit-data.js").KitEntry} KitEntry */

/** The drawer, made once and kept in the body (closed between uses). @type {HTMLDialogElement | null} */
let sheet = null;

function drawerOf() {
  if (sheet?.isConnected) return sheet;
  sheet = /** @type {HTMLDialogElement} */ (
    h(
      "dialog",
      { class: "kp-drawer kp-dialog off-failed", id: "off-failed", "aria-labelledby": "off-failed-t" },
      h(
        "header",
        { class: "kp-drawer__head" },
        h("h2", { class: "kp-dialog__title", id: "off-failed-t" }, t("off.failedTitle")),
        h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("off.failedClose"), "data-off-close": "" }, "✕"),
        h("p", { class: "kp-drawer__desc" }, t("off.failedText")),
      ),
      h("div", { class: "kp-drawer__body", id: "off-failed-body" }),
    )
  );
  const close = () => void closeDialog(/** @type {HTMLDialogElement} */ (sheet));
  sheet.querySelector("[data-off-close]")?.addEventListener("click", close);
  sheet.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  document.body.append(sheet);
  return sheet;
}

/**
 * One refused edit as a row of the kit's form grid: what and when, why, and its two actions.
 * @param {KitEntry} entry @param {() => Promise<void>} redraw
 */
function rowOf(entry, redraw) {
  const what = whatOf(entry, kitchenNow(), t, lang());
  const act = (/** @type {"drop" | "resave"} */ how) => async () => {
    try {
      const kit = await kitData();
      const done = how === "drop" ? await kit.drop(entry.id) : await kit.resave(entry.id);
      if (done) toast(t(how === "drop" ? "off.failedDropped" : "off.failedResaved"), { live: "polite" });
    } catch (e) {
      console.warn(`Kitchen: ${how} of refused edit ${entry.id} failed`, e);
      toast(t("off.failedActionFailed", e instanceof Error ? e.message : String(e)), { live: "assertive", sticky: true });
    }
    await redraw();
  };
  const drop = h("button", { type: "button", class: "kp-button kp-button--sm", title: t("off.failedDropHint"), onclick: act("drop") }, t("off.failedDrop"));
  const resave = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary", title: t("off.failedResaveHint"), onclick: act("resave") }, t("off.failedResave"));
  return h(
    "div",
    { class: "kp-formgrid__row" },
    h("div", { class: "kp-formgrid__label" }, h("strong", null, what), h("small", null, whenOf(entry, t))),
    h("div", { class: "kp-formgrid__value" }, h("p", null, whyOf(entry, t))),
    h("div", { class: "kp-formgrid__actions kp-row-actions" }, drop, resave),
  );
}

/** Fill the drawer's body from the kit's failed list: rows, the empty state, or the failed state. */
async function draw() {
  const body = /** @type {HTMLElement} */ (drawerOf().querySelector("#off-failed-body"));
  let failed;
  try {
    failed = await (await kitData()).failed();
  } catch (e) {
    console.warn("Kitchen: the list of refused edits could not be read", e);
    body.replaceChildren(h("div", { class: "kp-alert kp-alert--destructive", role: "alert" }, h("p", null, t("off.failedReadFailed"))));
    return;
  }
  if (!failed.length) {
    body.replaceChildren(h("div", { class: "kp-empty" }, h("p", { class: "kp-empty__text" }, t("off.failedEmpty"))));
    return;
  }
  const grid = h("div", { class: "kp-formgrid", "data-kp-formgrid-lines": "lines", "data-kp-formgrid-align": "center" });
  grid.append(...failed.map((entry) => rowOf(entry, draw)));
  body.replaceChildren(grid);
}

/** Open the list (the kit's toast's "Review"). */
export async function openFailedList() {
  const dialog = drawerOf();
  await draw();
  if (!dialog.open) dialog.showModal();
}

/** Open the list on the kit's review event; returns the clean-up. */
export function wireFailedList() {
  const onReview = () => void openFailedList().catch((e) => console.warn("Kitchen: the list of refused edits could not be opened", e));
  addEventListener(REVIEW_EVENT, onReview);
  return () => removeEventListener(REVIEW_EVENT, onReview);
}
