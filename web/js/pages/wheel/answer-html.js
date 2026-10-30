// The answer column of the wheel card (the one wheel component, web/eten/dishwheel.js, gives the wheel itself and an empty
// answer element; this fills it): the kicker, the dish, the side, facts, why, timing, the three buttons and the resting list.

import { t } from "../../i18n/index.js";

/** One action: its button and the sentence that says what it does. @param {string} key @param {string} cls @param {string} reason @param {string} label @param {string} says */
const action = (key, cls, reason, label, says) => `
              <div class="wl-action">
                <button type="button" class="kp-button${cls}" data-wl="${key}" disabled data-kp-disabled-reason="${reason}">${label}</button>
                ${says}
              </div>`;

export const answerHtml = () => `
          <div class="wl-result" role="group" aria-label="${t("wheel.answerLabel")}">
            <p class="wl-result__kicker" data-wl="kicker"></p>
            <p class="wl-result__name" data-wl="name"></p>
            <p class="wl-result__side" data-wl="sideline"></p>
            <div class="wl-result__facts" data-wl="facts"></div>
            <p class="wl-result__why" data-wl="why"></p>
            <p class="wl-result__timing" data-wl="timing"></p>
            <p class="wl-result__others" data-wl="others"></p>
            <div class="wl-actions">${action("yes", " kp-button--primary", t("wheel.spinFirst"), t("wheel.yes"), `<p>${t("wheel.yesSays")}</p>`)}${action("again", "", t("wheel.dishesLoading"), t("wheel.again"), `<p>${t("wheel.againSays")}</p>`)}${action("skip", "", t("wheel.spinFirstSkip"), t("wheel.skip"), '<p data-wl="skip-says"></p>')}
            </div>
            <div class="wl-resting">
              <p class="wl-resting__label" data-wl="rest"></p>
              <div class="wl-resting__list" data-wl="resting"></div>
            </div>
            <p class="wl-live" role="status" data-wl="live"></p>
          </div>`;
