// The app shell: the navigation bar, the history-API router, the theme menu
// and calm mode. Each screen is its own module under pages/ with
// `mount(root, ctx)` that returns its cleanup; chassis answers index.html for
// every extensionless path, so a deep link (`/recipe?id=…`) lands here too.
// The bar renders from the kit's page registry (`GET /api/kit/pages`), so it
// never carries a second hand-written list.

import { attachNavToggles, attachNavMenus, attachSkipLinks } from "/static/kp/js/components.js";
import { applyStoredCalm } from "/static/kp/js/calm.js";
import { attachThemePickers, themeMenuMarkup } from "/static/kp/js/theme-picker.js";
import { h } from "./dom.js";

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
});

/** Every item's own page, `/<word>/<id>` (pages/item.js), and the bar entry it lights up. */
const DETAIL = /** @type {Record<string, string>} */ ({
  dishes: "/dishes",
  categories: "/dishes",
  freezer: "/bad-days",
  shelf: "/bad-days",
  log: "/log",
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
  const m = path.match(/^\/([a-z]+)\/([^/]+)$/);
  if (!m || !(m[1] in DETAIL)) return null;
  params.set("list", m[1]);
  params.set("id", decodeURIComponent(m[2]));
  return { load: () => import("./pages/item.js"), params, bar: DETAIL[m[1]] };
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
    document.title = "Not found · Kitchen";
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
    h("div", { class: "kp-empty" }, h("h1", { class: "kp-empty__title", id: "nf-t" }, "This page does not exist"),
      h("p", { class: "kp-empty__text" }, "The address may be old. The wheel is always one press away."),
      h("a", { class: "kp-button", href: "/" }, "Open the wheel")),
  );
}

/** @param {unknown} e */
function failed(e) {
  return h(
    "section",
    { class: "kp-card app-plate", role: "alert" },
    h("div", { class: "kp-alert kp-alert--destructive" },
      h("h1", { class: "kp-alert__title" }, "This screen could not load"),
      h("p", null, e instanceof Error ? e.message : String(e)),
      h("button", { type: "button", class: "kp-button", onclick: () => location.reload() }, "Try again")),
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
        .map((/** @type {any} */ p) => h("li", null, h("a", { class: "kp-nav__link", href: p.path }, p.title))),
    );
  } catch {
    // The kit's registry did not answer: the bar keeps the five places.
    nav.replaceChildren(
      ...[["/", "What do we eat?"], ["/timing", "When do I start?"], ["/bad-days", "Bad days"], ["/recipes", "Recipes"], ["/settings", "Calm settings"]]
        .map(([href, t]) => h("li", null, h("a", { class: "kp-nav__link", href }, t))),
    );
  }
  const path = location.pathname.replace(/\/+$/, "") || "/";
  markNav(route(path, location.search)?.bar ?? path);
}

tools.innerHTML = themeMenuMarkup({ id: "app-theme-menu", label: "Theme" });
attachThemePickers(tools);
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
