// The More sheet of the full-viewport cook stage (Kenny, 01/11/2026 20:21, "Volledig scherm"): everything that is not the
// step in hand lives here, in the kit's drawer (`dialog.kp-drawer`), so the stage keeps the step, Back/Next and the
// running timers only. The sheet holds the links (back to the recipe, the other version), Begin with the mise en place,
// the timeline, the timer discs and calm mode, each with its heading and one sentence. The sections stay in the page
// while the sheet is closed, so the kit's components keep running (discs, the timeline's ticker); the timeline is drawn
// again when the sheet opens, because a closed dialog has no width to draw in.

import { h, $ } from "../../dom.js";
import { closeDialog } from "/static/kp/dist/js/motion.js";
import { motionAllowed } from "/static/kp/dist/js/calm.js";
import { t } from "../../i18n/index.js";
import { sheetTarget } from "./stage-state.js";

/** @param {HTMLElement[]} sections the sheet's sections, in order */
export function buildMore(sections) {
  const links = h("div", { class: "ck-more__links kp-formgrid__buttons" });
  const sheet = /** @type {HTMLDialogElement} */ (
    h(
      "dialog",
      { class: "kp-drawer kp-dialog ck-more", id: "ck-more", "aria-labelledby": "ck-more-t" },
      h(
        "header",
        { class: "kp-drawer__head" },
        h("h2", { class: "kp-dialog__title", id: "ck-more-t" }, t("cook.moreTitle")),
        h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("cook.moreClose"), "data-ck-close": "" }, "✕"),
        h("p", { class: "kp-drawer__desc" }, t("cook.moreText")),
      ),
      h("div", { class: "kp-drawer__body ck-more__body" }, links, ...sections),
    )
  );
  const moreBtn = h("button", { type: "button", class: "kp-button", "aria-haspopup": "dialog", "aria-controls": "ck-more" }, t("cook.more"));
  const gatherBtn = h("button", { type: "button", class: "kp-button kp-button--ghost", "aria-haspopup": "dialog", "aria-controls": "ck-more" }, t("cook.gather"));
  return { sheet, moreBtn, gatherBtn, moreLinks: links };
}

/** Open the sheet on one of its sections (or its top); the timeline is drawn once the sheet has its width. @param {import("./index.js").CookCtx} ctx @param {string | null} [target] */
export function openMore(ctx, target = null) {
  const { sheet } = ctx.el;
  if (!sheet.open) sheet.showModal();
  ctx.view.paintTimeline();
  const ids = [...sheet.querySelectorAll(".ck-more__body > section[id]")].map((s) => s.id);
  const id = sheetTarget(target, ids);
  const el = id ? $(`#${id}`, sheet) : null;
  if (el && target) el.scrollIntoView({ block: "start", behavior: motionAllowed(el) ? "smooth" : "auto" });
  else sheet.querySelector(".ck-more__body")?.scrollTo({ top: 0 });
}

/** Close the sheet; the focus goes back to the step. @param {import("./index.js").CookCtx} ctx */
export async function closeMore(ctx) {
  const { sheet, steps } = ctx.el;
  if (sheet.open) await closeDialog(sheet);
  steps.focus({ preventScroll: true });
}

/** @param {import("./index.js").CookCtx} ctx */
export function wireMore(ctx) {
  const { sheet, moreBtn, gatherBtn } = ctx.el;
  moreBtn.addEventListener("click", () => openMore(ctx));
  gatherBtn.addEventListener("click", () => openMore(ctx, "ck-begin"));
  sheet.querySelector("[data-ck-close]")?.addEventListener("click", () => void closeMore(ctx));
  sheet.addEventListener("cancel", (e) => {
    e.preventDefault();
    void closeMore(ctx);
  });
}
