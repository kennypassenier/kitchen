// The sentence "We eat at … so start at …, cook … with … to spare": its frame, saving what it says, and the late note.

import { h, $ } from "../../dom.js";
import { patchSettings } from "../../api.js";
import { attachTimes, setTime, attachSelects, attachSentences, sentence, setSentenceWhy } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { button } from "../../ui/cards.js";
import { MIN, SPARES, hm, at } from "./plan.js";
import { words, startsInWords } from "./text.js";

/**
 * @typedef {object} SentenceParts
 * @property {HTMLElement | null} form
 * @property {HTMLElement | null} eatEl
 * @property {HTMLElement | null} startEl
 * @property {HTMLSelectElement | null} paceEl
 * @property {HTMLSelectElement | null} spareEl
 * @property {HTMLElement} readout
 * @property {HTMLElement} late
 * @property {HTMLElement} lateTitle
 * @property {HTMLElement} lateText
 * @property {HTMLElement} lateGo
 * @property {Promise<unknown>} saving Saves go one after the other.
 */

/** The sentence's HTML: dinner time, start time, pace and time to spare as fields in a line. */
function sentenceMarkup() {
  const field = (/** @type {string} */ inner) => `<span class="kp-sentence__field">${inner}</span>`;
  return (
    `<form class="kp-sentence" data-kp-sentence id="tm-sentence" data-kp-look="underline" data-kp-sentence-size="lg" aria-label="${t("timing.title")}">` +
    `<p class="kp-sentence__text">${t("timing.sWeEat")} ` +
    field(`<span class="kp-time" id="tm-eat" data-kp-time data-kp-time-look="inline" data-kp-label="${t("timing.sWeEatLabel")}" data-kp-name="eat" data-kp-value="18:30" data-kp-time-step="5" data-kp-time-min="16:00" data-kp-time-max="22:00" data-kp-time-presets="${t("timing.early")}=18:00,${t("timing.usual")}=18:30,${t("timing.late")}=19:30"></span>`) +
    `${t("timing.sSoStart")} ` +
    field(`<span class="kp-time" id="tm-start" data-kp-time data-kp-time-look="inline" data-kp-label="${t("timing.sStartLabel")}" data-kp-name="start" data-kp-value="17:40" data-kp-time-step="5"></span>`) +
    `. ${t("timing.sCook")} ` +
    field(`<select name="pace" aria-label="${t("timing.paceLabel")}" id="tm-pace"><option value="normal">${t("timing.paceNormal")}</option><option value="slow">${t("timing.paceSlow")}</option></select>`) +
    ` ${t("timing.sPaceAnd")} ` +
    field(`<select name="spare" aria-label="${t("timing.spareLabel")}" id="tm-spare">${SPARES.map((n) => `<option value="${n}">${n === 0 ? t("timing.noTime") : t("timing.minutes", n)}</option>`).join("")}</select>`) +
    ` ${t("timing.sSpare")}</p></form>`
  );
}

/** The parts that exist without a recipe: the readout and the late note. @returns {SentenceParts} */
function emptyParts() {
  const late = h("div", { class: "kp-alert kp-alert--info tm-late", id: "tm-late", hidden: true });
  const lateTitle = h("strong");
  const lateText = h("span");
  const lateGo = button("", "kp-button--sm");
  late.append(h("div", { class: "kp-alert__body" }, lateTitle, " ", lateText), lateGo);
  const readout = h("p", { class: "tm-readout tm-readout--sentence", id: "tm-sentence-readout", role: "status" });
  return { form: null, eatEl: null, startEl: null, paceEl: null, spareEl: null, readout, late, lateTitle, lateText, lateGo, saving: Promise.resolve() };
}

/** Put the sentence into its card and find its fields. @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s */
function buildSentence(ctx, s) {
  const data = /** @type {HTMLElement} */ ($("#tm-sentence-card-data", ctx.root));
  data.innerHTML = sentenceMarkup();
  data.append(s.readout, s.late);
  const form = /** @type {HTMLElement} */ ($("#tm-sentence", data));
  s.form = form;
  s.eatEl = /** @type {HTMLElement} */ ($("#tm-eat", data));
  s.startEl = /** @type {HTMLElement} */ ($("#tm-start", data));
  s.paceEl = /** @type {HTMLSelectElement} */ ($("#tm-pace", data));
  s.spareEl = /** @type {HTMLSelectElement} */ ($("#tm-spare", data));
  form.addEventListener("submit", (event) => event.preventDefault());
  ctx.cleanups.push(attachTimes(form), attachSelects(form), attachSentences(form));
}

/** Save settings one after the other, and say so in the sentence when they could not be saved. @param {SentenceParts} s @param {Record<string, unknown>} patch */
function save(s, patch) {
  s.saving = s.saving.then(async () => {
    try {
      await patchSettings(patch);
      if (s.form) setSentenceWhy(s.form, null);
    } catch (e) {
      if (s.form) setSentenceWhy(s.form, t("timing.notSaved", e instanceof Error ? e.message : String(e)));
    }
  });
}

/** Dinner moves to `ms`; shown and saved. @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s @param {number} ms */
function moveDinner(ctx, s, ms) {
  ctx.state.eat = hm(ms);
  if (s.eatEl) setTime(s.eatEl, ctx.state.eat);
  save(s, { dinner_time: ctx.state.eat });
  ctx.state.dropped.clear();
  ctx.snoozedUntil = null;
  ctx.view.draw();
}

/** The late note: the start has passed, so dinner can move. @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s @param {import("./plan.js").Plan} p */
function drawLate(ctx, s, p) {
  const passed = Date.now() >= p.start;
  s.late.hidden = !passed;
  if (!passed) return;
  const newServe = Date.now() + p.total + ctx.state.spare * MIN;
  s.lateTitle.textContent = t("timing.passed", hm(p.start));
  s.lateText.textContent = t("timing.startNow", hm(newServe), ctx.state.eat);
  s.lateGo.textContent = t("timing.eatAtInstead", hm(newServe));
  s.lateGo.dataset.serve = String(newServe);
}

/** @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s */
function drawSentence(ctx, s) {
  const p = ctx.current();
  if (!p || !s.startEl || !s.spareEl || !s.paceEl) return;
  setTime(s.startEl, hm(p.start));
  const lanes = t("timing.trackCount", p.lanes.length);
  s.readout.textContent = `${t("timing.ofCooking", words(Math.round(p.total / MIN)), lanes)} ${startsInWords(p)}`;
  drawLate(ctx, s, p);
  if (s.form) sentence(s.form)?.refresh();
}

/** A time field changed: dinner or the start was typed. @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s @param {Event} event */
function onTime(ctx, s, event) {
  const { state } = ctx;
  const { value } = /** @type {CustomEvent} */ (event).detail;
  if (!value || !ctx.recipe) return;
  const source = /** @type {HTMLElement} */ (event.target).closest("[data-kp-time]");
  if (source === s.eatEl) {
    if (value === state.eat) return;
    state.eat = value;
    save(s, { dinner_time: value });
  } else if (source === s.startEl) {
    const p = ctx.current();
    if (!p || value === hm(p.start)) return;
    // The start was typed: dinner is where the steps and the spare time end after it.
    state.eat = hm(at(value) + p.total + state.spare * MIN);
    if (s.eatEl) setTime(s.eatEl, state.eat);
    save(s, { dinner_time: state.eat });
  }
  state.dropped.clear();
  ctx.snoozedUntil = null;
  ctx.view.draw();
}

/** The pace or the time to spare changed. @param {import("./index.js").TimingCtx} ctx @param {SentenceParts} s @param {Event} event */
function onChange(ctx, s, event) {
  const { state } = ctx;
  if (event.target === s.paceEl) {
    state.pace = s.paceEl?.value === "slow" ? "slow" : "normal";
    save(s, { pace: state.pace });
  } else if (event.target === s.spareEl) {
    state.spare = Number(s.spareEl?.value);
    save(s, { spare: state.spare });
  } else return;
  ctx.view.draw();
}

/** @param {import("./index.js").TimingCtx} ctx */
export function createSentence(ctx) {
  const s = emptyParts();
  if (ctx.recipeId) buildSentence(ctx, s);
  if (s.form && s.eatEl && s.startEl && s.paceEl && s.spareEl) {
    s.form.addEventListener("kp-time-change", (event) => onTime(ctx, s, event));
    s.form.addEventListener("change", (event) => onChange(ctx, s, event));
    s.lateGo.addEventListener("click", () => moveDinner(ctx, s, Number(s.lateGo.dataset.serve)));
  }
  return { form: s.form, eatEl: s.eatEl, startEl: s.startEl, paceEl: s.paceEl, spareEl: s.spareEl, draw: () => drawSentence(ctx, s), moveDinner: (/** @type {number} */ ms) => moveDinner(ctx, s, ms) };
}
