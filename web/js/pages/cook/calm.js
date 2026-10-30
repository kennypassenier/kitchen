// The calm switch: the package's own switch plus one line that says what calm does right now.

import { h } from "../../dom.js";
import { isCalm, calmScope } from "/static/kp/js/calm.js";
import { t } from "../../i18n/index.js";
import { section } from "./parts.js";

export function buildCalm() {
  const calmSwitch = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "ck-calm", "data-kp-calm-switch": "" });
  const calmLine = h("p", { class: "kp-formgrid__value", role: "status" });
  const calmSection = section(
    "ck-calm",
    t("set.calmTitle"),
    t("cook.calmText"),
    h(
      "div",
      { class: "kp-formgrid ck-calm" },
      h(
        "div",
        { class: "kp-formgrid__row" },
        h("label", { class: "kp-formgrid__label", for: "ck-calm" }, t("set.calmTitle")),
        h("div", { class: "kp-formgrid__control" }, h("label", { class: "kp-switch" }, calmSwitch, h("span", null, t("cook.calmSwitch")))),
        calmLine,
      ),
    ),
  );
  return { calmSwitch, calmLine, calmSection };
}

/** Keep the line in step with the package's calm mode; the listener is taken off with the page. @param {import("./index.js").CookCtx} ctx */
export function wireCalm(ctx) {
  const paintCalm = () => {
    const scope = calmScope(document);
    const words = scope === "motion" ? t("cook.scopeMotion") : scope === "all" ? t("cook.scopeAll") : t("cook.scopeEffects");
    const loading = document.documentElement.getAttribute("data-kp-calm-loading") === "still" ? t("cook.loadStill") : t("cook.loadBreathes");
    ctx.el.calmLine.textContent = isCalm(document) ? t("cook.calmOn", words, loading) : t("cook.calmOff");
  };
  document.addEventListener("kp-calm-change", paintCalm);
  ctx.cleanups.push(() => document.removeEventListener("kp-calm-change", paintCalm));
  return paintCalm;
}
