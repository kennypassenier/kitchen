// The parents' wheel (route "/parents"): a page with only the wheel, for Kenny's parents (Kenny, 22/10/2026). The big
// wheel holds only the dishes marked "On the parents' wheel"; when the dish it lands on has sides, a smaller wheel spins
// with it and picks one ("Flemish beef stew" with fries, croquettes, …). A dish without sides leaves the small wheel
// saying so. Both wheels are the package's kiosk wheel with its answer card (js/wheel.js): the wheel itself is the one
// control, a tap spins it; a tap on the small wheel picks another side for the same dish. The card's loading, empty and
// failed states are js/card-state.js. Nothing is stored: the spin is the whole of it.

import { loadKitchen, kitchenNow, onKitchen } from "../api.js";
import { attachWheels, setWheelItems, spinWheel, WHEEL_SPIN_EVENT } from "/static/kp/js/wheel.js";
import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { attachArt } from "/static/kp/js/art.js";
import { h } from "../dom.js";

const LOADING_WORDS = "Reading the dinners";
const SIDE_FIRST = "Spin the big wheel first; then this wheel picks a side.";

/** @param {Record<string, any>} r */
const onWheel = (r) => r.parents === true && (r.meals ?? []).includes("dinner");
/** @param {Record<string, any>} r */
const sidesOf = (r) => (Array.isArray(r.sides) ? r.sides.map((s) => String(s).trim()).filter(Boolean) : []);

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Parents' wheel · Kitchen";
  let kitchen = kitchenNow();
  /** @type {"loading" | "error" | "ready"} */
  let status = kitchen ? "ready" : "loading";
  let failure = "";
  /** @type {Map<string, string[]>} the sides of every dish on the wheel, by id */
  let sides = new Map();
  /** @type {Array<() => void>} */
  const undo = [];

  root.innerHTML = `
    <div class="pr-page">
      <header class="kp-page-header">
        <div class="kp-page-header__inner">
          <div>
            <h1 class="kp-page-header__title">Parents' wheel</h1>
            <p class="kp-page-header__description">Only the dinners your parents eat. Tap the big wheel and it picks one; when that dish comes with a choice of side, the small wheel picks the side.</p>
          </div>
        </div>
      </header>
      <section class="kp-card pr-card" id="pr-card" data-kp-state="${status === "ready" ? "ready" : "loading"}" aria-labelledby="pr-card-t" data-kp-loading-words="${LOADING_WORDS}">
        <div class="kp-card__header">
          <h2 class="kp-card__title" id="pr-card-t">Tonight&rsquo;s dinner</h2>
          <div class="kp-card__actions"><span class="kp-badge" id="pr-count"></span></div>
        </div>
        <p class="kp-card__body">Tap a wheel to let it choose. A tap on the small wheel picks another side for the same dish.</p>
        <div class="kp-card__stage">
          <div class="kp-card__data">
            <div class="pr-wheels">
              <div class="pr-wheel pr-wheel--dish">
                <p class="pr-wheel__kicker" id="pr-dish-k">The dinner</p>
                <div class="kp-wheel" id="pr-dish" data-kp-wheel data-kp-wheel-kiosk data-kp-wheel-answer aria-labelledby="pr-dish-k"></div>
              </div>
              <div class="pr-wheel pr-wheel--side">
                <p class="pr-wheel__kicker" id="pr-side-k">The side</p>
                <div class="kp-wheel" id="pr-side" data-kp-wheel data-kp-wheel-kiosk data-kp-wheel-answer data-kp-wheel-repeat="false" data-kp-wheel-empty="${SIDE_FIRST}" aria-labelledby="pr-side-k"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>`;

  const card = /** @type {HTMLElement} */ (root.querySelector("#pr-card"));
  const count = /** @type {HTMLElement} */ (root.querySelector("#pr-count"));
  const dish = /** @type {HTMLElement} */ (root.querySelector("#pr-dish"));
  const side = /** @type {HTMLElement} */ (root.querySelector("#pr-side"));
  undo.push(attachCardStates(card), attachWheels(card));

  /** The empty and failed notes carry the package's drawing. */
  const drawArt = () => {
    const box = card.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
    if (!box) return;
    box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
    undo.push(attachArt(card));
  };

  // The big wheel draws its dish before it turns: the small wheel gets that dish's sides at once and turns alongside.
  const onSpin = (/** @type {Event} */ e) => {
    const item = /** @type {CustomEvent} */ (e).detail?.item;
    const list = sides.get(item?.id) ?? [];
    if (!list.length) {
      side.setAttribute("data-kp-wheel-empty", `${item?.label ?? "This dish"}: no side to choose.`);
      setWheelItems(side, []);
      return;
    }
    side.setAttribute("data-kp-wheel-empty", SIDE_FIRST);
    setWheelItems(side, list.map((s) => ({ id: s, label: s })));
    void spinWheel(side);
  };
  dish.addEventListener(WHEEL_SPIN_EVENT, onSpin);
  undo.push(() => dish.removeEventListener(WHEEL_SPIN_EVENT, onSpin));

  const draw = () => {
    if (status === "loading") {
      count.textContent = "";
      setCardState(card, "loading", { words: LOADING_WORDS });
      return;
    }
    if (status === "error") {
      count.textContent = "";
      setCardState(card, "error", { title: "The dinners could not be read", text: failure });
      drawArt();
      return;
    }
    const dishes = (kitchen?.recipes ?? []).filter(onWheel);
    sides = new Map(dishes.map((r) => [String(r.id), sidesOf(r)]));
    count.textContent = `${dishes.length} ${dishes.length === 1 ? "dinner" : "dinners"}`;
    if (!dishes.length) {
      setCardState(card, "empty", {
        title: "No dinner is on this wheel yet",
        text: "Open a recipe, choose Edit and switch on “On the parents' wheel”; the dish joins this wheel.",
        action: [h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/recipes", title: "Go to the recipes, where a dish can be put on this wheel" }, "Open the recipes")],
      });
      drawArt();
      return;
    }
    setWheelItems(
      dish,
      dishes.map((r) => ({ id: String(r.id), label: String(r.name), short: String(r.short ?? ""), tag: sidesOf(r).length ? `With ${sidesOf(r).length} sides to choose from` : "Always the same way" })),
    );
    setCardState(card, "ready");
  };

  const load = (force = false) => {
    if (force) {
      status = "loading";
      draw();
    }
    loadKitchen({ force }).then(
      (k) => {
        kitchen = k;
        status = "ready";
        draw();
      },
      (/** @type {Error} */ e) => {
        status = "error";
        failure = e.message;
        draw();
      },
    );
  };
  const retry = () => load(true);
  card.addEventListener(CARD_RETRY_EVENT, retry);
  undo.push(() => card.removeEventListener(CARD_RETRY_EVENT, retry));
  const stop = onKitchen((k) => {
    kitchen = k;
    status = "ready";
    draw();
  });
  undo.push(() => void stop());

  draw();
  if (status !== "ready") load();
  return () => {
    for (const fn of undo.reverse()) fn();
  };
}
