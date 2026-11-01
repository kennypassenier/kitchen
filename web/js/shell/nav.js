// The bar: the daily places as links, the rest behind one "More" menu button. It draws from the kit's page registry
// (`GET /api/kit/pages`), split by shell/plan.js, so no second hand-written list exists. The More item is the kit's own
// nav More item (`.kp-nav__more` holding a `.kp-menu-button`, the markup js/nav-fold builds) filled with kp's setMenu.

import { attachMenuButtons, setMenu } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { splitBar, FALLBACK } from "./plan.js";

/** @param {{ id: string, title: string }} p The page's words: ours by id, the registry's own title when we have none. */
const wordOf = (p) => (t(`nav.${p.id}`) === `nav.${p.id}` ? p.title : t(`nav.${p.id}`));

/** @param {{ id: string, title: string, path: string }} p */
const link = (p) => h("li", null, h("a", { class: "kp-nav__link", href: p.path }, wordOf(p)));

/** The More item: a list item with the kit's menu button inside. @returns {{ item: HTMLElement, wrapper: HTMLElement, button: HTMLElement }} */
function moreItem() {
  const button = h("button", { type: "button", class: "kp-nav__link kp-nav__more-button" }, t("nav.more"), h("span", { "aria-hidden": "true" }, " ▾"));
  const menu = h("div", { class: "kp-menu kp-menu--rich kp-nav__more-menu", role: "menu", "aria-label": t("nav.moreMenu") });
  const wrapper = h("div", { class: "kp-menu-button kp-nav__more-wrap", "data-kp-menu-button": "" }, button, menu);
  return { item: h("li", { class: "kp-nav__more" }, wrapper), wrapper, button };
}

/**
 * @param {HTMLElement} nav the bar's list
 * @returns {{ draw: () => Promise<void>, mark: (path: string) => void }}
 */
export function createBar(nav) {
  /** @type {{ id: string, title: string, path: string }[]} */
  let more = [];
  let current = "/";
  /** @type {{ wrapper: HTMLElement, button: HTMLElement } | null} */
  let menu = null;
  let detach = () => {};

  function fillMenu() {
    if (!menu) return;
    const items = more.map((p) => ({ label: wordOf(p), href: p.path, attrs: { "aria-current": p.path === current ? "page" : null } }));
    setMenu(menu.wrapper, [{ items }]);
    if (more.some((p) => p.path === current)) menu.button.setAttribute("aria-current", "true");
    else menu.button.removeAttribute("aria-current");
  }

  /** @param {{ id: string, title: string, path: string, group?: string | null, nav?: boolean }[]} pages */
  function paint(pages) {
    const split = splitBar(pages);
    more = split.more;
    const items = split.bar.map(link);
    detach();
    detach = () => {};
    menu = null;
    if (more.length) {
      const built = moreItem();
      menu = built;
      items.push(built.item);
    }
    nav.replaceChildren(...items);
    if (menu) detach = attachMenuButtons(nav);
    fillMenu();
  }

  return {
    async draw() {
      try {
        const res = await fetch("/api/kit/pages", { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        paint((await res.json()).pages);
      } catch {
        // The kit's registry did not answer: the bar keeps the five places and the menu its five.
        paint(FALLBACK);
      }
      this.mark(current);
    },
    /** @param {string} path The bar entry the screen lights up. */
    mark(path) {
      current = path;
      for (const a of nav.querySelectorAll(":scope > li > a")) {
        if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
      fillMenu();
    },
  };
}
