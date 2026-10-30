// The app shell: the navigation bar, the history-API router, the theme menu
// and calm mode. Each screen is its own module under pages/ with
// `mount(root, ctx)` that returns its cleanup; chassis answers index.html for
// every extensionless path, so a deep link (`/recipe?id=…`) lands here too.
// The bar renders from the kit's page registry (`GET /api/kit/pages`), so it
// never carries a second hand-written list.

import { attachNavToggles, attachNavMenus, attachSkipLinks } from "/static/kp/js/components.js";
import { applyStoredCalm } from "/static/kp/js/calm.js";
import { attachThemePickers, themeMenuMarkup } from "/static/kp/js/theme-picker.js";
import { attachSegmented, setSegmentedValues, SEGMENTED_EVENT } from "/static/kp/js/segmented.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "./dom.js";
import { t, lang, useLang, onLang } from "./i18n/index.js";
import { onKitchen, patchSettings, loadKitchen } from "./api.js";

/** @typedef {{ params: URLSearchParams, navigate: (href: string) => void }} Ctx */
/** @typedef {(root: HTMLElement, ctx: Ctx) => (void | (() => void))} Mount */

/** Path → screen module. A screen's module loads on its first visit. */
const ROUTES = /** @type {Record<string, () => Promise<{ mount: Mount }>>} */ ({
  "/": () => import("./pages/wheel.js"),
  "/cook": () => import("./pages/cook.js"),
  "/timing": () => import("./pages/timing.js"),
  "/bad-days": () => import("./pages/baddays.js"),
  "/recipe": () => import("./pages/recipe.js"),
  "/recipes": () => import("./pages/recipes.js"),
  "/settings": () => import("./pages/settings.js"),
  "/parents": () => import("./pages/parents.js"),
  "/dishes": () => import("./pages/dishes.js"),
  "/log": () => import("./pages/log.js"),
  "/sources": () => import("./pages/sources.js"),
  "/ingredients": () => import("./pages/ingredients.js"),
});

/** Every item's own page, `/<word>/<id>` (pages/item/index.js), and the bar entry it lights up. */
const DETAIL = /** @type {Record<string, string>} */ ({
  dishes: "/dishes",
  categories: "/dishes",
  ingredients: "/ingredients",
  "ingredient-categories": "/ingredients",
  freezer: "/bad-days",
  shelf: "/bad-days",
  log: "/log",
  sources: "/sources",
  resting: "/",
});

/** The bar entry a hidden screen lights up. */
const GROUP = /** @type {Record<string, string>} */ ({ "/recipe": "/recipes", "/cook": "/recipes" });

/**
 * The screen a path opens, with the parameters it reads: the query, plus `list` and `id` for an item's own page.
 * @param {string} path @param {string} search
 * @returns {{ load: () => Promise<{ mount: Mount }>, params: URLSearchParams, bar: string } | null}
 */
function route(path, search) {
  const params = new URLSearchParams(search);
  if (path in ROUTES) return { load: ROUTES[path], params, bar: GROUP[path] ?? path };
  const m = path.match(/^\/([a-z-]+)\/([^/]+)$/);
  if (!m || !(m[1] in DETAIL)) return null;
  params.set("list", m[1]);
  params.set("id", decodeURIComponent(m[2]));
  return { load: () => import("./pages/item/index.js"), params, bar: DETAIL[m[1]] };
}

const page = /** @type {HTMLElement} */ (document.getElementById("page"));
const nav = /** @type {HTMLElement} */ (document.getElementById("nav"));
const tools = /** @type {HTMLElement} */ (document.getElementById("tools"));

applyStoredCalm();

/** @type {() => void} */
let cleanup = () => {};
let seq = 0;

/** @param {string} href */
export function navigate(href) {
  history.pushState(null, "", href);
  void render();
}

async function render() {
  const mine = ++seq;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  cleanup();
  cleanup = () => {};
  const found = route(path, location.search);
  markNav(found?.bar ?? path);
  if (!found) {
    page.replaceChildren(notFound());
    document.title = `${t("shell.notFoundTitle")} · Kitchen`;
    return;
  }
  let mod;
  try {
    mod = await found.load();
  } catch (e) {
    if (mine !== seq) return;
    page.replaceChildren(failed(e));
    return;
  }
  if (mine !== seq) return;
  page.replaceChildren();
  const done = mod.mount(page, { params: found.params, navigate });
  if (typeof done === "function") cleanup = done;
}

function notFound() {
  return h(
    "section",
    { class: "kp-card app-plate", "aria-labelledby": "nf-t" },
    h("div", { class: "kp-empty" }, h("h1", { class: "kp-empty__title", id: "nf-t" }, t("shell.notFoundTitle")),
      h("p", { class: "kp-empty__text" }, t("shell.notFoundText")),
      h("a", { class: "kp-button", href: "/" }, t("shell.openWheel"))),
  );
}

/** @param {unknown} e */
function failed(e) {
  return h(
    "section",
    { class: "kp-card app-plate", role: "alert" },
    h("div", { class: "kp-alert kp-alert--destructive" },
      h("h1", { class: "kp-alert__title" }, t("shell.failedTitle")),
      h("p", null, e instanceof Error ? e.message : String(e)),
      h("button", { type: "button", class: "kp-button", onclick: () => location.reload() }, t("common.tryAgain"))),
  );
}

/** @param {string} path */
function markNav(path) {
  for (const a of nav.querySelectorAll("a")) {
    if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

async function drawNav() {
  try {
    const res = await fetch("/api/kit/pages", { credentials: "same-origin" });
    if (!res.ok) throw new Error(String(res.status));
    const set = await res.json();
    nav.replaceChildren(
      ...set.pages
        .filter((/** @type {any} */ p) => p.nav)
        .map((/** @type {any} */ p) => h("li", null, h("a", { class: "kp-nav__link", href: p.path }, t(`nav.${p.id}`) === `nav.${p.id}` ? p.title : t(`nav.${p.id}`)))),
    );
  } catch {
    // The kit's registry did not answer: the bar keeps the five places.
    nav.replaceChildren(
      ...[["/", "wheel"], ["/timing", "timing"], ["/bad-days", "baddays"], ["/recipes", "recipes"], ["/settings", "settings"]]
        .map(([href, id]) => h("li", null, h("a", { class: "kp-nav__link", href }, t(`nav.${id}`)))),
    );
  }
  const path = location.pathname.replace(/\/+$/, "") || "/";
  markNav(route(path, location.search)?.bar ?? path);
}

// The language toggle, left of the theme picker (Kenny, 24/10/2026 05:12): the package's segmented choice of two. It
// writes the kitchen's `settings.lang`, so the choice follows Kenny between devices; the kitchen's value wins on load.
const langToggle = h(
  "div",
  { class: "kp-segmented kp-segmented--chips app-lang", "data-kp-segmented": "single", role: "radiogroup", "aria-label": t("shell.language") },
  ...[["nl", "NL", "Nederlands"], ["en", "EN", "English"]].map(([value, short, long]) =>
    h("button", { type: "button", class: "kp-segmented__item", role: "radio", "data-value": value, "aria-checked": String(value === lang()), title: long, "aria-label": long }, h("span", { class: "kp-segmented__label" }, short)),
  ),
);
const theme = h("span", { class: "app-theme" });
theme.innerHTML = themeMenuMarkup({ id: "app-theme-menu", label: t("shell.theme") });
tools.replaceChildren(langToggle, theme);
attachThemePickers(tools);
attachSegmented(langToggle);
langToggle.addEventListener(SEGMENTED_EVENT, (event) => {
  const next = /** @type {CustomEvent} */ (event).detail?.value === "nl" ? "nl" : "en";
  if (next === lang()) return;
  useLang(next);
  patchSettings({ lang: next }).catch((e) => toast(`${t("shell.langNotKept")} ${e instanceof Error ? e.message : e}`, { live: "assertive" }));
});
onKitchen((k) => {
  const kept = k.settings?.lang === "nl" ? "nl" : "en";
  if (kept !== lang()) useLang(kept);
});
// A new language draws the bar and the page again, in place: nothing typed is kept in a page that is redrawn, so the
// toggle is the only thing that does this.
onLang((l) => {
  setSegmentedValues(langToggle, [l]);
  langToggle.setAttribute("aria-label", t("shell.language"));
  void drawNav();
  void render();
});
void loadKitchen().catch(() => {});
attachNavToggles(document);
attachNavMenus(document);
attachSkipLinks(document);

// Same-origin links route in place; a modified click opens normally.
document.addEventListener("click", (e) => {
  const a = /** @type {HTMLElement} */ (e.target)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin) return;
  if (!route(url.pathname.replace(/\/+$/, "") || "/", url.search)) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
addEventListener("popstate", () => void render());

void drawNav();
void render();
