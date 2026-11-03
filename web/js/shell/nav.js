// The bar: every listed page of the kit's registry (`GET /api/kit/pages`) as a list item, split by shell/plan.js, so no
// second hand-written list exists. The pages behind More carry kp's `data-kp-nav-more`; js/nav-fold (the bar is a
// `data-kp-nav-fold` bar) puts them behind its own More button, moves the current-page mark onto it and speaks its words.

import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { splitBar, FALLBACK } from "./plan.js";

/** @param {{ id: string, title: string }} p The page's words: ours by id, the registry's own title when we have none. */
const wordOf = (p) => (t(`nav.${p.id}`) === `nav.${p.id}` ? p.title : t(`nav.${p.id}`));

/** @param {{ id: string, title: string, path: string }} p @param {boolean} pinned Sits behind More whatever the width. */
const item = (p, pinned) => h("li", pinned ? { "data-kp-nav-more": "" } : null, h("a", { class: "kp-nav__link", href: p.path }, wordOf(p)));

/**
 * @param {HTMLElement} nav the bar's list
 * @returns {{ draw: () => Promise<void>, mark: (path: string) => void }}
 */
export function createBar(nav) {
  let current = "/";
  /** @type {HTMLElement[]} Our items; the fold's own More item in the same list is not ours to replace. */
  let drawn = [];

  /** @param {{ id: string, title: string, path: string, nav?: boolean, secondary?: boolean }[]} pages */
  function paint(pages) {
    const split = splitBar(pages);
    for (const li of drawn) li.remove();
    drawn = [...split.bar.map((p) => item(p, false)), ...split.more.map((p) => item(p, true))];
    nav.prepend(...drawn);
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
    },
  };
}
