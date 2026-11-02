// The app shell: the navigation bar, the history-API router, the theme menu
// and calm mode. Each screen is its own module under pages/ with
// `mount(root, ctx)` that returns its cleanup; chassis answers index.html for
// every extensionless path, so a deep link (`/recipe?id=…`) lands here too.
// The bar renders from the kit's page registry (`GET /api/kit/pages`), so it
// never carries a second hand-written list.

import { attachNavToggles, attachSkipLinks } from "/static/kp/dist/js/components.js";
import { applyStoredCalm } from "/static/kp/dist/js/calm.js";
import { attachThemePickers, themeMenuMarkup } from "/static/kp/dist/js/picker.js";
import { attachThemeRegisters } from "/eten/registers.js";
import { h } from "./dom.js";
import { t, lang, useLang, onLang } from "./i18n/index.js";
import { createBar } from "./shell/nav.js";
import { onKitchen, loadKitchen, refreshIfOffline } from "./api.js";
import { startOffline } from "./offline/start.js";
import { holdDatatableFootprints } from "./ui/datatable-footprint.js";

/** @typedef {{ params: URLSearchParams, navigate: (href: string) => void }} Ctx */
/** @typedef {(root: HTMLElement, ctx: Ctx) => (void | (() => void))} Mount */

/** Path → screen module. A screen's module loads on its first visit. */
const ROUTES = /** @type {Record<string, () => Promise<{ mount: Mount }>>} */ ({
  "/": () => import("./pages/wheel/index.js"),
  "/cook": () => import("./pages/cook/index.js"),
  "/timing": () => import("./pages/timing/index.js"),
  "/bad-days": () => import("./pages/baddays/index.js"),
  "/recipe": () => import("./pages/recipe/index.js"),
  "/recipe/edit": () => import("./pages/recipe-edit/index.js"),
  "/recipes": () => import("./pages/recipes/index.js"),
  "/settings": () => import("./pages/settings/index.js"),
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
const GROUP = /** @type {Record<string, string>} */ ({ "/recipe": "/recipes", "/recipe/edit": "/recipes", "/cook": "/recipes" });

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
const bar = createBar(nav);
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
  // A kitchen held from the device's copy is read again on every page change (the server is the master).
  refreshIfOffline();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  cleanup();
  cleanup = () => {};
  const found = route(path, location.search);
  bar.mark(found?.bar ?? path);
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

// The theme picker, right of the bar. The language is chosen once, in Calm settings (Kenny, 01/11/2026 20:21); it writes
// the kitchen's `settings.lang`, so the choice follows Kenny between devices, and the kitchen's value wins on load.
// It is drawn again on a language change, so its name and the Light / Dark groups follow the language.
// The registers first (once): the pickers below start a theme change, which must fetch the picked theme's register.
attachThemeRegisters();
let detachTheme = () => {};
function drawTheme() {
  detachTheme();
  const theme = h("span", { class: "app-theme" });
  theme.innerHTML = themeMenuMarkup({ id: "app-theme-menu", label: t("shell.theme") });
  tools.replaceChildren(theme);
  detachTheme = attachThemePickers(tools);
}
drawTheme();
onKitchen((k) => {
  const kept = k.settings?.lang === "nl" ? "nl" : "en";
  if (kept !== lang()) useLang(kept);
});
// A new language draws the bar and the page again, in place: nothing typed is kept in a page that is redrawn, so a
// language change in Calm settings is the only thing that does this.
/** The shell's own words in index.html (the skip link, the bar's name) follow the language too. */
function shellWords() {
  const skip = document.querySelector(".kp-skip-link");
  if (skip) skip.textContent = t("shell.skip");
  document.getElementById("bar")?.setAttribute("aria-label", t("shell.pages"));
}
shellWords();
onLang(() => {
  shellWords();
  drawTheme();
  void bar.draw();
  void render();
});
// The offline copy first (feat-offline-kitchen): the kit is configured before the first read, so that read is kept.
startOffline();
// Each page shows its own failed state when it reads the kitchen; this early read only warms the copy.
void loadKitchen().catch((e) => console.warn("the kitchen could not be read at start", e));
attachNavToggles(document);
attachSkipLinks(document);
// Stand-in until kp-themes 2bc105c2b reaches Kitchen (web/js/ui/datatable-footprint.js).
holdDatatableFootprints();

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

void bar.draw();
void render();
