// Which pages of the kit's registry sit in the bar and which behind its More menu. Pure: no DOM, so a node test reads it.

/** The registry group whose pages sit behind the More menu; src/main.rs sets it on those pages (MORE). */
export const MORE_GROUP = "More";

/**
 * @typedef {{ id: string, title: string, path: string, group?: string | null, nav?: boolean }} KitPage
 */

/**
 * The listed pages, split in the registry's order.
 * @param {KitPage[]} pages
 * @returns {{ bar: KitPage[], more: KitPage[] }}
 */
export function splitBar(pages) {
  const listed = pages.filter((p) => p.nav !== false);
  return {
    bar: listed.filter((p) => p.group !== MORE_GROUP),
    more: listed.filter((p) => p.group === MORE_GROUP),
  };
}

/** The five places the bar keeps when the registry did not answer, and what is behind More. */
export const FALLBACK = /** @type {KitPage[]} */ ([
  { id: "wheel", title: "", path: "/" },
  { id: "timing", title: "", path: "/timing" },
  { id: "baddays", title: "", path: "/bad-days" },
  { id: "recipes", title: "", path: "/recipes" },
  { id: "log", title: "", path: "/log" },
  ...[["dishes", "/dishes"], ["ingredients", "/ingredients"], ["parents", "/parents"], ["sources", "/sources"], ["settings", "/settings"]]
    .map(([id, path]) => ({ id, title: "", path, group: MORE_GROUP })),
]);
