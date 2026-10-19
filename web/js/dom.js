// Small DOM helpers every screen shares.

/**
 * Make an element: `h('p', { class: 'x', onclick: fn }, 'text', child)`.
 * Attributes starting with `on` become listeners; `null`/`false` are skipped.
 * @param {string} tag
 * @param {Record<string, any> | null} [attrs]
 * @param {...(Node | string | number | null | undefined | false)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "number" ? String(c) : c);
  }
  return el;
}

/** @param {string} sel @param {ParentNode} [root] */
export const $ = (sel, root = document) => /** @type {HTMLElement | null} */ (root.querySelector(sel));

/** @param {string} sel @param {ParentNode} [root] */
export const $$ = (sel, root = document) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(sel)]);
