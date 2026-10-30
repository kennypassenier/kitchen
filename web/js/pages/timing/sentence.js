// The sentence "We eat at … so start at …, cook … with … to spare": its frame, saving what it says, and the late note.

import { h, $ } from "../../dom.js";
import { patchSettings } from "../../api.js";
import { attachTimes, setTime } from "/static/kp/js/timefield.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { attachSentences, sentence, setSentenceWhy } from "/static/kp/js/sentence.js";
import { t } from "../../i18n/index.js";
import { button } from "../../ui/cards.js";
import { MIN, SPARES, hm, at } from "./plan.js";
import { words, startsInWords } from "./text.js";

/** @param {import("./index.js").TimingCtx} ctx */
export function createSentence(ctx) {
  const { root, recipeId, cleanups, state, current } = ctx;
  /** @type {Promise<unknown>} */
  let saving = Promise.resolve();
  // ---- the sentence's frame ------------------------------------------------------------------------------------
  /** @type {HTMLElement | null} */
  let form = null;
  let eatEl = /** @type {HTMLElement | null} */ (null);
  let startEl = /** @type {HTMLElement | null} */ (null);
  let paceEl = /** @type {HTMLSelectElement | null} */ (null);
  let spareEl = /** @type {HTMLSelectElement | null} */ (null);
  const readout = h("p", { class: "tm-readout tm-readout--sentence", id: "tm-sentence-readout", role: "status" });
  const late = h("div", { class: "kp-alert kp-alert--info tm-late", id: "tm-late", hidden: true });
  const lateTitle = h("strong");
  const lateText = h("span");
  const lateGo = button("", "kp-button--sm");
  late.append(h("div", { class: "kp-alert__body" }, lateTitle, " ", lateText), lateGo);

  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-sentence-card-data", root));
    const field = (/** @type {string} */ inner) => `<span class="kp-sentence__field">${inner}</span>`;
    data.innerHTML =
      `<form class="kp-sentence" data-kp-sentence id="tm-sentence" data-kp-look="underline" data-kp-sentence-size="lg" aria-label="${t("timing.title")}">` +
      `<p class="kp-sentence__text">${t("timing.sWeEat")} ` +
      field(`<span class="kp-time" id="tm-eat" data-kp-time data-kp-time-look="inline" data-kp-label="${t("timing.sWeEatLabel")}" data-kp-name="eat" data-kp-value="18:30" data-kp-time-step="5" data-kp-time-min="16:00" data-kp-time-max="22:00" data-kp-time-presets="${t("timing.early")}=18:00,${t("timing.usual")}=18:30,${t("timing.late")}=19:30"></span>`) +
      `${t("timing.sSoStart")} ` +
      field(`<span class="kp-time" id="tm-start" data-kp-time data-kp-time-look="inline" data-kp-label="${t("timing.sStartLabel")}" data-kp-name="start" data-kp-value="17:40" data-kp-time-step="5"></span>`) +
      `. ${t("timing.sCook")} ` +
      field(`<select name="pace" aria-label="${t("timing.paceLabel")}" id="tm-pace"><option value="normal">${t("timing.paceNormal")}</option><option value="slow">${t("timing.paceSlow")}</option></select>`) +
      ` ${t("timing.sPaceAnd")} ` +
      field(`<select name="spare" aria-label="${t("timing.spareLabel")}" id="tm-spare">${SPARES.map((n) => `<option value="${n}">${n === 0 ? t("timing.noTime") : t("timing.minutes", n)}</option>`).join("")}</select>`) +
      ` ${t("timing.sSpare")}</p></form>`;
    data.append(readout, late);
    form = /** @type {HTMLElement} */ ($("#tm-sentence", data));
    eatEl = /** @type {HTMLElement} */ ($("#tm-eat", data));
    startEl = /** @type {HTMLElement} */ ($("#tm-start", data));
    paceEl = /** @type {HTMLSelectElement} */ ($("#tm-pace", data));
    spareEl = /** @type {HTMLSelectElement} */ ($("#tm-spare", data));
    form.addEventListener("submit", (event) => event.preventDefault());
    cleanups.push(attachTimes(form), attachSelects(form), attachSentences(form));
  }

  /** Save settings one after the other, and say so in the sentence when they could not be saved. @param {Record<string, unknown>} patch */
  function save(patch) {
    saving = saving.then(async () => {
      try {
        await patchSettings(patch);
        if (form) setSentenceWhy(form, null);
      } catch (e) {
        if (form) setSentenceWhy(form, t("timing.notSaved", e instanceof Error ? e.message : String(e)));
      }
    });
  }

  /** Dinner moves to `ms`; shown and saved. @param {number} ms */
  function moveDinner(ms) {
    state.eat = hm(ms);
    if (eatEl) setTime(eatEl, state.eat);
    save({ dinner_time: state.eat });
    state.dropped.clear();
    ctx.snoozedUntil = null;
    ctx.view.draw();
  }

  function drawSentence() {
    const p = current();
    if (!p || !startEl || !spareEl || !paceEl) return;
    setTime(startEl, hm(p.start));
    const lanes = t("timing.trackCount", p.lanes.length);
    readout.textContent = `${t("timing.ofCooking", words(Math.round(p.total / MIN)), lanes)} ${startsInWords(p)}`;
    const passed = Date.now() >= p.start;
    late.hidden = !passed;
    if (passed) {
      const newServe = Date.now() + p.total + state.spare * MIN;
      lateTitle.textContent = t("timing.passed", hm(p.start));
      lateText.textContent = t("timing.startNow", hm(newServe), state.eat);
      lateGo.textContent = t("timing.eatAtInstead", hm(newServe));
      lateGo.dataset.serve = String(newServe);
    }
    if (form) sentence(form)?.refresh();
  }
  // ---- the sentence's behaviour ---------------------------------------------------------------------------------
  if (form && eatEl && startEl && paceEl && spareEl) {
    const onTime = (/** @type {Event} */ event) => {
      const { value } = /** @type {CustomEvent} */ (event).detail;
      if (!value || !ctx.recipe) return;
      const source = /** @type {HTMLElement} */ (event.target).closest("[data-kp-time]");
      if (source === eatEl) {
        if (value === state.eat) return;
        state.eat = value;
        save({ dinner_time: value });
      } else if (source === startEl) {
        const p = current();
        if (!p || value === hm(p.start)) return;
        // The start was typed: dinner is where the steps and the spare time end after it.
        state.eat = hm(at(value) + p.total + state.spare * MIN);
        if (eatEl) setTime(eatEl, state.eat);
        save({ dinner_time: state.eat });
      }
      state.dropped.clear();
      ctx.snoozedUntil = null;
      ctx.view.draw();
    };
    const onChange = (/** @type {Event} */ event) => {
      if (event.target === paceEl) {
        state.pace = paceEl?.value === "slow" ? "slow" : "normal";
        save({ pace: state.pace });
      } else if (event.target === spareEl) {
        state.spare = Number(spareEl?.value);
        save({ spare: state.spare });
      } else return;
      ctx.view.draw();
    };
    form.addEventListener("kp-time-change", onTime);
    form.addEventListener("change", onChange);
    lateGo.addEventListener("click", () => moveDinner(Number(lateGo.dataset.serve)));
  }
  return { form, eatEl, startEl, paceEl, spareEl, draw: drawSentence, moveDinner };
}
